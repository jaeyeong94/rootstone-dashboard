import { describe, it, expect } from "vitest";
import {
  blendedEquityCurve,
  calcPortfolioMetrics,
  efficientFrontier,
  optimalSharpePortfolio,
} from "@/lib/math/portfolio";

describe("blendedEquityCurve", () => {
  it("returns 100% asset A when weight is 1", () => {
    const returnsA = [0.01, 0.02, -0.01, 0.015];
    const returnsB = [-0.05, 0.03, 0.02, -0.04];
    const equity = blendedEquityCurve(returnsA, returnsB, 1.0);

    // Should match pure A
    expect(equity).toHaveLength(5); // initial + 4 days
    expect(equity[0]).toBe(1.0);
    expect(equity[1]).toBeCloseTo(1.01, 5);
    expect(equity[2]).toBeCloseTo(1.01 * 1.02, 5);
  });

  it("returns 100% asset B when weight is 0", () => {
    const returnsA = [0.01, 0.02, -0.01];
    const returnsB = [0.05, -0.03, 0.02];
    const equity = blendedEquityCurve(returnsA, returnsB, 0.0);

    expect(equity[1]).toBeCloseTo(1.05, 5);
  });

  it("50/50 blend produces average returns", () => {
    const returnsA = [0.10]; // +10%
    const returnsB = [0.00]; // 0%
    const equity = blendedEquityCurve(returnsA, returnsB, 0.5);

    expect(equity[1]).toBeCloseTo(1.05, 5); // 50% * 10% + 50% * 0% = 5%
  });

  it("handles empty arrays", () => {
    const equity = blendedEquityCurve([], [], 0.5);
    expect(equity).toEqual([1.0]);
  });

  it("uses minimum length of two arrays", () => {
    const returnsA = [0.01, 0.02, 0.03, 0.04];
    const returnsB = [0.01, 0.02];
    const equity = blendedEquityCurve(returnsA, returnsB, 0.5);
    expect(equity).toHaveLength(3); // initial + 2 days
  });
});

describe("calcPortfolioMetrics", () => {
  it("returns zeros for insufficient data", () => {
    const metrics = calcPortfolioMetrics([1.0], 365);
    expect(metrics.cumulativeReturn).toBe(0);
    expect(metrics.sharpe).toBe(0);
  });

  it("calculates positive metrics for growing equity", () => {
    // Steadily growing equity: 1.0 → 1.5 over 365 days
    const equity = Array.from({ length: 366 }, (_, i) => 1.0 + (i / 365) * 0.5);
    const metrics = calcPortfolioMetrics(equity, 365);

    expect(metrics.cumulativeReturn).toBeCloseTo(0.5, 2); // 50%
    expect(metrics.cagr).toBeGreaterThan(0);
    expect(metrics.sharpe).toBeGreaterThan(0);
    expect(metrics.maxDrawdown).toBeCloseTo(0, 2); // No drawdown in monotonic growth
    expect(metrics.volatility).toBeGreaterThan(0);
  });

  it("detects negative metrics for declining equity", () => {
    const equity = [1.0, 0.95, 0.90, 0.85, 0.80];
    const metrics = calcPortfolioMetrics(equity, 4);

    expect(metrics.cumulativeReturn).toBeCloseTo(-0.2, 2);
    expect(metrics.maxDrawdown).toBeLessThan(0);
  });
});

describe("efficientFrontier", () => {
  it("generates correct number of points", () => {
    const returnsA = Array(100).fill(0.001);
    const returnsB = Array(100).fill(0.002);
    const frontier = efficientFrontier(returnsA, returnsB, 100, 11);

    expect(frontier).toHaveLength(11);
    expect(frontier[0].btcWeight).toBe(0);
    expect(frontier[0].rebetaWeight).toBe(100);
    expect(frontier[10].btcWeight).toBe(100);
    expect(frontier[10].rebetaWeight).toBe(0);
  });

  it("weights always sum to 100", () => {
    const returnsA = Array(50).fill(0.001);
    const returnsB = Array(50).fill(0.002);
    const frontier = efficientFrontier(returnsA, returnsB, 50, 5);

    frontier.forEach((p) => {
      expect(p.btcWeight + p.rebetaWeight).toBe(100);
    });
  });
});

describe("efficientFrontier edge cases", () => {
  it("returns empty array when steps < 2", () => {
    const returnsA = Array(100).fill(0.001);
    const returnsB = Array(100).fill(0.002);
    expect(efficientFrontier(returnsA, returnsB, 100, 1)).toEqual([]);
    expect(efficientFrontier(returnsA, returnsB, 100, 0)).toEqual([]);
  });

  it("steps=2 produces only 0% and 100% weights", () => {
    const returnsA = Array(50).fill(0.001);
    const returnsB = Array(50).fill(0.002);
    const frontier = efficientFrontier(returnsA, returnsB, 50, 2);

    expect(frontier).toHaveLength(2);
    expect(frontier[0].btcWeight).toBe(0);
    expect(frontier[1].btcWeight).toBe(100);
  });
});

describe("optimalSharpePortfolio", () => {
  it("finds the portfolio with highest Sharpe", () => {
    const frontier = [
      { btcWeight: 0, rebetaWeight: 100, expectedReturn: 0.5, volatility: 0.3, sharpe: 1.5 },
      { btcWeight: 50, rebetaWeight: 50, expectedReturn: 0.4, volatility: 0.2, sharpe: 2.0 },
      { btcWeight: 100, rebetaWeight: 0, expectedReturn: 0.1, volatility: 0.5, sharpe: 0.2 },
    ];
    const optimal = optimalSharpePortfolio(frontier);
    expect(optimal.btcWeight).toBe(50);
    expect(optimal.rebetaWeight).toBe(50);
  });
});
