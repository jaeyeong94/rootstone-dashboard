import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
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

const ROLLING_WINDOW = 21; // ~1 trading month

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
    // Fetch BTC and ETH daily close prices + DB snapshots in parallel
    const [btcData, ethData, snapshots] = await Promise.all([
      getDailyClosePrices("BTCUSDT", period + 5),
      getDailyClosePrices("ETHUSDT", period + 5),
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .orderBy(asc(balanceSnapshots.snapshotAt)),
    ]);

    // Build daily equity map from DB snapshots (last snapshot per day)
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }

    // Align Rebeta, BTC, ETH on common dates
    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const ethByDate = new Map(ethData.map((d) => [d.time, d.close]));
    const equityDays = Array.from(equityByDay.keys()).sort();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const commonDates: string[] = [];
    const btcPrices: number[] = [];
    const ethPrices: number[] = [];
    const rebetaEquity: number[] = [];

    for (const day of equityDays) {
      if (day < cutoff) continue;
      const btcClose = btcByDate.get(day);
      const ethClose = ethByDate.get(day);
      const equity = equityByDay.get(day);
      if (btcClose !== undefined && ethClose !== undefined && equity !== undefined) {
        commonDates.push(day);
        btcPrices.push(btcClose);
        ethPrices.push(ethClose);
        rebetaEquity.push(equity);
      }
    }

    // Convert to daily returns
    const btcReturns = pricesToReturns(btcPrices);
    const ethReturns = pricesToReturns(ethPrices);
    const rebetaReturns = pricesToReturns(rebetaEquity);
    const returnDates = commonDates.slice(1);

    // Build return-by-date maps for alignment with benchmarks
    const rebetaReturnsByDate = new Map<string, number>();
    const btcReturnsByDate = new Map<string, number>();
    const ethReturnsByDate = new Map<string, number>();
    for (let i = 0; i < returnDates.length; i++) {
      rebetaReturnsByDate.set(returnDates[i], rebetaReturns[i]);
      btcReturnsByDate.set(returnDates[i], btcReturns[i]);
      ethReturnsByDate.set(returnDates[i], ethReturns[i]);
    }

    // Load benchmark returns and align to common dates
    const benchmarks = getAvailableBenchmarks();
    const assetNames: string[] = ["Rebeta", "BTC", "ETH"];
    const allReturnsSeries: number[][] = [];

    // Build benchmark return-by-date maps
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
      const allHaveData = benchmarkReturnMaps.every((m) => m.has(date));
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
      alignedEth.push(ethReturnsByDate.get(date)!);
      for (let i = 0; i < benchmarks.length; i++) {
        alignedBenchmarks[i].push(benchmarkReturnMaps[i].get(date)!);
      }
    }

    allReturnsSeries.push(alignedRebeta, alignedBtc, alignedEth, ...alignedBenchmarks);

    // Full NxN correlation matrix
    const matrix = correlationMatrix(allReturnsSeries);

    // Rolling correlation (21-day window) - Rebeta vs all assets
    const window = Math.min(ROLLING_WINDOW, Math.floor(allCommonDates.length / 2));

    // All rolling series: BTC, ETH, + benchmarks
    const rollingAssets: { key: string; data: { time: string; value: number }[] }[] = [];

    if (allCommonDates.length > window) {
      rollingAssets.push({
        key: "BTC",
        data: rollingCorrelation(alignedRebeta, alignedBtc, allCommonDates, window),
      });
      rollingAssets.push({
        key: "ETH",
        data: rollingCorrelation(alignedRebeta, alignedEth, allCommonDates, window),
      });
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
