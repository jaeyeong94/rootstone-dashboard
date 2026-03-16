import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as percentage with sign
 * e.g. 0.0534 → "+5.34%", -0.0212 → "-2.12%"
 */
export function formatPnlPercent(value: number, decimals = 2): string {
  const pct = value * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * Format a number with commas
 * e.g. 1234567.89 → "1,234,567.89"
 */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Get PnL color class based on value
 */
export function getPnlColor(value: number): string {
  if (value > 0) return "text-pnl-positive";
  if (value < 0) return "text-pnl-negative";
  return "text-text-secondary";
}

/**
 * Format relative time (e.g., "3m ago", "1h ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

/**
 * Calculate Sharpe Ratio from daily returns
 * Sharpe = (mean(returns) - riskFreeRate) / std(returns) * sqrt(365)
 */
export function calcSharpeRatio(dailyReturns: number[], riskFreeRate = 0): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return ((mean - riskFreeRate) / std) * Math.sqrt(365);
}

/**
 * Calculate Sortino Ratio (only downside deviation)
 */
export function calcSortinoRatio(dailyReturns: number[], riskFreeRate = 0): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  // semi-deviation: 전체 N을 분모로 사용 (표준 Sortino 공식)
  const downsideVariance =
    dailyReturns.reduce((sum, r) => sum + Math.min(r - riskFreeRate, 0) ** 2, 0) /
    dailyReturns.length;
  const downsideStd = Math.sqrt(downsideVariance);
  if (downsideStd === 0) return 0;
  return ((mean - riskFreeRate) / downsideStd) * Math.sqrt(365);
}

/**
 * Calculate max drawdown from equity series
 * Returns negative percentage (e.g., -0.15 = -15%)
 */
export function calcMaxDrawdown(equitySeries: number[]): number {
  if (equitySeries.length < 2) return 0;
  let peak = equitySeries[0];
  let maxDd = 0;
  for (const equity of equitySeries) {
    if (equity > peak) peak = equity;
    const dd = (equity - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

/**
 * Calculate daily returns from equity series
 */
export function calcDailyReturns(equitySeries: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equitySeries.length; i++) {
    returns.push((equitySeries[i] - equitySeries[i - 1]) / equitySeries[i - 1]);
  }
  return returns;
}

/**
 * Calculate rolling metric over a window
 */
export function calcRollingValues(
  dailyReturns: number[],
  times: string[],
  window: number,
  calcFn: (returns: number[]) => number
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = window; i < dailyReturns.length; i++) {
    const slice = dailyReturns.slice(i - window, i);
    result.push({ time: times[i], value: calcFn(slice) });
  }
  return result;
}
