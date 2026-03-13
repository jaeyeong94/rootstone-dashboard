import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { pricesToReturns } from "@/lib/math/correlation";
import { estimateRegime, classifyDay } from "@/lib/math/regime";
import { realizedVolatility, mean } from "@/lib/math/statistics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch 95 days of data for 90-day analysis window
    const [btcData, ethData, xrpData, ltcData, snapshots] = await Promise.all([
      getDailyClosePrices("BTCUSDT", 95),
      getDailyClosePrices("ETHUSDT", 95),
      getDailyClosePrices("XRPUSDT", 95),
      getDailyClosePrices("LTCUSDT", 95),
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .orderBy(asc(balanceSnapshots.snapshotAt)),
    ]);

    // Convert prices to returns
    const btcPrices = btcData.map((d) => d.close);
    const ethPrices = ethData.map((d) => d.close);
    const xrpPrices = xrpData.map((d) => d.close);
    const ltcPrices = ltcData.map((d) => d.close);

    const btcReturns = pricesToReturns(btcPrices);
    const ethReturns = pricesToReturns(ethPrices);

    // Last 30 days for regime estimation
    const last30BtcReturns = btcReturns.slice(-30);
    const last30EthReturns = ethReturns.slice(-30);

    // 7-day returns for each asset
    const btc7dReturn =
      btcPrices.length >= 8
        ? ((btcPrices[btcPrices.length - 1] - btcPrices[btcPrices.length - 8]) /
            btcPrices[btcPrices.length - 8]) *
          100
        : 0;
    const eth7dReturn =
      ethPrices.length >= 8
        ? ((ethPrices[ethPrices.length - 1] - ethPrices[ethPrices.length - 8]) /
            ethPrices[ethPrices.length - 8]) *
          100
        : 0;
    const xrp7dReturn =
      xrpPrices.length >= 8
        ? ((xrpPrices[xrpPrices.length - 1] - xrpPrices[xrpPrices.length - 8]) /
            xrpPrices[xrpPrices.length - 8]) *
          100
        : 0;
    const ltc7dReturn =
      ltcPrices.length >= 8
        ? ((ltcPrices[ltcPrices.length - 1] - ltcPrices[ltcPrices.length - 8]) /
            ltcPrices[ltcPrices.length - 8]) *
          100
        : 0;

    // Estimate current regime
    const regimeResult = estimateRegime(
      last30BtcReturns,
      last30EthReturns,
      btc7dReturn,
      [btc7dReturn, eth7dReturn, xrp7dReturn, ltc7dReturn]
    );

    // Build daily equity map from DB snapshots
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }

    // Build 90-day timeline with regime classification
    const timeline: { date: string; regime: string; dailyReturn: number }[] = [];
    const btcDates = btcData.map((d) => d.time);

    for (let i = 30; i < btcReturns.length; i++) {
      const date = btcDates[i + 1]; // +1 because returns are offset by 1
      if (!date) continue;

      // Rolling 30-day volatility up to this point
      const rollingReturns = btcReturns.slice(Math.max(0, i - 29), i + 1);
      const vol = realizedVolatility(rollingReturns) * 100;

      // Rolling 7d return at this point
      const r7d =
        i >= 7
          ? ((btcPrices[i + 1] - btcPrices[i - 6]) / btcPrices[i - 6]) * 100
          : 0;

      const regime = classifyDay(vol, r7d);

      // Get daily strategy return from equity snapshots
      const prevDay = btcDates[i];
      const currEquity = equityByDay.get(date);
      const prevEquity = prevDay ? equityByDay.get(prevDay) : undefined;
      const dailyReturn =
        currEquity && prevEquity && prevEquity > 0
          ? ((currEquity - prevEquity) / prevEquity) * 100
          : 0;

      timeline.push({
        date,
        regime,
        dailyReturn: Math.round(dailyReturn * 100) / 100,
      });
    }

    // Regime performance stats
    const regimeGroups: Record<string, { returns: number[]; days: number }> = {
      core: { returns: [], days: 0 },
      crisis: { returns: [], days: 0 },
      challenging: { returns: [], days: 0 },
    };

    for (const day of timeline) {
      const group = regimeGroups[day.regime];
      if (group) {
        group.returns.push(day.dailyReturn);
        group.days++;
      }
    }

    const regimeStats = Object.entries(regimeGroups).map(([regime, data]) => ({
      regime,
      avgDailyReturn:
        data.returns.length > 0 ? Math.round(mean(data.returns) * 100) / 100 : 0,
      totalDays: data.days,
      totalReturn:
        data.returns.length > 0
          ? Math.round(data.returns.reduce((a, b) => a + b, 0) * 100) / 100
          : 0,
    }));

    return NextResponse.json({
      currentRegime: regimeResult.regime,
      confidence: Math.round(regimeResult.confidence * 100) / 100,
      indicators: regimeResult.indicators,
      timeline,
      regimeStats,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Regime API error:", error);
    return NextResponse.json(
      { error: "Failed to estimate market regime" },
      { status: 500 }
    );
  }
}
