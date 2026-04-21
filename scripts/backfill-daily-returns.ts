/**
 * Backfill daily_returns from balance_snapshots for the gap period.
 *
 * Fills the gap between tearsheet end date and today.
 *
 * Key assumption: all balance_snapshots have timestamp 23:59:59 UTC,
 * which represents that day's closing equity (≈ next day's open).
 * We treat the snapshot's UTC date as-is (no day shifting).
 *
 * Usage: npx tsx scripts/backfill-daily-returns.ts
 */

import { balanceSnapshots, dailyReturns } from "../src/lib/db/schema";
import { desc, asc, sql, gte, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db";

async function main() {
  console.log("=== Backfilling daily returns from balance snapshots ===\n");

  const db = getDb();

  // 1. Get the last tearsheet entry to chain navIndex
  const lastTearsheetRows = await db
    .select()
    .from(dailyReturns)
    .where(eq(dailyReturns.source, "tearsheet"))
    .orderBy(desc(dailyReturns.date))
    .limit(1);

  if (lastTearsheetRows.length === 0) {
    console.error("No tearsheet data found. Run parse-tearsheet.ts first.");
    process.exit(1);
  }

  const lastTearsheetDate = lastTearsheetRows[0].date;
  const lastTearsheetNavIndex = lastTearsheetRows[0].navIndex;
  console.log(`Last tearsheet entry: ${lastTearsheetDate} | navIndex=${lastTearsheetNavIndex.toFixed(6)}`);

  // 2. Delete existing backfill rows to re-run cleanly
  await db.delete(dailyReturns).where(eq(dailyReturns.source, "snapshot_backfill"));
  console.log("Cleared existing snapshot_backfill rows");

  // 3. Get all snapshots from tearsheet end date onwards
  //    Include the tearsheet end date's snapshot to compute first gap day's return
  const snapshots = await db
    .select()
    .from(balanceSnapshots)
    .where(gte(balanceSnapshots.snapshotAt, new Date(lastTearsheetDate + "T00:00:00Z")))
    .orderBy(asc(balanceSnapshots.snapshotAt));

  console.log(`Found ${snapshots.length} snapshots from ${lastTearsheetDate} onwards\n`);

  // 4. Group snapshots by their UTC date (as-is, no day shifting)
  //    All snapshots are at 23:59:59 UTC, so UTC date is the correct day
  const byDay = new Map<string, number>();
  for (const snap of snapshots) {
    const day = new Date(snap.snapshotAt).toISOString().split("T")[0];
    // Keep last equity per day (in case of multiple snapshots)
    byDay.set(day, snap.totalEquity);
  }

  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  console.log(`Unique days: ${days.length}`);
  console.log(`Range: ${days[0]?.[0]} ~ ${days[days.length - 1]?.[0]}`);

  // 5. Find the tearsheet end date's equity as the baseline
  const tearsheetDayEquity = byDay.get(lastTearsheetDate);
  if (!tearsheetDayEquity) {
    console.warn(`Warning: No snapshot found for tearsheet end date ${lastTearsheetDate}`);
    console.warn("First gap day will have dailyReturn=0");
  } else {
    console.log(`Tearsheet end date equity: ${tearsheetDayEquity.toFixed(2)}`);
  }

  // 6. Compute daily returns and chain navIndex for days AFTER tearsheet end
  const gapDays = days.filter(([day]) => day > lastTearsheetDate);
  console.log(`\nGap days to backfill: ${gapDays.length}`);

  if (gapDays.length === 0) {
    console.log("No gap days to backfill.");
    process.exit(0);
  }

  const rows: { date: string; navIndex: number; dailyReturn: number }[] = [];
  let prevNavIndex = lastTearsheetNavIndex;
  let prevEquity = tearsheetDayEquity ?? gapDays[0][1];

  for (let i = 0; i < gapDays.length; i++) {
    const [day, equity] = gapDays[i];

    const dailyReturn = (equity - prevEquity) / prevEquity;
    const navIndex = prevNavIndex * (1 + dailyReturn);

    rows.push({ date: day, navIndex, dailyReturn });
    prevNavIndex = navIndex;
    prevEquity = equity;
  }

  // 7. Insert into DB
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(dailyReturns)
      .values(batch.map(r => ({
        date: r.date,
        navIndex: r.navIndex,
        dailyReturn: r.dailyReturn,
        source: "snapshot_backfill" as const,
      })))
      .onConflictDoNothing();
    inserted += batch.length;
  }

  console.log(`Inserted ${inserted} rows (source: snapshot_backfill)`);

  // 8. Summary
  if (rows.length > 0) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    console.log(`\nFirst: ${first.date} | navIndex=${first.navIndex.toFixed(6)} | dailyReturn=${(first.dailyReturn * 100).toFixed(4)}%`);
    console.log(`Last:  ${last.date} | navIndex=${last.navIndex.toFixed(6)} | dailyReturn=${(last.dailyReturn * 100).toFixed(4)}%`);
    const totalReturn = ((last.navIndex / first.navIndex) - 1) * 100;
    console.log(`Gap period return: ${totalReturn.toFixed(2)}%`);
  }

  // 9. Total count
  const count = await db.select({ count: sql<number>`count(*)` }).from(dailyReturns);
  console.log(`\nTotal rows in daily_returns: ${count[0].count}`);

  await closeDb();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Error:", e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
