/**
 * Benchmark asset data loading and metrics calculation.
 * DB 우선 조회 → JSON fallback.
 */

import benchmarkData from "@/data/benchmarks.json";
import { getDb } from "@/lib/db";
import { benchmarkPrices } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { ANNUALIZATION_DAYS, CALENDAR_DAYS_PER_YEAR, RISK_FREE_RATE } from "@/lib/constants";

type BenchmarkEntry = {
  name: string;
  symbol: string;
  prices: { date: string; close: number }[];
};

type BenchmarkDataSet = Record<string, BenchmarkEntry>;

const jsonData = benchmarkData as BenchmarkDataSet;

const BENCHMARK_ASSETS: { symbol: string; name: string }[] = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
  { symbol: "GLD", name: "Gold" },
  { symbol: "IEF", name: "US 10Y Treasury" },
];

export interface BenchmarkReturns {
  dates: string[];
  returns: number[];
}

export interface BenchmarkInfo {
  symbol: string;
  name: string;
}

export interface AssetMetrics {
  cumulativeReturn: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
}

function pricesToDailyReturns(
  prices: { date: string; close: number }[]
): BenchmarkReturns {
  if (prices.length < 2) return { dates: [], returns: [] };

  const dates: string[] = [];
  const returns: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].close;
    const curr = prices[i].close;
    dates.push(prices[i].date);
    returns.push(curr / prev - 1);
  }

  return { dates, returns };
}

/**
 * Load benchmark price data and convert to daily returns.
 * DB 우선 → JSON fallback.
 */
export async function loadBenchmarkReturnsAsync(
  symbol: string
): Promise<BenchmarkReturns> {
  // Try DB first
  try {
    const db = getDb();
    const rows = await db
      .select({ date: benchmarkPrices.date, close: benchmarkPrices.close })
      .from(benchmarkPrices)
      .where(eq(benchmarkPrices.symbol, symbol))
      .orderBy(asc(benchmarkPrices.date));

    if (rows.length >= 100) {
      return pricesToDailyReturns(rows);
    }
  } catch {
    // DB not available, fall through to JSON
  }

  // Fallback to static JSON
  return loadBenchmarkReturns(symbol);
}

/**
 * Synchronous JSON-only loader (for tests and fallback).
 */
export function loadBenchmarkReturns(symbol: string): BenchmarkReturns {
  const entry = jsonData[symbol];
  if (!entry) {
    throw new Error(`Unknown benchmark symbol: ${symbol}`);
  }
  return pricesToDailyReturns(entry.prices);
}

/**
 * Get list of available benchmark assets.
 */
export function getAvailableBenchmarks(): BenchmarkInfo[] {
  return BENCHMARK_ASSETS;
}

/**
 * Calculate key financial metrics for a series of daily returns
 * @param returns Daily returns array (decimal form, e.g. 0.01 = 1%)
 * @param totalDays Total trading days in the series
 */
export function calcAssetMetrics(
  returns: number[],
  totalDays: number
): AssetMetrics {
  if (returns.length < 2 || totalDays === 0) {
    return {
      cumulativeReturn: 0,
      cagr: 0,
      volatility: 0,
      sharpe: 0,
      maxDrawdown: 0,
    };
  }

  // Cumulative return: product of (1 + r) - 1
  let cumProduct = 1;
  for (const r of returns) {
    cumProduct *= 1 + r;
  }
  const cumulativeReturn = cumProduct - 1;

  // CAGR
  const years = totalDays / CALENDAR_DAYS_PER_YEAR;
  const cagr = years > 0 ? Math.pow(cumProduct, 1 / years) - 1 : 0;

  // Annualized volatility (crypto trades 24/7)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (returns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(ANNUALIZATION_DAYS);

  // Sharpe ratio: (dailyMean / dailyStd) × √365
  const dailyExcess = mean - RISK_FREE_RATE;
  const dailyStd = Math.sqrt(variance);
  const sharpe = dailyStd > 0 ? (dailyExcess / dailyStd) * Math.sqrt(ANNUALIZATION_DAYS) : 0;

  // Max drawdown
  let peak = 1;
  let maxDD = 0;
  let equity = 1;
  for (const r of returns) {
    equity *= 1 + r;
    if (equity > peak) peak = equity;
    const dd = (equity - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  return {
    cumulativeReturn,
    cagr,
    volatility,
    sharpe,
    maxDrawdown: maxDD,
  };
}
