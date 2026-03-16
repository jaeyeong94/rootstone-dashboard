/**
 * Benchmark asset data loading and metrics calculation
 * Loads static benchmark price data and computes financial metrics
 */

import benchmarkData from "@/data/benchmarks.json";
import { ANNUALIZATION_DAYS, CALENDAR_DAYS_PER_YEAR, RISK_FREE_RATE } from "@/lib/constants";

type BenchmarkEntry = {
  name: string;
  symbol: string;
  prices: { date: string; close: number }[];
};

type BenchmarkDataSet = Record<string, BenchmarkEntry>;

const data = benchmarkData as BenchmarkDataSet;

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

/**
 * Load benchmark price data and convert to daily returns
 * Returns are calculated as (P_t / P_{t-1}) - 1
 * Dates array is aligned with returns (starts from second price date)
 */
export function loadBenchmarkReturns(symbol: string): BenchmarkReturns {
  const entry = data[symbol];
  if (!entry) {
    throw new Error(`Unknown benchmark symbol: ${symbol}`);
  }

  const prices = entry.prices;
  if (prices.length < 2) {
    return { dates: [], returns: [] };
  }

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
 * Get list of available benchmark assets
 */
export function getAvailableBenchmarks(): BenchmarkInfo[] {
  return Object.values(data).map((entry) => ({
    symbol: entry.symbol,
    name: entry.name,
  }));
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
  if (returns.length === 0 || totalDays === 0) {
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

  // Sharpe ratio: (dailyMean / dailyStd) × √365 — utils.calcSharpeRatio과 동일 공식
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
