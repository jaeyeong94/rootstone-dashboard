/**
 * Statistical calculation utilities
 * - Realized volatility
 * - VaR (Value at Risk)
 * - CAGR
 */

import { ANNUALIZATION_DAYS, CALENDAR_DAYS_PER_YEAR } from "@/lib/constants";

/**
 * Calculate annualized realized volatility
 * @param dailyReturns Array of daily returns (decimal form)
 * @returns Annualized volatility as decimal (e.g., 0.25 = 25%)
 */
export function realizedVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (dailyReturns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(ANNUALIZATION_DAYS);
}

/**
 * Calculate Value at Risk (historical simulation method)
 * @param dailyReturns Array of daily returns
 * @param confidence Confidence level (e.g., 0.95 for 95%)
 * @returns VaR as negative percentage (e.g., -0.05 = -5%)
 */
export function historicalVaR(
  dailyReturns: number[],
  confidence: number = 0.95
): number {
  if (dailyReturns.length < 2) return 0;

  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (1 - confidence));
  return sorted[index] ?? 0;
}

/**
 * Calculate Conditional VaR (Expected Shortfall)
 * Average of returns below the VaR threshold
 */
export function conditionalVaR(
  dailyReturns: number[],
  confidence: number = 0.95
): number {
  if (dailyReturns.length < 2) return 0;

  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const cutoffIndex = Math.floor(sorted.length * (1 - confidence));
  if (cutoffIndex === 0) return sorted[0] ?? 0;

  const tail = sorted.slice(0, cutoffIndex);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 * @param startValue Starting equity value
 * @param endValue Ending equity value
 * @param days Number of days
 * @returns CAGR as decimal (e.g., 0.58 = 58%)
 */
export function calcCAGR(
  startValue: number,
  endValue: number,
  days: number
): number {
  if (startValue <= 0 || days <= 0) return 0;
  const years = days / CALENDAR_DAYS_PER_YEAR;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Calculate mean of an array
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const variance =
    arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}
