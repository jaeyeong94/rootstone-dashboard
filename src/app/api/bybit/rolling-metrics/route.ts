import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import {
  calcDailyReturns,
  calcSharpeRatio,
  calcRollingValues,
} from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function calcVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const window = parseInt(searchParams.get("window") || "30");

  try {
    const snapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt));

    // Deduplicate: keep last snapshot per day
    const byDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      byDay.set(day, s.totalEquity);
    }

    if (byDay.size < window + 1) {
      return NextResponse.json({ sharpe: [], volatility: [] });
    }

    const equities = Array.from(byDay.values());
    const times = Array.from(byDay.keys());
    const dailyReturns = calcDailyReturns(equities);
    const returnTimes = times.slice(1);

    const sharpe = calcRollingValues(
      dailyReturns,
      returnTimes,
      window,
      calcSharpeRatio
    );
    const volatility = calcRollingValues(
      dailyReturns,
      returnTimes,
      window,
      calcVolatility
    );

    return NextResponse.json({ sharpe, volatility });
  } catch (error) {
    console.error("Rolling metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate rolling metrics" },
      { status: 500 }
    );
  }
}
