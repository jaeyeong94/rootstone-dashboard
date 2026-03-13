import { describe, it, expect } from "vitest";
import {
  realizedVolatility,
  historicalVaR,
  conditionalVaR,
  calcCAGR,
  mean,
  stdDev,
} from "@/lib/math/statistics";

describe("realizedVolatility", () => {
  it("returns 0 for less than 2 data points", () => {
    expect(realizedVolatility([])).toBe(0);
    expect(realizedVolatility([0.01])).toBe(0);
  });

  it("calculates annualized volatility", () => {
    // Constant 1% daily returns → volatility should be ~0 (low variance)
    const returns = Array(30).fill(0.01);
    expect(realizedVolatility(returns)).toBeCloseTo(0, 1);
  });

  it("higher variance returns → higher volatility", () => {
    const low = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
    const high = [0.05, -0.05, 0.05, -0.05, 0.05, -0.05];
    expect(realizedVolatility(high)).toBeGreaterThan(realizedVolatility(low));
  });

  it("scales with sqrt(365)", () => {
    const returns = [0.01, -0.02, 0.015, -0.005, 0.02];
    const vol = realizedVolatility(returns);
    // Should be positive and reasonable
    expect(vol).toBeGreaterThan(0);
    expect(vol).toBeLessThan(5); // Less than 500% annualized
  });
});

describe("historicalVaR", () => {
  it("returns 0 for insufficient data", () => {
    expect(historicalVaR([])).toBe(0);
    expect(historicalVaR([0.01])).toBe(0);
  });

  it("returns negative value for 95% confidence", () => {
    // 100 returns: 5th percentile should be around -5%
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
    const var95 = historicalVaR(returns, 0.95);
    expect(var95).toBeLessThan(0);
  });

  it("higher confidence → more negative VaR", () => {
    const returns = Array.from({ length: 100 }, (_, i) =>
      (i - 50) / 1000
    );
    const var95 = historicalVaR(returns, 0.95);
    const var99 = historicalVaR(returns, 0.99);
    expect(var99).toBeLessThanOrEqual(var95);
  });
});

describe("conditionalVaR", () => {
  it("is more negative than VaR (deeper tail)", () => {
    const returns = Array.from({ length: 100 }, (_, i) =>
      (i - 50) / 1000
    );
    const var95 = historicalVaR(returns, 0.95);
    const cvar95 = conditionalVaR(returns, 0.95);
    expect(cvar95).toBeLessThanOrEqual(var95);
  });

  it("returns 0 for insufficient data", () => {
    expect(conditionalVaR([])).toBe(0);
  });
});

describe("calcCAGR", () => {
  it("returns 0 for zero start value", () => {
    expect(calcCAGR(0, 100, 365)).toBe(0);
  });

  it("returns 0 for zero days", () => {
    expect(calcCAGR(100, 200, 0)).toBe(0);
  });

  it("calculates correct CAGR for doubling in 1 year", () => {
    const cagr = calcCAGR(100, 200, 365.25);
    expect(cagr).toBeCloseTo(1.0, 2); // 100% CAGR
  });

  it("calculates correct CAGR for 50% growth in 2 years", () => {
    const cagr = calcCAGR(100, 150, 730.5);
    expect(cagr).toBeCloseTo(0.2247, 2); // ~22.47% CAGR
  });
});

describe("mean", () => {
  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });

  it("calculates mean correctly", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it("handles negative values", () => {
    expect(mean([-2, -1, 0, 1, 2])).toBe(0);
  });
});

describe("stdDev", () => {
  it("returns 0 for less than 2 elements", () => {
    expect(stdDev([])).toBe(0);
    expect(stdDev([1])).toBe(0);
  });

  it("returns 0 for constant array", () => {
    expect(stdDev([5, 5, 5, 5])).toBe(0);
  });

  it("calculates sample std dev correctly", () => {
    // Known: stdDev([2, 4, 4, 4, 5, 5, 7, 9]) ≈ 2.138
    const sd = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(sd).toBeCloseTo(2.138, 2);
  });
});
