import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import { pricesToReturns } from "@/lib/math/correlation";
import { calcSharpeRatio, calcRollingValues } from "@/lib/utils";
import { ANNUALIZATION_DAYS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function calcVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(ANNUALIZATION_DAYS) * 100;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const window = parseInt(searchParams.get("window") || "30");

  try {
    const rows = await getDailyReturns();

    if (rows.length < window + 1) {
      return NextResponse.json({ sharpe: [], volatility: [] });
    }

    const returns = rows.map((r) => r.dailyReturn);
    const times = rows.map((r) => r.date);

    const sharpe = calcRollingValues(returns, times, window, calcSharpeRatio);
    const volatility = calcRollingValues(returns, times, window, calcVolatility);

    // BTC rolling Sharpe (kline → daily returns → rolling calc)
    let btcSharpe: { time: string; value: number }[] = [];
    try {
      const btcData = await getDailyClosePrices("BTCUSDT", rows.length + 10);
      const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
      const btcPrices: number[] = [];
      const btcDates: string[] = [];
      for (const day of times) {
        const p = btcByDate.get(day);
        if (p !== undefined) { btcPrices.push(p); btcDates.push(day); }
      }
      const btcReturns = pricesToReturns(btcPrices);
      const btcRetDates = btcDates.slice(1);
      if (btcReturns.length > window) {
        btcSharpe = calcRollingValues(btcReturns, btcRetDates, window, calcSharpeRatio);
      }
    } catch { /* BTC data optional */ }

    return NextResponse.json({ sharpe, volatility, btcSharpe });
  } catch (error) {
    console.error("Rolling metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate rolling metrics" },
      { status: 500 }
    );
  }
}
