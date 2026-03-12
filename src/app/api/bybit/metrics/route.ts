import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { getClosedPnl } from "@/lib/bybit/client";
import {
  calcSharpeRatio,
  calcSortinoRatio,
  calcMaxDrawdown,
  calcDailyReturns,
} from "@/lib/utils";
import type { StrategyMetrics } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshots = getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt))
      .all();

    const equities = snapshots.map((s) => s.totalEquity);
    const dailyReturns = calcDailyReturns(equities);

    const sharpeRatio = calcSharpeRatio(dailyReturns);
    const sortinoRatio = calcSortinoRatio(dailyReturns);
    const maxDrawdown = calcMaxDrawdown(equities);
    const totalReturn =
      equities.length >= 2
        ? (equities[equities.length - 1] - equities[0]) / equities[0]
        : 0;

    let winRate = 0;
    let totalTrades = 0;
    let avgHoldingHours = 0;

    try {
      const pnlData = await getClosedPnl({ limit: "200" });
      const trades = pnlData.list;
      totalTrades = trades.length;

      if (totalTrades > 0) {
        const wins = trades.filter((t) => parseFloat(t.closedPnl) > 0).length;
        winRate = wins / totalTrades;

        const holdingTimes = trades
          .map((t) => {
            const created = parseInt(t.createdTime);
            const updated = parseInt(t.updatedTime);
            return (updated - created) / (1000 * 60 * 60);
          })
          .filter((h) => h > 0 && h < 24 * 365);

        avgHoldingHours =
          holdingTimes.length > 0
            ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length
            : 0;
      }
    } catch {
      // If PnL API fails, continue with calculated metrics
    }

    const metrics: StrategyMetrics = {
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
      winRate: parseFloat((winRate * 100).toFixed(1)),
      avgHoldingHours: parseFloat(avgHoldingHours.toFixed(1)),
      totalReturn: parseFloat((totalReturn * 100).toFixed(2)),
      totalTrades,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Metrics calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate metrics" },
      { status: 500 }
    );
  }
}
