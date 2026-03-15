import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClosedPnl } from "@/lib/bybit/client";
import { getDailyReturnsSinceV31 } from "@/lib/daily-returns";
import {
  calcSharpeRatio,
  calcSortinoRatio,
  calcMaxDrawdown,
} from "@/lib/utils";
import type { StrategyMetrics } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await getDailyReturnsSinceV31();

    const returns = rows.map((r) => r.dailyReturn);
    const navSeries = rows.map((r) => r.navIndex);

    const sharpeRatio = calcSharpeRatio(returns);
    const sortinoRatio = calcSortinoRatio(returns);
    const maxDrawdown = calcMaxDrawdown(navSeries);
    const totalReturn =
      navSeries.length >= 2
        ? (navSeries[navSeries.length - 1] - navSeries[0]) / navSeries[0]
        : 0;

    let winRate = 0;
    let totalTrades = 0;
    let avgHoldingHours = 0;

    try {
      const startTime = rows.length > 0
        ? String(new Date(rows[0].date + "T00:00:00Z").getTime())
        : undefined;

      const allFills: import("@/types").BybitClosedPnl[] = [];
      let cursor: string | undefined;
      do {
        const page = await getClosedPnl({
          limit: "200",
          ...(startTime ? { startTime } : {}),
          ...(cursor ? { cursor } : {}),
        });
        allFills.push(...page.list);
        cursor = page.nextPageCursor || undefined;
      } while (cursor);

      totalTrades = allFills.length;

      if (totalTrades > 0) {
        const posMap = new Map<string, { pnl: number; created: number; updated: number }>();
        for (const t of allFills) {
          const minuteBucket = Math.floor(parseInt(t.updatedTime) / 60000);
          const key = `${t.symbol}_${minuteBucket}`;
          const existing = posMap.get(key);
          if (existing) {
            existing.pnl += parseFloat(t.closedPnl);
            existing.updated = Math.max(existing.updated, parseInt(t.updatedTime));
          } else {
            posMap.set(key, {
              pnl: parseFloat(t.closedPnl),
              created: parseInt(t.createdTime),
              updated: parseInt(t.updatedTime),
            });
          }
        }

        const positions = Array.from(posMap.values());
        const wins = positions.filter((p) => p.pnl > 0).length;
        winRate = wins / positions.length;
        totalTrades = positions.length;

        const holdingTimes = positions
          .map((p) => (p.updated - p.created) / (1000 * 60 * 60))
          .filter((h) => h > 0 && h < 24 * 365);

        avgHoldingHours =
          holdingTimes.length > 0
            ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length
            : 0;
      }
    } catch {
      // PnL API 실패 시 다른 지표는 계속 반환
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
