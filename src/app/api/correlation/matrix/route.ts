import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import {
  correlationMatrix,
  rollingCorrelation,
  pricesToReturns,
} from "@/lib/math/correlation";
import {
  loadBenchmarkReturns,
  getAvailableBenchmarks,
} from "@/lib/math/benchmarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLLING_WINDOW = 90;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = Math.min(
    Math.max(parseInt(searchParams.get("period") ?? "90", 10), 30),
    365
  );

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    // Fetch Rebeta daily returns + BTC prices
    const [rebetaRows, btcData] = await Promise.all([
      getDailyReturns({ from: cutoff }),
      getDailyClosePrices("BTCUSDT", period + 5),
    ]);

    // ETH: fetch separately so failure doesn't block everything
    let ethData: { time: string; close: number }[] = [];
    try {
      ethData = await getDailyClosePrices("ETHUSDT", period + 5);
    } catch (e) {
      console.error("ETH kline fetch failed in matrix, skipping:", e);
    }

    // Build Rebeta return-by-date map
    const rebetaReturnsByDate = new Map<string, number>();
    for (const row of rebetaRows) {
      rebetaReturnsByDate.set(row.date, row.dailyReturn);
    }
    const rebetaDays = rebetaRows.map((r) => r.date);

    // BTC/ETH price-by-date maps
    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const ethByDate = new Map(ethData.map((d) => [d.time, d.close]));
    const hasEth = ethData.length > 0;

    // Align BTC prices on Rebeta dates (ETH independently)
    const btcPricesAligned: number[] = [];
    const ethPricesAligned: number[] = [];
    const commonPriceDates: string[] = [];
    for (const day of rebetaDays) {
      const btcClose = btcByDate.get(day);
      if (btcClose !== undefined) {
        btcPricesAligned.push(btcClose);
        if (hasEth) {
          const ethClose = ethByDate.get(day);
          ethPricesAligned.push(ethClose ?? btcClose); // fallback to prevent misalignment
        }
        commonPriceDates.push(day);
      }
    }

    const btcReturns = pricesToReturns(btcPricesAligned);
    const ethReturns = hasEth ? pricesToReturns(ethPricesAligned) : [];
    const returnDates = commonPriceDates.slice(1);

    // Build return-by-date maps for BTC/ETH
    const btcReturnsByDate = new Map<string, number>();
    const ethReturnsByDate = new Map<string, number>();
    for (let i = 0; i < returnDates.length; i++) {
      btcReturnsByDate.set(returnDates[i], btcReturns[i]);
      if (hasEth && ethReturns[i] !== undefined) {
        ethReturnsByDate.set(returnDates[i], ethReturns[i]);
      }
    }

    // Load benchmark returns and align to common dates
    const benchmarks = getAvailableBenchmarks();
    const assetNames: string[] = hasEth ? ["Rebeta", "BTC", "ETH"] : ["Rebeta", "BTC"];

    const benchmarkReturnMaps: Map<string, number>[] = [];
    for (const bm of benchmarks) {
      const bmData = loadBenchmarkReturns(bm.symbol);
      const bmMap = new Map<string, number>();
      for (let i = 0; i < bmData.dates.length; i++) {
        bmMap.set(bmData.dates[i], bmData.returns[i]);
      }
      benchmarkReturnMaps.push(bmMap);
      assetNames.push(bm.symbol);
    }

    // Find dates where ALL assets have data
    const allCommonDates: string[] = [];
    for (const date of returnDates) {
      const rebetaR = rebetaReturnsByDate.get(date);
      const allHaveData =
        rebetaR !== undefined && benchmarkReturnMaps.every((m) => m.has(date));
      if (allHaveData) {
        allCommonDates.push(date);
      }
    }

    // Build aligned return series for all assets
    const alignedRebeta: number[] = [];
    const alignedBtc: number[] = [];
    const alignedEth: number[] = [];
    const alignedBenchmarks: number[][] = benchmarks.map(() => []);

    for (const date of allCommonDates) {
      alignedRebeta.push(rebetaReturnsByDate.get(date)!);
      alignedBtc.push(btcReturnsByDate.get(date)!);
      if (hasEth) alignedEth.push(ethReturnsByDate.get(date) ?? 0);
      for (let i = 0; i < benchmarks.length; i++) {
        alignedBenchmarks[i].push(benchmarkReturnMaps[i].get(date)!);
      }
    }

    const allReturnsSeries: number[][] = [];
    allReturnsSeries.push(alignedRebeta, alignedBtc);
    if (hasEth) allReturnsSeries.push(alignedEth);
    allReturnsSeries.push(...alignedBenchmarks);

    // Full NxN correlation matrix
    const matrix = correlationMatrix(allReturnsSeries);

    // Rolling correlation (90-day window) - Rebeta vs all assets
    const window = Math.min(ROLLING_WINDOW, Math.floor(allCommonDates.length / 2));

    const rollingAssets: { key: string; data: { time: string; value: number }[] }[] = [];

    if (allCommonDates.length > window) {
      rollingAssets.push({
        key: "BTC",
        data: rollingCorrelation(alignedRebeta, alignedBtc, allCommonDates, window),
      });
      if (hasEth && alignedEth.length > 0) {
        rollingAssets.push({
          key: "ETH",
          data: rollingCorrelation(alignedRebeta, alignedEth, allCommonDates, window),
        });
      }
      for (let i = 0; i < benchmarks.length; i++) {
        rollingAssets.push({
          key: benchmarks[i].symbol,
          data: rollingCorrelation(alignedRebeta, alignedBenchmarks[i], allCommonDates, window),
        });
      }
    }

    // Merge all rolling series by time into unified records
    const rollingByTime = new Map<string, Record<string, number>>();
    for (const asset of rollingAssets) {
      for (const p of asset.data) {
        if (!rollingByTime.has(p.time)) {
          rollingByTime.set(p.time, {});
        }
        rollingByTime.get(p.time)![asset.key] = Math.round(p.value * 10000) / 10000;
      }
    }

    const rollingKeys = rollingAssets.map((a) => a.key);
    const rollingCorrelationData = Array.from(rollingByTime.entries())
      .filter(([, v]) => rollingKeys.every((k) => k in v))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, v]) => ({ time, ...v }));

    // Round matrix values
    const roundedMatrix = matrix.map((row) =>
      row.map((v) => Math.round(v * 10000) / 10000)
    );

    return NextResponse.json({
      period: `${period}d`,
      assets: assetNames,
      matrix: roundedMatrix,
      rollingCorrelation: rollingCorrelationData,
      rollingKeys,
    });
  } catch (error) {
    console.error("Correlation matrix error:", error);
    return NextResponse.json(
      { error: "Failed to calculate correlation matrix" },
      { status: 500 }
    );
  }
}
