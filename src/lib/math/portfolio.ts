/**
 * Portfolio simulation utilities
 * - Weighted portfolio returns
 * - Efficient frontier
 * - Portfolio metrics
 */

import { calcSharpeRatio, calcSortinoRatio, calcMaxDrawdown, calcDailyReturns } from "@/lib/utils";
import { realizedVolatility, calcCAGR } from "./statistics";

export interface PortfolioMetrics {
  cumulativeReturn: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  volatility: number;
}

/**
 * Calculate blended portfolio equity curve from two daily return series
 * @param returnsA Daily returns for asset A
 * @param returnsB Daily returns for asset B
 * @param weightA Weight for asset A (0~1)
 * @returns Equity curve starting at 1.0
 */
export function blendedEquityCurve(
  returnsA: number[],
  returnsB: number[],
  weightA: number
): number[] {
  const weightB = 1 - weightA;
  const n = Math.min(returnsA.length, returnsB.length);
  const equity: number[] = [1.0];

  for (let i = 0; i < n; i++) {
    const blendedReturn = weightA * returnsA[i] + weightB * returnsB[i];
    equity.push(equity[equity.length - 1] * (1 + blendedReturn));
  }

  return equity;
}

/**
 * Calculate portfolio metrics from an equity curve
 */
export function calcPortfolioMetrics(
  equityCurve: number[],
  days: number
): PortfolioMetrics {
  if (equityCurve.length < 2) {
    return {
      cumulativeReturn: 0,
      cagr: 0,
      sharpe: 0,
      sortino: 0,
      maxDrawdown: 0,
      volatility: 0,
    };
  }

  const dailyReturns = calcDailyReturns(equityCurve);
  const start = equityCurve[0];
  const end = equityCurve[equityCurve.length - 1];

  return {
    cumulativeReturn: (end - start) / start,
    cagr: calcCAGR(start, end, days),
    sharpe: calcSharpeRatio(dailyReturns),
    sortino: calcSortinoRatio(dailyReturns),
    maxDrawdown: calcMaxDrawdown(equityCurve),
    volatility: realizedVolatility(dailyReturns),
  };
}

/**
 * Generate efficient frontier points
 * Tests weight combinations from 0% to 100% in steps
 */
export function efficientFrontier(
  returnsA: number[],
  returnsB: number[],
  days: number,
  steps: number = 11
): {
  btcWeight: number;
  rebetaWeight: number;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
}[] {
  if (steps < 2) return [];

  const points: {
    btcWeight: number;
    rebetaWeight: number;
    expectedReturn: number;
    volatility: number;
    sharpe: number;
  }[] = [];

  for (let i = 0; i < steps; i++) {
    const btcW = i / (steps - 1);
    const rebetaW = 1 - btcW;
    const equity = blendedEquityCurve(returnsA, returnsB, btcW);
    const metrics = calcPortfolioMetrics(equity, days);

    points.push({
      btcWeight: Math.round(btcW * 100),
      rebetaWeight: Math.round(rebetaW * 100),
      expectedReturn: metrics.cagr,
      volatility: metrics.volatility,
      sharpe: metrics.sharpe,
    });
  }

  return points;
}

/**
 * Find the optimal Sharpe portfolio
 */
export function optimalSharpePortfolio(
  frontier: ReturnType<typeof efficientFrontier>
): { btcWeight: number; rebetaWeight: number } {
  let best = frontier[0];
  for (const point of frontier) {
    if (point.sharpe > best.sharpe) {
      best = point;
    }
  }
  return { btcWeight: best.btcWeight, rebetaWeight: best.rebetaWeight };
}
