import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc, and, gte, lte } from "drizzle-orm";
import { getClosedPnl } from "@/lib/bybit/client";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import { historicalVaR } from "@/lib/math/statistics";
import { calcSharpeRatio, calcSortinoRatio, calcMaxDrawdown, calcDailyReturns } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch equity snapshots and BTC prices in parallel
    const [snapshots, btcData, pnlData] = await Promise.all([
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .where(and(gte(balanceSnapshots.snapshotAt, start), lte(balanceSnapshots.snapshotAt, end)))
        .orderBy(asc(balanceSnapshots.snapshotAt)),
      getDailyClosePrices("BTCUSDT", 200),
      getClosedPnl({
        startTime: String(start.getTime()),
        endTime: String(end.getTime()),
        limit: "100",
      }),
    ]);

    // Build daily equity (last snapshot per day)
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }

    const equityDays = Array.from(equityByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const equityValues = equityDays.map(([, v]) => v);

    // Calculate returns
    const dailyReturns = calcDailyReturns(equityValues);
    const totalReturn = equityValues.length >= 2
      ? (equityValues[equityValues.length - 1] - equityValues[0]) / equityValues[0]
      : 0;

    // BTC return for same period
    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const startStr = startDate;
    const endStr = endDate;
    let btcStartPrice = 0;
    let btcEndPrice = 0;
    for (const [date, price] of btcByDate) {
      if (date >= startStr && btcStartPrice === 0) btcStartPrice = price;
      if (date <= endStr) btcEndPrice = price;
    }
    const btcReturn = btcStartPrice > 0 ? (btcEndPrice - btcStartPrice) / btcStartPrice : 0;

    // Equity curve (normalized to cumulative return %)
    const equityCurve = equityDays.map(([time, value]) => ({
      time,
      value: equityValues[0] > 0 ? ((value - equityValues[0]) / equityValues[0]) * 100 : 0,
    }));

    // BTC curve (aligned to same dates)
    const btcCurve: { time: string; value: number }[] = [];
    const btcFirst = btcByDate.get(equityDays[0]?.[0] ?? "") ?? btcStartPrice;
    for (const [day] of equityDays) {
      const btcPrice = btcByDate.get(day);
      if (btcPrice && btcFirst > 0) {
        btcCurve.push({ time: day, value: ((btcPrice - btcFirst) / btcFirst) * 100 });
      }
    }

    // Monthly returns
    const monthlyMap = new Map<string, number[]>();
    for (let i = 0; i < dailyReturns.length; i++) {
      const [date] = equityDays[i + 1] || [];
      if (!date) continue;
      const [y, m] = date.split("-");
      const key = `${y}-${m}`;
      if (!monthlyMap.has(key)) monthlyMap.set(key, []);
      monthlyMap.get(key)!.push(dailyReturns[i]);
    }

    const monthlyReturns = Array.from(monthlyMap.entries()).map(([key, returns]) => {
      const [y, m] = key.split("-");
      const compoundReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
      return { year: parseInt(y), month: parseInt(m), return: Math.round(compoundReturn * 10000) / 100 };
    });

    // Trades analysis
    const trades = pnlData.list.map((t) => {
      const pnl = parseFloat(t.closedPnl);
      const entry = parseFloat(t.avgEntryPrice);
      const exit = parseFloat(t.avgExitPrice);
      const pnlPct = entry > 0 ? ((exit - entry) / entry) * (t.side === "Buy" ? 1 : -1) * 100 : 0;
      const holdingMs = parseInt(t.updatedTime) - parseInt(t.createdTime);
      return {
        symbol: t.symbol.replace("USDT", ""),
        side: t.side,
        entryPrice: entry,
        exitPrice: exit,
        pnlPercent: Math.round(pnlPct * 100) / 100,
        holdingHours: Math.round(holdingMs / (1000 * 60 * 60) * 10) / 10,
        closedAt: new Date(parseInt(t.updatedTime)).toISOString(),
        // suppress unused variable warning
        _pnl: pnl,
      };
    });

    const wins = trades.filter((t) => t.pnlPercent > 0);
    const topWins = [...trades].sort((a, b) => b.pnlPercent - a.pnlPercent).slice(0, 5);
    const topLosses = [...trades].sort((a, b) => a.pnlPercent - b.pnlPercent).slice(0, 5);

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      totalReturn: Math.round(totalReturn * 10000) / 100,
      sharpeRatio: Math.round(calcSharpeRatio(dailyReturns) * 100) / 100,
      sortinoRatio: Math.round(calcSortinoRatio(dailyReturns) * 100) / 100,
      maxDrawdown: Math.round(calcMaxDrawdown(equityValues) * 10000) / 100,
      totalTrades: trades.length,
      winRate: trades.length > 0 ? Math.round((wins.length / trades.length) * 10000) / 100 : 0,
      btcReturn: Math.round(btcReturn * 10000) / 100,
      alpha: Math.round((totalReturn - btcReturn) * 10000) / 100,
      equityCurve,
      btcCurve,
      monthlyReturns,
      topWins,
      topLosses,
      var95: Math.round(historicalVaR(dailyReturns, 0.95) * 10000) / 100,
    });
  } catch (error) {
    console.error("Report summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
