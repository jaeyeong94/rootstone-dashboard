import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
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
    // Fetch Rebeta equity + BTC prices in parallel
    const [snapshots, btcData] = await Promise.all([
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .orderBy(asc(balanceSnapshots.snapshotAt)),
      getDailyClosePrices("BTCUSDT", 400),
    ]);

    // Build Rebeta daily equity map
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }
    const equityDays = Array.from(equityByDay.keys()).sort();
    const rebetaEquityArr = equityDays.map((d) => equityByDay.get(d)!);
    const rebetaReturns = pricesToReturns(rebetaEquityArr);
    const rebetaDays = equityDays.slice(1); // return dates

    // BTC returns
    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const btcPricesAligned: number[] = [];
    const btcAlignedDates: string[] = [];
    for (const day of equityDays) {
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

    // Rebeta metrics
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

    // BTC metrics and cumulative curve
    const btcMetrics = calcAssetMetrics(btcReturns, btcReturns.length);
    const btcCumCurve: { date: string; value: number }[] = [];
    let btcCum = 1;
    for (let i = 0; i < btcReturns.length; i++) {
      btcCum *= 1 + btcReturns[i];
      btcCumCurve.push({
        date: btcAlignedDates.slice(1)[i],
        value: Math.round((btcCum - 1) * 10000) / 10000,
      });
    }
    cumulativeCurves["BTC"] = btcCumCurve;

    // BTC correlation with Rebeta (align by date)
    const btcReturnsByDate = new Map<string, number>();
    const btcReturnDates = btcAlignedDates.slice(1);
    for (let i = 0; i < btcReturns.length; i++) {
      btcReturnsByDate.set(btcReturnDates[i], btcReturns[i]);
    }

    const rebetaReturnsByDate = new Map<string, number>();
    for (let i = 0; i < rebetaReturns.length; i++) {
      rebetaReturnsByDate.set(rebetaDays[i], rebetaReturns[i]);
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
      // Use only dates that overlap with Rebeta period
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
