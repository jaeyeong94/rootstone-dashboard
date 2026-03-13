import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { and, gte, lte, asc } from "drizzle-orm";
import { getClosedPnl } from "@/lib/bybit/client";
import type { BybitClosedPnl } from "@/types";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dailyReturn: number; // percentage
  tradeCount: number;
  topTrade: { symbol: string; pnlPercent: number } | null;
}

export interface CalendarSummary {
  totalReturn: number;
  tradingDays: number;
  winRate: number;
  bestDay: { date: string; return: number };
  worstDay: { date: string; return: number };
}

export interface CalendarMonthlyResponse {
  year: number;
  month: number;
  days: CalendarDay[];
  summary: CalendarSummary;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  // Month boundaries (UTC)
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // exclusive

  try {
    // Fetch balance snapshots for the month
    const snapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .where(
        and(
          gte(balanceSnapshots.snapshotAt, monthStart),
          lte(balanceSnapshots.snapshotAt, new Date(monthEnd.getTime() - 1))
        )
      )
      .orderBy(asc(balanceSnapshots.snapshotAt));

    // Also fetch the last snapshot from the day before month start to compute
    // day-1 return correctly
    const prevSnapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .where(lte(balanceSnapshots.snapshotAt, new Date(monthStart.getTime() - 1)))
      .orderBy(asc(balanceSnapshots.snapshotAt));

    // Group snapshots by YYYY-MM-DD (UTC date)
    const dailyEquity = new Map<string, { first: number; last: number }>();

    for (const snap of snapshots) {
      const d = snap.snapshotAt;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const existing = dailyEquity.get(key);
      if (!existing) {
        dailyEquity.set(key, { first: snap.totalEquity, last: snap.totalEquity });
      } else {
        existing.last = snap.totalEquity;
      }
    }

    // Previous day's last equity (for computing day-1 return)
    const prevDayLastEquity =
      prevSnapshots.length > 0
        ? prevSnapshots[prevSnapshots.length - 1].totalEquity
        : null;

    // Compute daily returns keyed by date string
    const dailyReturnMap = new Map<string, number>();
    const sortedDates = Array.from(dailyEquity.keys()).sort();

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const { first, last } = dailyEquity.get(date)!;

      // Reference equity: previous day's last, or this day's first if none
      let refEquity: number | null = null;
      if (i === 0) {
        refEquity = prevDayLastEquity ?? first;
      } else {
        refEquity = dailyEquity.get(sortedDates[i - 1])!.last;
      }

      if (refEquity && refEquity !== 0) {
        dailyReturnMap.set(date, ((last - refEquity) / refEquity) * 100);
      } else {
        dailyReturnMap.set(date, 0);
      }
    }

    // Fetch closed PnL for the month
    const startTime = String(monthStart.getTime());
    const endTime = String(monthEnd.getTime() - 1);

    const allPnl: BybitClosedPnl[] = [];
    let cursor: string | undefined;
    do {
      const page = await getClosedPnl({
        limit: "200",
        startTime,
        endTime,
        ...(cursor ? { cursor } : {}),
      });
      allPnl.push(...page.list);
      cursor = page.nextPageCursor || undefined;
    } while (cursor);

    // Group PnL by UTC date
    const dailyPnlMap = new Map<
      string,
      { trades: Array<{ symbol: string; pnl: number; entryPrice: number }>; winCount: number; totalCount: number }
    >();

    for (const record of allPnl) {
      const ts = parseInt(record.updatedTime);
      const d = new Date(ts);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      if (!dailyPnlMap.has(key)) {
        dailyPnlMap.set(key, { trades: [], winCount: 0, totalCount: 0 });
      }
      const entry = dailyPnlMap.get(key)!;
      const pnl = parseFloat(record.closedPnl);
      const entryPrice = parseFloat(record.entryPrice);
      entry.trades.push({ symbol: record.symbol, pnl, entryPrice });
      entry.totalCount++;
      if (pnl > 0) entry.winCount++;
    }

    // Build calendar days array for all days in the month
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: CalendarDay[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dailyReturn = dailyReturnMap.get(date) ?? 0;
      const pnlEntry = dailyPnlMap.get(date);
      const tradeCount = pnlEntry?.totalCount ?? 0;

      let topTrade: { symbol: string; pnlPercent: number } | null = null;
      if (pnlEntry && pnlEntry.trades.length > 0) {
        // Pick trade with highest absolute pnl percent impact
        let best = pnlEntry.trades[0];
        let bestPct = best.entryPrice !== 0 ? Math.abs(best.pnl / best.entryPrice) : 0;
        for (const t of pnlEntry.trades) {
          const pct = t.entryPrice !== 0 ? Math.abs(t.pnl / t.entryPrice) : 0;
          if (pct > bestPct) {
            bestPct = pct;
            best = t;
          }
        }
        topTrade = {
          symbol: best.symbol.replace(/USDT$/, ""),
          pnlPercent: best.entryPrice !== 0 ? (best.pnl / best.entryPrice) * 100 : 0,
        };
      }

      days.push({ date, dailyReturn, tradeCount, topTrade });
    }

    // Summary
    const tradingDays = days.filter((d) => d.tradeCount > 0 || dailyReturnMap.has(d.date)).length;
    const activeDays = days.filter((d) => dailyReturnMap.has(d.date));
    const winDays = activeDays.filter((d) => d.dailyReturn > 0).length;
    const winRate = activeDays.length > 0 ? (winDays / activeDays.length) * 100 : 0;

    // Total return: compound of all daily returns in order
    let totalReturn = 0;
    if (sortedDates.length > 0) {
      let compound = 1;
      for (const date of sortedDates) {
        const r = dailyReturnMap.get(date) ?? 0;
        compound *= 1 + r / 100;
      }
      totalReturn = (compound - 1) * 100;
    }

    const sortedActive = [...activeDays].sort((a, b) => b.dailyReturn - a.dailyReturn);
    const bestDay = sortedActive[0]
      ? { date: sortedActive[0].date, return: sortedActive[0].dailyReturn }
      : { date: "", return: 0 };
    const worstDay = sortedActive[sortedActive.length - 1]
      ? { date: sortedActive[sortedActive.length - 1].date, return: sortedActive[sortedActive.length - 1].dailyReturn }
      : { date: "", return: 0 };

    const summary: CalendarSummary = {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      tradingDays,
      winRate: parseFloat(winRate.toFixed(1)),
      bestDay: { date: bestDay.date, return: parseFloat(bestDay.return.toFixed(2)) },
      worstDay: { date: worstDay.date, return: parseFloat(worstDay.return.toFixed(2)) },
    };

    const response: CalendarMonthlyResponse = { year, month, days, summary };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Calendar monthly error:", error);
    return NextResponse.json({ error: "Failed to load calendar data" }, { status: 500 });
  }
}
