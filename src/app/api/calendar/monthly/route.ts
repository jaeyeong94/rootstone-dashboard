import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc, and, gte, lte } from "drizzle-orm";
import { getClosedPnl } from "@/lib/bybit/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const [snapshots, pnlData] = await Promise.all([
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .where(and(
          gte(balanceSnapshots.snapshotAt, startDate),
          lte(balanceSnapshots.snapshotAt, endDate)
        ))
        .orderBy(asc(balanceSnapshots.snapshotAt)),
      getClosedPnl({
        startTime: String(startDate.getTime()),
        endTime: String(endDate.getTime()),
        limit: "100",
      }),
    ]);

    // Build daily equity map
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }

    // Group trades by day
    const tradesByDay = new Map<string, typeof pnlData.list>();
    for (const trade of pnlData.list) {
      const day = new Date(parseInt(trade.updatedTime)).toISOString().split("T")[0];
      if (!tradesByDay.has(day)) tradesByDay.set(day, []);
      tradesByDay.get(day)!.push(trade);
    }

    // Build calendar days
    const days: {
      date: string;
      dailyReturn: number;
      tradeCount: number;
      positionsOpened: number;
      positionsClosed: number;
      topTrade: { symbol: string; pnlPercent: number } | null;
    }[] = [];

    const equityDays = Array.from(equityByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (let i = 0; i < equityDays.length; i++) {
      const [date, equity] = equityDays[i];
      const prevEquity = i > 0 ? equityDays[i - 1][1] : equity;
      const dailyReturn = prevEquity > 0 ? ((equity - prevEquity) / prevEquity) * 100 : 0;

      const dayTrades = tradesByDay.get(date) ?? [];

      // Find top trade by PnL %
      let topTrade: { symbol: string; pnlPercent: number } | null = null;
      for (const t of dayTrades) {
        const entry = parseFloat(t.avgEntryPrice);
        const exit = parseFloat(t.avgExitPrice);
        const pnlPct = entry > 0 ? ((exit - entry) / entry) * (t.side === "Buy" ? 1 : -1) * 100 : 0;
        if (!topTrade || Math.abs(pnlPct) > Math.abs(topTrade.pnlPercent)) {
          topTrade = {
            symbol: t.symbol.replace("USDT", ""),
            pnlPercent: Math.round(pnlPct * 100) / 100,
          };
        }
      }

      days.push({
        date,
        dailyReturn: Math.round(dailyReturn * 100) / 100,
        tradeCount: dayTrades.length,
        positionsOpened: dayTrades.filter((t) => t.side === "Buy").length,
        positionsClosed: dayTrades.filter((t) => t.side === "Sell").length,
        topTrade,
      });
    }

    // Summary
    const returns = days.map((d) => d.dailyReturn);
    const wins = returns.filter((r) => r > 0);
    const bestDay = days.reduce(
      (best, d) => (d.dailyReturn > (best?.dailyReturn ?? -Infinity) ? d : best),
      days[0]
    );
    const worstDay = days.reduce(
      (worst, d) => (d.dailyReturn < (worst?.dailyReturn ?? Infinity) ? d : worst),
      days[0]
    );
    const totalReturn = returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;

    return NextResponse.json({
      year,
      month,
      days,
      summary: {
        totalReturn: Math.round(totalReturn * 10000) / 100,
        tradingDays: days.length,
        winRate: days.length > 0 ? Math.round((wins.length / days.length) * 10000) / 100 : 0,
        bestDay: bestDay ? { date: bestDay.date, return: bestDay.dailyReturn } : null,
        worstDay: worstDay ? { date: worstDay.date, return: worstDay.dailyReturn } : null,
      },
    });
  } catch (error) {
    console.error("Calendar monthly error:", error);
    return NextResponse.json(
      { error: "Failed to load calendar data" },
      { status: 500 }
    );
  }
}
