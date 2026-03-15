import { NextResponse } from "next/server";
import { calcFactsheetNAV } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { dailyReturns, balanceSnapshots } from "@/lib/db/schema";
import { desc, and, gte, lte, asc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily NAV cron — Factsheet 방법론 준수
 *
 * 매일 UTC 00:05에 실행:
 * 1. 현재 포지션 + kline daily open 가격으로 Unrealized PnL 계산
 * 2. NAV(open) = Cash + Unrealized PnL (kline open 기반)
 * 3. 전일 rawNav 대비 daily return 산출 (kline↔kline 비교)
 * 4. daily_returns 테이블에 rawNav 포함하여 기록
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const database = getDb();
    const today = new Date().toISOString().split("T")[0];

    // Dedup: skip if today already recorded
    const existing = await database
      .select()
      .from(dailyReturns)
      .where(and(gte(dailyReturns.date, today), lte(dailyReturns.date, today)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        skipped: true,
        reason: "Today's daily return already exists",
        date: today,
      });
    }

    // Calculate NAV using Factsheet methodology (kline open prices)
    const navResult = await calcFactsheetNAV();
    const todayNAV = navResult.nav;

    // Get previous day's entry from daily_returns
    const prevRow = await database
      .select()
      .from(dailyReturns)
      .orderBy(desc(dailyReturns.date))
      .limit(1);

    if (prevRow.length === 0) {
      return NextResponse.json({ error: "No previous daily return found" }, { status: 404 });
    }

    // Determine yesterday's NAV for denominator
    // Priority: rawNav from daily_returns (kline-based) > balance_snapshot fallback
    let yesterdayNAV: number;
    let denomSource: string;

    if (prevRow[0].rawNav != null) {
      // Previous cron entry has rawNav → kline↔kline comparison (ideal)
      yesterdayNAV = prevRow[0].rawNav;
      denomSource = "rawNav";
    } else {
      // Historical entry without rawNav → fallback to balance_snapshot equity
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const yesterdaySnaps = await database
        .select()
        .from(balanceSnapshots)
        .where(and(
          gte(balanceSnapshots.snapshotAt, new Date(yesterdayStr + "T00:00:00Z")),
          lte(balanceSnapshots.snapshotAt, new Date(today + "T00:30:00Z"))
        ))
        .orderBy(asc(balanceSnapshots.snapshotAt));

      if (yesterdaySnaps.length > 0) {
        // Pick closest to midnight UTC
        const midnight = new Date(today + "T00:00:00Z").getTime();
        let closest = yesterdaySnaps[0];
        let closestDist = Infinity;
        for (const snap of yesterdaySnaps) {
          const dist = Math.abs(new Date(snap.snapshotAt).getTime() - midnight);
          if (dist < closestDist) {
            closestDist = dist;
            closest = snap;
          }
        }
        yesterdayNAV = closest.totalEquity;
        denomSource = "snapshot_fallback";
      } else {
        return NextResponse.json({ error: "No yesterday NAV found" }, { status: 404 });
      }
    }

    const dailyReturn = (todayNAV - yesterdayNAV) / yesterdayNAV;
    const prevNavIndex = prevRow[0].navIndex;
    const navIndex = prevNavIndex * (1 + dailyReturn);

    await database.insert(dailyReturns).values({
      date: today,
      navIndex,
      dailyReturn,
      rawNav: todayNAV,
      source: "cron",
    });

    return NextResponse.json({
      ok: true,
      date: today,
      method: "factsheet",
      todayNAV: parseFloat(todayNAV.toFixed(4)),
      yesterdayNAV: parseFloat(yesterdayNAV.toFixed(4)),
      denomSource,
      navIndex: parseFloat(navIndex.toFixed(6)),
      dailyReturn: parseFloat((dailyReturn * 100).toFixed(4)),
      positions: navResult.positions.length,
      source: "cron",
    });
  } catch (error) {
    console.error("Daily NAV cron error:", error);
    return NextResponse.json(
      { error: "Failed to compute daily NAV" },
      { status: 500 }
    );
  }
}
