import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";
import { calcSharpeRatio, calcRollingValues } from "@/lib/utils";

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
    const rows = await getDailyReturns();

    if (rows.length < window + 1) {
      return NextResponse.json({ sharpe: [], volatility: [] });
    }

    const returns = rows.map((r) => r.dailyReturn);
    const times = rows.map((r) => r.date);

    const sharpe = calcRollingValues(returns, times, window, calcSharpeRatio);
    const volatility = calcRollingValues(returns, times, window, calcVolatility);

    return NextResponse.json({ sharpe, volatility });
  } catch (error) {
    console.error("Rolling metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate rolling metrics" },
      { status: 500 }
    );
  }
}
