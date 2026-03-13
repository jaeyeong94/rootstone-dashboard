import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { getKlines } from "@/lib/bybit/kline";
import { pricesToReturns } from "@/lib/math/correlation";
import { estimateRegime, classifyDay, RegimeType } from "@/lib/math/regime";
import { realizedVolatility } from "@/lib/math/statistics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch 90-day daily klines for BTC and ETH in parallel
    const [btcCandles, ethCandles] = await Promise.all([
      getKlines("BTCUSDT", "D", 90),
      getKlines("ETHUSDT", "D", 90),
    ]);

    // Extract close prices and aligned dates
    const btcData = btcCandles.map((c) => ({
      date: new Date(parseInt(c.startTime)).toISOString().split("T")[0],
      close: parseFloat(c.closePrice),
    }));
    const ethData = ethCandles.map((c) => ({
      date: new Date(parseInt(c.startTime)).toISOString().split("T")[0],
      close: parseFloat(c.closePrice),
    }));

    // Align dates (use intersection)
    const ethByDate = new Map(ethData.map((d) => [d.date, d.close]));
    const aligned = btcData.filter((d) => ethByDate.has(d.date));

    const btcPrices = aligned.map((d) => d.close);
    const ethPrices = aligned.map((d) => ethByDate.get(d.date)!);
    const dates = aligned.map((d) => d.date);

    const btcReturns = pricesToReturns(btcPrices);
    const ethReturns = pricesToReturns(ethPrices);
    // returns[i] corresponds to dates[i+1]
    const returnDates = dates.slice(1);

    // Current regime: last 30d of returns
    const last30btc = btcReturns.slice(-30);
    const last30eth = ethReturns.slice(-30);

    // 7d return for BTC: (price[last] / price[last-7] - 1) * 100
    const btcReturn7d =
      btcPrices.length >= 8
        ? ((btcPrices[btcPrices.length - 1] - btcPrices[btcPrices.length - 8]) /
            btcPrices[btcPrices.length - 8]) *
          100
        : 0;

    const regimeResult = estimateRegime(
      last30btc,
      last30eth,
      btcReturn7d,
      [btcReturn7d, btcReturn7d] // using BTC proxy for simplicity (only BTC/ETH available)
    );

    // Fetch strategy daily returns from DB
    const snapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt));

    // Deduplicate: last snapshot per day
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }
    const equityDays = Array.from(equityByDay.keys()).sort();
    const equityValues = equityDays.map((d) => equityByDay.get(d)!);

    // Strategy daily returns keyed by date
    const stratReturnByDate = new Map<string, number>();
    for (let i = 1; i < equityDays.length; i++) {
      const prev = equityValues[i - 1];
      const curr = equityValues[i];
      if (prev > 0) {
        stratReturnByDate.set(equityDays[i], ((curr - prev) / prev) * 100);
      }
    }

    // Build historical timeline using rolling 30d window volatility + 7d return
    const timeline: { date: string; regime: RegimeType; dailyReturn: number | null }[] = [];

    for (let i = 30; i < returnDates.length; i++) {
      const date = returnDates[i];
      const window30 = btcReturns.slice(i - 29, i + 1); // 30 returns ending at i
      const vol = realizedVolatility(window30) * 100; // annualized %

      // 7d return for this date: price change over previous 7 trading days
      const priceIdx = i + 1; // btcPrices index (returnDates[i] = dates[i+1])
      const sevenDayReturn =
        priceIdx >= 7
          ? ((btcPrices[priceIdx] - btcPrices[priceIdx - 7]) / btcPrices[priceIdx - 7]) * 100
          : 0;

      const regime = classifyDay(vol, sevenDayReturn);
      const dailyReturn = stratReturnByDate.get(date) ?? null;

      timeline.push({ date, regime, dailyReturn });
    }

    // Compute regime stats
    type RegimeStat = {
      totalReturn: number;
      totalDays: number;
      returnsWithData: number[];
    };
    const statsMap = new Map<RegimeType, RegimeStat>([
      ["core", { totalReturn: 0, totalDays: 0, returnsWithData: [] }],
      ["crisis", { totalReturn: 0, totalDays: 0, returnsWithData: [] }],
      ["challenging", { totalReturn: 0, totalDays: 0, returnsWithData: [] }],
    ]);

    for (const entry of timeline) {
      const stat = statsMap.get(entry.regime)!;
      stat.totalDays++;
      if (entry.dailyReturn !== null) {
        stat.returnsWithData.push(entry.dailyReturn);
        stat.totalReturn += entry.dailyReturn;
      }
    }

    const regimeStats = (["core", "challenging", "crisis"] as RegimeType[]).map((regime) => {
      const stat = statsMap.get(regime)!;
      const avgDailyReturn =
        stat.returnsWithData.length > 0
          ? stat.returnsWithData.reduce((a, b) => a + b, 0) / stat.returnsWithData.length
          : 0;
      return {
        regime,
        avgDailyReturn: Math.round(avgDailyReturn * 1000) / 1000,
        totalDays: stat.totalDays,
        totalReturn: Math.round(stat.totalReturn * 100) / 100,
      };
    });

    return NextResponse.json({
      currentRegime: regimeResult.regime,
      confidence: regimeResult.confidence,
      indicators: regimeResult.indicators,
      timeline,
      regimeStats,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Regime API error:", error);
    return NextResponse.json(
      { error: "Failed to calculate market regime" },
      { status: 500 }
    );
  }
}
