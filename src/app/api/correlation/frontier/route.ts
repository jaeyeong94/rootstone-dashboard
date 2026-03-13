import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import { pricesToReturns } from "@/lib/math/correlation";
import {
  efficientFrontier,
  optimalSharpePortfolio,
} from "@/lib/math/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = Math.min(
    Math.max(parseInt(searchParams.get("period") ?? "365", 10), 30),
    365
  );

  try {
    const [btcData, snapshots] = await Promise.all([
      getDailyClosePrices("BTCUSDT", period + 5),
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .orderBy(asc(balanceSnapshots.snapshotAt)),
    ]);

    // Build daily equity map
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }

    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const equityDays = Array.from(equityByDay.keys()).sort();
    const btcPrices: number[] = [];
    const rebetaEquity: number[] = [];

    for (const day of equityDays) {
      if (day < cutoff) continue;
      const btcClose = btcByDate.get(day);
      const equity = equityByDay.get(day);
      if (btcClose !== undefined && equity !== undefined) {
        btcPrices.push(btcClose);
        rebetaEquity.push(equity);
      }
    }

    if (btcPrices.length < 5) {
      return NextResponse.json({
        frontier: [],
        optimal: { btcWeight: 50, rebetaWeight: 50 },
        days: 0,
      });
    }

    const btcReturns = pricesToReturns(btcPrices);
    const rebetaReturns = pricesToReturns(rebetaEquity);
    const days = btcReturns.length;

    // Generate frontier with 21 steps (0%, 5%, 10%, ..., 100% BTC)
    const frontier = efficientFrontier(btcReturns, rebetaReturns, days, 21);
    const optimal = optimalSharpePortfolio(frontier);

    const roundedFrontier = frontier.map((p) => ({
      btcWeight: p.btcWeight,
      rebetaWeight: p.rebetaWeight,
      expectedReturn: Math.round(p.expectedReturn * 10000) / 10000,
      volatility: Math.round(p.volatility * 10000) / 10000,
      sharpe: Math.round(p.sharpe * 1000) / 1000,
    }));

    return NextResponse.json({
      frontier: roundedFrontier,
      optimal,
      days,
    });
  } catch (error) {
    console.error("Efficient frontier error:", error);
    return NextResponse.json(
      { error: "Failed to calculate efficient frontier" },
      { status: 500 }
    );
  }
}
