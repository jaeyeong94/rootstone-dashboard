import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import { pearsonCorrelation, pricesToReturns } from "@/lib/math/correlation";
import {
  loadBenchmarkReturns,
  getAvailableBenchmarks,
  calcAssetMetrics,
} from "@/lib/math/benchmarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Cap Bybit kline to 1000 candles (single page, avoids pagination timeout).
    // 1000 daily candles ≈ 2.7 years — more than enough for correlation and
    // cumulative return curves while staying within Vercel function timeout.
    const KLINE_LIMIT = 1000;

    // Parallelize all external I/O: DB + BTC + ETH
    const [rebetaRows, btcData, ethResult] = await Promise.all([
      getDailyReturns(),
      getDailyClosePrices("BTCUSDT", KLINE_LIMIT),
      getDailyClosePrices("ETHUSDT", KLINE_LIMIT).catch((e) => {
        console.error("ETH kline fetch failed, skipping ETH:", e);
        return [] as { time: string; close: number }[];
      }),
    ]);
    const ethData = ethResult;

    if (rebetaRows.length < 2) {
      return NextResponse.json({ error: "Insufficient Rebeta data" }, { status: 404 });
    }

    // Build Rebeta return-by-date map
    const rebetaReturns = rebetaRows.map((r) => r.dailyReturn);
    const rebetaDays = rebetaRows.map((r) => r.date);

    const rebetaReturnsByDate = new Map<string, number>();
    for (const row of rebetaRows) {
      rebetaReturnsByDate.set(row.date, row.dailyReturn);
    }

    // BTC returns
    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const btcPricesAligned: number[] = [];
    const btcAlignedDates: string[] = [];
    for (const day of rebetaDays) {
      const btcClose = btcByDate.get(day);
      if (btcClose !== undefined) {
        btcPricesAligned.push(btcClose);
        btcAlignedDates.push(day);
      }
    }
    const btcReturns = pricesToReturns(btcPricesAligned);

    // Load all benchmarks
    const benchmarks = getAvailableBenchmarks();
    const benchmarkResults: {
      symbol: string;
      name: string;
      cumulativeReturn: number;
      cagr: number;
      volatility: number;
      sharpe: number;
      maxDrawdown: number;
      correlationWithRebeta: number;
    }[] = [];

    // Cumulative return curves for chart
    const cumulativeCurves: Record<string, { date: string; value: number }[]> =
      {};

    // Rebeta metrics (from daily_returns dailyReturn values)
    const rebetaMetrics = calcAssetMetrics(rebetaReturns, rebetaReturns.length);

    // Build Rebeta cumulative curve
    const rebetaCumCurve: { date: string; value: number }[] = [];
    let rebetaCum = 1;
    for (let i = 0; i < rebetaReturns.length; i++) {
      rebetaCum *= 1 + rebetaReturns[i];
      rebetaCumCurve.push({
        date: rebetaDays[i],
        value: Math.round((rebetaCum - 1) * 10000) / 10000,
      });
    }
    cumulativeCurves["Rebeta"] = rebetaCumCurve;

    // BTC metrics and cumulative curve (aligned to Rebeta date range)
    const btcMetrics = calcAssetMetrics(btcReturns, btcReturns.length);
    const btcReturnDatesAll = btcAlignedDates.slice(1);
    const btcCumCurve: { date: string; value: number }[] = [];
    let btcCum = 1;
    for (let i = 0; i < btcReturns.length; i++) {
      btcCum *= 1 + btcReturns[i];
      if (btcReturnDatesAll[i]) {
        btcCumCurve.push({
          date: btcReturnDatesAll[i],
          value: Math.round((btcCum - 1) * 10000) / 10000,
        });
      }
    }
    cumulativeCurves["BTC"] = btcCumCurve;

    // BTC correlation with Rebeta (align by date)
    const btcReturnsByDate = new Map<string, number>();
    const btcReturnDates = btcAlignedDates.slice(1);
    for (let i = 0; i < btcReturns.length; i++) {
      btcReturnsByDate.set(btcReturnDates[i], btcReturns[i]);
    }

    // Aligned BTC-Rebeta correlation
    const alignedRebetaForBtc: number[] = [];
    const alignedBtcForRebeta: number[] = [];
    for (const date of rebetaDays) {
      const btcR = btcReturnsByDate.get(date);
      const rebetaR = rebetaReturnsByDate.get(date);
      if (btcR !== undefined && rebetaR !== undefined) {
        alignedRebetaForBtc.push(rebetaR);
        alignedBtcForRebeta.push(btcR);
      }
    }
    const btcCorrelation = pearsonCorrelation(
      alignedRebetaForBtc,
      alignedBtcForRebeta
    );

    benchmarkResults.push({
      symbol: "BTC",
      name: "Bitcoin",
      ...btcMetrics,
      correlationWithRebeta: Math.round(btcCorrelation * 10000) / 10000,
    });

    // ETH metrics and cumulative curve (same pattern as BTC)
    if (ethData.length > 0) {
      try {
        const ethByDate = new Map(ethData.map((d) => [d.time, d.close]));
        const ethPricesAligned: number[] = [];
        const ethAlignedDates: string[] = [];
        for (const day of rebetaDays) {
          const ethClose = ethByDate.get(day);
          if (ethClose !== undefined) {
            ethPricesAligned.push(ethClose);
            ethAlignedDates.push(day);
          }
        }
        const ethReturns = pricesToReturns(ethPricesAligned);

        const ethMetrics = calcAssetMetrics(ethReturns, ethReturns.length);
        const ethReturnDatesAll = ethAlignedDates.slice(1);
        const ethCumCurve: { date: string; value: number }[] = [];
        let ethCum = 1;
        for (let i = 0; i < ethReturns.length; i++) {
          ethCum *= 1 + ethReturns[i];
          if (ethReturnDatesAll[i]) {
            ethCumCurve.push({
              date: ethReturnDatesAll[i],
              value: Math.round((ethCum - 1) * 10000) / 10000,
            });
          }
        }
        cumulativeCurves["ETH"] = ethCumCurve;

        const ethReturnsByDate = new Map<string, number>();
        const ethReturnDates = ethAlignedDates.slice(1);
        for (let i = 0; i < ethReturns.length; i++) {
          ethReturnsByDate.set(ethReturnDates[i], ethReturns[i]);
        }

        const alignedRebetaForEth: number[] = [];
        const alignedEthForRebeta: number[] = [];
        for (const date of rebetaDays) {
          const ethR = ethReturnsByDate.get(date);
          const rebetaR = rebetaReturnsByDate.get(date);
          if (ethR !== undefined && rebetaR !== undefined) {
            alignedRebetaForEth.push(rebetaR);
            alignedEthForRebeta.push(ethR);
          }
        }
        const ethCorrelation = pearsonCorrelation(
          alignedRebetaForEth,
          alignedEthForRebeta
        );

        benchmarkResults.push({
          symbol: "ETH",
          name: "Ethereum",
          ...ethMetrics,
          correlationWithRebeta: Math.round(ethCorrelation * 10000) / 10000,
        });
      } catch (e) {
        console.error("ETH processing failed, skipping:", e);
      }
    }

    // Process each traditional benchmark
    for (const bm of benchmarks) {
      const bmData = loadBenchmarkReturns(bm.symbol);
      const bmMetrics = calcAssetMetrics(bmData.returns, bmData.returns.length);

      // Align benchmark returns with Rebeta returns by date
      const bmReturnsByDate = new Map<string, number>();
      for (let i = 0; i < bmData.returns.length; i++) {
        bmReturnsByDate.set(bmData.dates[i], bmData.returns[i]);
      }

      const alignedRebeta: number[] = [];
      const alignedBm: number[] = [];
      for (const date of rebetaDays) {
        const bmR = bmReturnsByDate.get(date);
        const rebetaR = rebetaReturnsByDate.get(date);
        if (bmR !== undefined && rebetaR !== undefined) {
          alignedRebeta.push(rebetaR);
          alignedBm.push(bmR);
        }
      }

      const correlation = pearsonCorrelation(alignedRebeta, alignedBm);

      benchmarkResults.push({
        symbol: bm.symbol,
        name: bm.name,
        ...bmMetrics,
        correlationWithRebeta: Math.round(correlation * 10000) / 10000,
      });

      // Cumulative curve (aligned to Rebeta date range)
      const cumCurve: { date: string; value: number }[] = [];
      let cum = 1;
      const startDate = rebetaDays[0];
      const endDate = rebetaDays[rebetaDays.length - 1];
      for (let i = 0; i < bmData.dates.length; i++) {
        if (bmData.dates[i] < startDate) continue;
        if (bmData.dates[i] > endDate) break;
        cum *= 1 + bmData.returns[i];
        cumCurve.push({
          date: bmData.dates[i],
          value: Math.round((cum - 1) * 10000) / 10000,
        });
      }
      cumulativeCurves[bm.symbol] = cumCurve;
    }

    // Round Rebeta metrics
    const roundedRebeta = {
      symbol: "Rebeta",
      name: "Rebeta v3.1",
      cumulativeReturn:
        Math.round(rebetaMetrics.cumulativeReturn * 10000) / 10000,
      cagr: Math.round(rebetaMetrics.cagr * 10000) / 10000,
      volatility: Math.round(rebetaMetrics.volatility * 10000) / 10000,
      sharpe: Math.round(rebetaMetrics.sharpe * 1000) / 1000,
      maxDrawdown: Math.round(rebetaMetrics.maxDrawdown * 10000) / 10000,
      correlationWithRebeta: 1,
    };

    // Round benchmark results
    const roundedBenchmarks = benchmarkResults.map((b) => ({
      ...b,
      cumulativeReturn: Math.round(b.cumulativeReturn * 10000) / 10000,
      cagr: Math.round(b.cagr * 10000) / 10000,
      volatility: Math.round(b.volatility * 10000) / 10000,
      sharpe: Math.round(b.sharpe * 1000) / 1000,
      maxDrawdown: Math.round(b.maxDrawdown * 10000) / 10000,
    }));

    return NextResponse.json({
      rebeta: roundedRebeta,
      benchmarks: roundedBenchmarks,
      cumulativeCurves,
      dataRange: {
        start: rebetaDays[0],
        end: rebetaDays[rebetaDays.length - 1],
        days: rebetaDays.length,
      },
    });
  } catch (error) {
    console.error("Benchmark comparison error:", error);
    return NextResponse.json(
      { error: "Failed to calculate benchmark comparison" },
      { status: 500 }
    );
  }
}
