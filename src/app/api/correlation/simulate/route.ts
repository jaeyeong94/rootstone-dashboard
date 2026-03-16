import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import { pricesToReturns } from "@/lib/math/correlation";
import {
  blendedEquityCurve,
  calcPortfolioMetrics,
} from "@/lib/math/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const btcWeightPct = Math.min(
    Math.max(parseInt(searchParams.get("btcWeight") ?? "60", 10), 0),
    100
  );
  const rebetaWeightPct = Math.min(
    Math.max(parseInt(searchParams.get("rebetaWeight") ?? "40", 10), 0),
    100
  );
  const period = Math.min(
    Math.max(parseInt(searchParams.get("period") ?? "365", 10), 30),
    365
  );

  // Normalize weights to sum to 1
  const totalWeight = btcWeightPct + rebetaWeightPct;
  const btcWeight = totalWeight > 0 ? btcWeightPct / totalWeight : 0.5;
  const rebetaWeight = totalWeight > 0 ? rebetaWeightPct / totalWeight : 0.5;

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
    const commonDates: string[] = [];
    for (const day of rebetaDays) {
      const btcClose = btcByDate.get(day);
      if (btcClose !== undefined) {
        btcPrices.push(btcClose);
        commonDates.push(day);
      }
    }

    if (commonDates.length < 5) {
      return NextResponse.json({
        equityCurve: [],
        metrics: { btcOnly: null, mixed: null, rebetaOnly: null },
        days: 0,
      });
    }

    const btcReturns = pricesToReturns(btcPrices);
    const btcReturnDates = commonDates.slice(1);
    const rebetaReturns: number[] = [];
    for (const date of btcReturnDates) {
      rebetaReturns.push(rebetaReturnsByDate.get(date) ?? 0);
    }
    const days = btcReturns.length;
    const dates = btcReturnDates;

    // Three equity curves: pure BTC, mixed, pure Rebeta
    const btcOnlyCurve = blendedEquityCurve(btcReturns, rebetaReturns, 1.0);
    const mixedCurve = blendedEquityCurve(btcReturns, rebetaReturns, btcWeight);
    const rebetaOnlyCurve = blendedEquityCurve(btcReturns, rebetaReturns, 0.0);

    const btcOnlyMetrics = calcPortfolioMetrics(btcOnlyCurve, days);
    const mixedMetrics = calcPortfolioMetrics(mixedCurve, days);
    const rebetaOnlyMetrics = calcPortfolioMetrics(rebetaOnlyCurve, days);

    // Build equity curve with dates for charting
    const equityCurve = dates.map((time, i) => ({
      time,
      btcOnly: Math.round(btcOnlyCurve[i + 1] * 10000) / 10000,
      mixed: Math.round(mixedCurve[i + 1] * 10000) / 10000,
      rebetaOnly: Math.round(rebetaOnlyCurve[i + 1] * 10000) / 10000,
    }));

    const roundMetrics = (m: ReturnType<typeof calcPortfolioMetrics>) => ({
      cumulativeReturn: Math.round(m.cumulativeReturn * 10000) / 10000,
      cagr: Math.round(m.cagr * 10000) / 10000,
      sharpe: Math.round(m.sharpe * 1000) / 1000,
      sortino: Math.round(m.sortino * 1000) / 1000,
      maxDrawdown: Math.round(m.maxDrawdown * 10000) / 10000,
      volatility: Math.round(m.volatility * 10000) / 10000,
    });

    return NextResponse.json({
      equityCurve,
      metrics: {
        btcOnly: roundMetrics(btcOnlyMetrics),
        mixed: roundMetrics(mixedMetrics),
        rebetaOnly: roundMetrics(rebetaOnlyMetrics),
      },
      weights: {
        btc: Math.round(btcWeight * 100),
        rebeta: Math.round(rebetaWeight * 100),
      },
      days,
    });
  } catch (error) {
    console.error("Portfolio simulation error:", error);
    return NextResponse.json(
      { error: "Failed to simulate portfolio" },
      { status: 500 }
    );
  }
}
