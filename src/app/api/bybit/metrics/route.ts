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
    const snapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt));

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
      // 첫 스냅샷 날짜를 startTime으로 사용해 전체 기간 데이터 수집
      const startTime =
        snapshots.length > 0
          ? String(new Date(snapshots[0].snapshotAt).getTime())
          : undefined;

      // 전체 페이지 순회 (cursor 기반 페이지네이션)
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
        // fill 단위 → 포지션(close event) 단위로 집계
        // 같은 symbol + 1분 버킷 = 동일 포지션 close event
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
