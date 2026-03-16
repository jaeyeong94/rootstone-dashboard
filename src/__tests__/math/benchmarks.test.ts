import { describe, it, expect } from "vitest";
import {
  loadBenchmarkReturns,
  getAvailableBenchmarks,
  calcAssetMetrics,
} from "@/lib/math/benchmarks";

describe("loadBenchmarkReturns", () => {
  it("loads SPY data and returns daily returns", () => {
    const data = loadBenchmarkReturns("SPY");
    expect(data.dates.length).toBeGreaterThan(100);
    expect(data.returns.length).toBe(data.dates.length);
    // Returns should be small daily values
    data.returns.forEach((r) => {
      expect(Math.abs(r)).toBeLessThan(0.2); // no daily return > 20%
    });
  });

  it("loads GLD data", () => {
    const data = loadBenchmarkReturns("GLD");
    expect(data.dates.length).toBeGreaterThan(100);
  });

  it("loads QQQ data", () => {
    const data = loadBenchmarkReturns("QQQ");
    expect(data.dates.length).toBeGreaterThan(100);
  });

  it("loads TLT data", () => {
    const data = loadBenchmarkReturns("TLT");
    expect(data.dates.length).toBeGreaterThan(100);
  });

  it("throws for unknown symbol", () => {
    expect(() => loadBenchmarkReturns("FAKE")).toThrow();
  });

  it("returns aligned dates and returns arrays", () => {
    const data = loadBenchmarkReturns("SPY");
    // Returns are one fewer than prices, dates should match returns
    expect(data.dates.length).toBe(data.returns.length);
  });
});

describe("getAvailableBenchmarks", () => {
  it("returns list of benchmark assets", () => {
    const benchmarks = getAvailableBenchmarks();
    expect(benchmarks.length).toBeGreaterThanOrEqual(4);
    expect(benchmarks.map((b) => b.symbol)).toContain("SPY");
    expect(benchmarks.map((b) => b.symbol)).toContain("GLD");
    expect(benchmarks.map((b) => b.symbol)).toContain("QQQ");
    expect(benchmarks.map((b) => b.symbol)).toContain("TLT");
  });

  it("each benchmark has symbol and name", () => {
    const benchmarks = getAvailableBenchmarks();
    benchmarks.forEach((b) => {
      expect(b.symbol).toBeTruthy();
      expect(b.name).toBeTruthy();
    });
  });
});

describe("calcAssetMetrics", () => {
  it("calculates metrics for a set of daily returns", () => {
    // 100 days of mild positive returns
    const returns = Array(100).fill(0.003);
    const metrics = calcAssetMetrics(returns, 100);

    expect(metrics.cumulativeReturn).toBeGreaterThan(0);
    expect(metrics.cagr).toBeGreaterThan(0);
    expect(metrics.sharpe).toBeGreaterThan(0);
    expect(metrics.volatility).toBeGreaterThan(0);
    expect(metrics.maxDrawdown).toBeLessThanOrEqual(0);
  });

  it("returns negative cumulative for losing series", () => {
    const returns = Array(100).fill(-0.005);
    const metrics = calcAssetMetrics(returns, 100);

    expect(metrics.cumulativeReturn).toBeLessThan(0);
    expect(metrics.maxDrawdown).toBeLessThan(0);
  });

  it("handles empty returns", () => {
    const metrics = calcAssetMetrics([], 0);
    expect(metrics.cumulativeReturn).toBe(0);
    expect(metrics.sharpe).toBe(0);
  });

  it("calculates realistic metrics for SPY data", () => {
    const data = loadBenchmarkReturns("SPY");
    const metrics = calcAssetMetrics(data.returns, data.returns.length);

    // SPY 2021-2026: should have positive cumulative return
    expect(metrics.cumulativeReturn).toBeGreaterThan(0);
    // SPY volatility should be 10-25% range
    expect(metrics.volatility).toBeGreaterThan(0.08);
    expect(metrics.volatility).toBeLessThan(0.30);
    // Sharpe should be reasonable
    expect(metrics.sharpe).toBeGreaterThan(-1);
    expect(metrics.sharpe).toBeLessThan(5);
  });

  it("uses sqrt(365) annualization consistent with strategy metrics", () => {
    // Known daily returns with known std dev
    const returns = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
    const metrics = calcAssetMetrics(returns, returns.length);

    // Manual: mean=0, variance of [0.01,-0.01,...] = 0.0001, std=0.01
    // Annualized vol = 0.01 * sqrt(365) ≈ 0.19105
    const expectedVol = 0.01 * Math.sqrt(365);
    // Allow sample variance difference (N-1 vs N)
    expect(metrics.volatility).toBeCloseTo(expectedVol, 1);
  });
});
