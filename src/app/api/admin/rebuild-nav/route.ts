import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcFactsheetNAV } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { dailyReturns, navAlerts } from "@/lib/db/schema";
import { desc, asc, eq, and, gte, lte } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin API: Rebuild missing daily returns from Bybit API.
 *
 * Finds gaps in daily_returns and fills them using calcFactsheetNAV().
 * Only works for dates where Bybit kline data is available.
 *
 * Query params:
 *   from: start date (YYYY-MM-DD) — defaults to last recorded date
 *   to:   end date (YYYY-MM-DD) — defaults to today
 *
 * This endpoint is idempotent: existing dates are skipped.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const database = getDb();

  try {
    // Determine date range
    const toDate = searchParams.get("to") || new Date().toISOString().split("T")[0];

    let fromDate = searchParams.get("from");
    if (!fromDate) {
      const lastRow = await database
        .select({ date: dailyReturns.date })
        .from(dailyReturns)
        .orderBy(desc(dailyReturns.date))
        .limit(1);
      fromDate = lastRow[0]?.date;
    }

    if (!fromDate) {
      return NextResponse.json({ error: "No existing data and no 'from' date specified" }, { status: 400 });
    }

    // Find missing dates in range
    const existingRows = await database
      .select({ date: dailyReturns.date })
      .from(dailyReturns)
      .where(and(gte(dailyReturns.date, fromDate), lte(dailyReturns.date, toDate)))
      .orderBy(asc(dailyReturns.date));

    const existingDates = new Set(existingRows.map((r) => r.date));

    const allDates: string[] = [];
    const current = new Date(fromDate + "T00:00:00Z");
    const end = new Date(toDate + "T00:00:00Z");
    while (current <= end) {
      allDates.push(current.toISOString().split("T")[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    const missingDates = allDates.filter((d) => !existingDates.has(d));

    if (missingDates.length === 0) {
      return NextResponse.json({ message: "No missing dates in range", from: fromDate, to: toDate });
    }

    // For rebuild, we need the row BEFORE the first missing date as anchor
    const anchorRows = await database
      .select()
      .from(dailyReturns)
      .where(lte(dailyReturns.date, missingDates[0]))
      .orderBy(desc(dailyReturns.date))
      .limit(1);

    if (anchorRows.length === 0) {
      return NextResponse.json({ error: "No anchor row found before missing dates" }, { status: 400 });
    }

    // Attempt to rebuild each missing date
    // Note: calcFactsheetNAV() returns CURRENT NAV, not historical.
    // For historical rebuild, we would need kline data at specific dates.
    // This endpoint currently only rebuilds TODAY (real-time).
    // Historical rebuild requires the CSV factsheet data or kline backfill.
    const results: { date: string; status: string; detail?: string }[] = [];
    let rebuilt = 0;

    // For now, only rebuild today if it's missing
    const today = new Date().toISOString().split("T")[0];
    if (missingDates.includes(today)) {
      try {
        const navResult = await calcFactsheetNAV();
        const todayNAV = navResult.nav;

        // Find previous day for chaining
        const prevRow = await database
          .select()
          .from(dailyReturns)
          .where(lte(dailyReturns.date, today))
          .orderBy(desc(dailyReturns.date))
          .limit(1);

        if (prevRow.length > 0 && prevRow[0].rawNav != null && prevRow[0].rawNav > 0) {
          const dailyReturn = (todayNAV - prevRow[0].rawNav) / prevRow[0].rawNav;
          const navIndex = prevRow[0].navIndex * (1 + dailyReturn);

          await database.insert(dailyReturns).values({
            date: today,
            navIndex,
            dailyReturn,
            rawNav: todayNAV,
            source: "api_rebuild",
          }).onConflictDoNothing({ target: dailyReturns.date });

          results.push({ date: today, status: "rebuilt" });
          rebuilt++;

          // Resolve gap alerts
          await database.update(navAlerts)
            .set({ resolved: new Date() })
            .where(and(eq(navAlerts.type, "gap_detected")));
        } else {
          results.push({ date: today, status: "skipped", detail: "No valid previous rawNav for chaining" });
        }
      } catch (err) {
        results.push({ date: today, status: "error", detail: err instanceof Error ? err.message : String(err) });
      }
    }

    // Past missing dates: record them as known gaps needing CSV/manual import
    const pastMissing = missingDates.filter((d) => d !== today);
    for (const d of pastMissing) {
      results.push({ date: d, status: "needs_import", detail: "Historical date — use CSV factsheet import or kline backfill" });
    }

    return NextResponse.json({
      from: fromDate,
      to: toDate,
      totalMissing: missingDates.length,
      rebuilt,
      results,
    });
  } catch (error) {
    console.error("Rebuild NAV error:", error);
    return NextResponse.json({ error: "Failed to rebuild NAV" }, { status: 500 });
  }
}
