/**
 * Parse tearsheet HTML and insert historical daily returns into DB.
 *
 * Extracts Plotly cumulative-returns-plot data from the tearsheet,
 * converts to navIndex + dailyReturn, and inserts into daily_returns table.
 *
 * Usage: npx tsx scripts/parse-tearsheet.ts
 */

import fs from "fs";
import path from "path";
import { dailyReturns } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db";

async function main() {
  console.log("=== Parsing tearsheet for daily returns ===\n");

  // 1. Read tearsheet HTML
  const htmlPath = path.resolve(__dirname, "../ref/Rebeta_v1-3.1_tearsheet_260215.html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  // 2. Extract cumulative-returns-plot Plotly data
  const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
  const match = html.match(plotRegex);
  if (!match) {
    console.error("Failed to find cumulative-returns-plot data");
    process.exit(1);
  }

  const plotData = JSON.parse(match[1]);

  // 3. Find the "daily_return" trace (not "BTC")
  const trace = plotData.data.find((t: { name?: string }) =>
    t.name && t.name.includes("daily_return")
  );
  if (!trace) {
    console.error("Failed to find daily_return trace");
    process.exit(1);
  }

  const dates: string[] = trace.x;
  const cumReturns: number[] = trace.y;

  console.log(`Found ${dates.length} data points`);
  console.log(`Date range: ${dates[0]} ~ ${dates[dates.length - 1]}`);
  console.log(`Cumulative return: ${(cumReturns[cumReturns.length - 1] * 100).toFixed(2)}%\n`);

  // 4. Convert to navIndex + dailyReturn
  const rows: { date: string; navIndex: number; dailyReturn: number }[] = [];

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i].split("T")[0]; // YYYY-MM-DD
    const navIndex = 1 + cumReturns[i];
    const dailyReturn = i === 0 ? 0 : (navIndex - (1 + cumReturns[i - 1])) / (1 + cumReturns[i - 1]);

    rows.push({ date: dateStr, navIndex, dailyReturn });
  }

  console.log(`First: ${rows[0].date} | navIndex=${rows[0].navIndex.toFixed(6)}`);
  console.log(`Last:  ${rows[rows.length - 1].date} | navIndex=${rows[rows.length - 1].navIndex.toFixed(6)}\n`);

  // 5. Insert into DB
  const db = getDb();

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(dailyReturns)
      .values(batch.map(r => ({
        date: r.date,
        navIndex: r.navIndex,
        dailyReturn: r.dailyReturn,
        source: "tearsheet" as const,
      })))
      .onConflictDoNothing();
    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
  }

  console.log(`\n\nDone! ${inserted} rows inserted (source: tearsheet)`);

  // 6. Verify
  const count = await db.select({ count: sql<number>`count(*)` }).from(dailyReturns);
  console.log(`Total rows in daily_returns: ${count[0].count}`);

  await closeDb();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Error:", e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
