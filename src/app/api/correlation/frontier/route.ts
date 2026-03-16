import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";
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
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const [btcData, rebetaRows] = await Promise.all([
      getDailyClosePrices("BTCUSDT", period + 5),
      getDailyReturns({ from: cutoff }),
    ]);

    // Build Rebeta return-by-date map
    const rebetaReturnsByDate = new Map<string, number>();
    for (const row of rebetaRows) {
      rebetaReturnsByDate.set(row.date, row.dailyReturn);
    }

    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const rebetaDays = rebetaRows.map((r) => r.date);

    // Align BTC prices on Rebeta dates
    const btcPrices: number[] = [];
    const alignedDates: string[] = [];
    for (const day of rebetaDays) {
      const btcClose = btcByDate.get(day);
      if (btcClose !== undefined) {
        btcPrices.push(btcClose);
        alignedDates.push(day);
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
    // Align Rebeta returns to BTC return dates
    const btcReturnDates = alignedDates.slice(1);
    const rebetaReturns: number[] = [];
    for (const date of btcReturnDates) {
      rebetaReturns.push(rebetaReturnsByDate.get(date) ?? 0);
    }
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
