/**
 * Pure logic tests for daily returns calculations.
 * No DB mocking — tests the mathematical correctness
 * of navIndex chaining, cumulative return rebasing,
 * monthly aggregation, and data integrity.
 */
import { describe, it, expect } from "vitest";
import {
  calcSharpeRatio,
  calcSortinoRatio,
  calcMaxDrawdown,
  calcDailyReturns,
  calcRollingValues,
} from "@/lib/utils";

// ─── navIndex chaining ───────────────────────────────────

describe("navIndex chaining correctness", () => {
  it("navIndex should chain multiplicatively: navIndex[i] = navIndex[i-1] * (1 + dailyReturn[i])", () => {
    const returns = [0, 0.01, -0.02, 0.015, 0.005];
    let nav = 1.0;
    const series = [nav];
    for (let i = 1; i < returns.length; i++) {
      nav = nav * (1 + returns[i]);
      series.push(nav);
    }

    // Verify chain
    for (let i = 1; i < series.length; i++) {
      const expected = series[i - 1] * (1 + returns[i]);
      expect(series[i]).toBeCloseTo(expected, 10);
    }
  });

  it("navIndex after round-trip (up then down) should reflect compound math", () => {
    // +10% then -10% should NOT be 1.0
    const nav0 = 1.0;
    const nav1 = nav0 * (1 + 0.1);   // 1.1
    const nav2 = nav1 * (1 + (-0.1)); // 0.99

    expect(nav1).toBeCloseTo(1.1);
    expect(nav2).toBeCloseTo(0.99);
    expect(nav2).not.toBeCloseTo(1.0); // Compound effect
  });

  it("total return from navIndex matches product of (1 + r)", () => {
    const returns = [0.01, -0.005, 0.02, -0.01, 0.015];
    const navFinal = returns.reduce((acc, r) => acc * (1 + r), 1.0);
    const totalReturn = navFinal - 1;

    // Should NOT equal simple sum of returns
    const simpleSum = returns.reduce((a, b) => a + b, 0);
    expect(totalReturn).not.toBeCloseTo(simpleSum, 5);
    // But should be close for small returns
    expect(Math.abs(totalReturn - simpleSum)).toBeLessThan(0.001);
  });
});

// ─── cumulative return rebasing ──────────────────────────

describe("cumulative return rebasing", () => {
  it("rebased curve starts at 0%", () => {
    const navSeries = [5.0, 5.1, 5.2, 5.15];
    const rebased = navSeries.map((n) => ((n / navSeries[0]) - 1) * 100);

    expect(rebased[0]).toBe(0);
  });

  it("rebased curve correctly shows percentage from start", () => {
    const navSeries = [2.0, 2.2, 1.8, 2.4];
    const rebased = navSeries.map((n) => ((n / navSeries[0]) - 1) * 100);

    expect(rebased[0]).toBe(0);
    expect(rebased[1]).toBeCloseTo(10);   // +10%
    expect(rebased[2]).toBeCloseTo(-10);  // -10%
    expect(rebased[3]).toBeCloseTo(20);   // +20%
  });

  it("rebasing from mid-point gives different curve than from start", () => {
    const navSeries = [1.0, 1.1, 1.05, 1.2];

    const fromStart = navSeries.map((n) => ((n / navSeries[0]) - 1) * 100);
    const fromMid = navSeries.slice(1).map((n) => ((n / navSeries[1]) - 1) * 100);

    expect(fromStart[1]).toBeCloseTo(10);
    expect(fromMid[0]).toBe(0);
    expect(fromMid[1]).toBeCloseTo(-4.545, 2); // 1.05/1.1 - 1
  });
});

// ─── monthly return aggregation ──────────────────────────

describe("monthly return aggregation from navIndex", () => {
  it("monthly return = (last navIndex / first navIndex) - 1", () => {
    const monthData = [
      { navIndex: 1.0 },
      { navIndex: 1.02 },
      { navIndex: 1.05 },
    ];
    const first = monthData[0].navIndex;
    const last = monthData[monthData.length - 1].navIndex;
    const monthlyReturn = ((last / first) - 1) * 100;

    expect(monthlyReturn).toBeCloseTo(5);
  });

  it("single-day month has 0% return", () => {
    const monthData = [{ navIndex: 1.5 }];
    const monthlyReturn = ((monthData[0].navIndex / monthData[0].navIndex) - 1) * 100;

    expect(monthlyReturn).toBe(0);
  });

  it("negative monthly return calculated correctly", () => {
    const first = 1.2;
    const last = 1.1;
    const monthlyReturn = ((last / first) - 1) * 100;

    expect(monthlyReturn).toBeCloseTo(-8.333, 2);
  });
});

// ─── drawdown from navIndex ──────────────────────────────

describe("drawdown from navIndex series", () => {
  it("no drawdown when series is monotonically increasing", () => {
    const navSeries = [1.0, 1.01, 1.02, 1.03, 1.04];
    const dd = calcMaxDrawdown(navSeries);
    expect(dd).toBe(0);
  });

  it("calculates max drawdown correctly", () => {
    const navSeries = [1.0, 1.1, 1.05, 0.9, 1.0];
    const dd = calcMaxDrawdown(navSeries);

    // Peak = 1.1, trough = 0.9, dd = (0.9 - 1.1) / 1.1 = -18.18%
    expect(dd).toBeCloseTo(-0.1818, 3);
  });

  it("drawdown resets after new peak", () => {
    const navSeries = [1.0, 1.1, 0.9, 1.2, 1.15];
    const dd = calcMaxDrawdown(navSeries);

    // First drawdown: (0.9 - 1.1) / 1.1 = -18.18%
    // Second drawdown: (1.15 - 1.2) / 1.2 = -4.17%
    // Max = -18.18%
    expect(dd).toBeCloseTo(-0.1818, 3);
  });

  it("entire series declining from start", () => {
    const navSeries = [1.0, 0.9, 0.8, 0.7];
    const dd = calcMaxDrawdown(navSeries);

    // Peak = 1.0, trough = 0.7, dd = -30%
    expect(dd).toBeCloseTo(-0.3, 5);
  });
});

// ─── Sharpe/Sortino with daily returns from navIndex ─────

describe("Sharpe ratio from daily returns", () => {
  it("positive returns should give positive Sharpe", () => {
    const returns = Array(30).fill(0.001); // Consistent 0.1% daily
    const sharpe = calcSharpeRatio(returns);
    expect(sharpe).toBeGreaterThan(0);
  });

  it("negative returns should give negative Sharpe", () => {
    const returns = Array(30).fill(-0.001);
    const sharpe = calcSharpeRatio(returns);
    expect(sharpe).toBeLessThan(0);
  });

  it("higher volatility with same mean → lower Sharpe", () => {
    // Both have same mean (0.001), but different volatility
    // Constant returns: std = 0 → Sharpe returns 0 (division guard)
    // So use slight variation instead
    const stable = [0.0011, 0.0009, 0.0011, 0.0009, 0.0011, 0.0009];
    const volatile = [0.003, -0.001, 0.003, -0.001, 0.003, -0.001];

    const sharpeStable = calcSharpeRatio(stable);
    const sharpeVolatile = calcSharpeRatio(volatile);

    expect(sharpeStable).toBeGreaterThan(sharpeVolatile);
  });

  it("returns 0 for insufficient data", () => {
    expect(calcSharpeRatio([])).toBe(0);
    expect(calcSharpeRatio([0.01])).toBe(0);
  });
});

describe("Sortino ratio from daily returns", () => {
  it("only penalizes downside deviation", () => {
    // All positive returns: no downside → Sortino should be 0 (division by 0 handled)
    const allPositive = [0.01, 0.02, 0.015, 0.005, 0.01];
    const sortino = calcSortinoRatio(allPositive);
    // Should be 0 since downside std would be very small (close to 0)
    // Actually with the formula, it filters min(r, 0)^2 which are all 0 → downsideStd = 0 → returns 0
    expect(sortino).toBe(0);
  });

  it("mixed returns: Sortino >= Sharpe when mean > 0", () => {
    const returns = [0.01, -0.005, 0.02, -0.003, 0.015, -0.008, 0.01];
    const sharpe = calcSharpeRatio(returns);
    const sortino = calcSortinoRatio(returns);

    // Sortino only counts downside, so with positive mean it should be >= Sharpe
    expect(sortino).toBeGreaterThanOrEqual(sharpe);
  });
});

// ─── rolling metrics from daily returns ──────────────────

describe("rolling metrics calculation", () => {
  it("returns correct number of points", () => {
    const returns = Array(50).fill(0.001);
    const times = returns.map((_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`);
    const window = 10;

    const rolling = calcRollingValues(returns, times, window, calcSharpeRatio);

    // Should have (50 - 10 + 1) = 41 points (window부터 마지막까지 포함)
    expect(rolling).toHaveLength(41);
  });

  it("rolling window captures local changes", () => {
    // First 20 days: positive, next 20 days: negative
    const returns = [
      ...Array(20).fill(0.005),
      ...Array(20).fill(-0.005),
    ];
    const times = returns.map((_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`);

    const rolling = calcRollingValues(returns, times, 10, calcSharpeRatio);

    // Early points should be positive (all positive window)
    expect(rolling[0].value).toBeGreaterThan(0);

    // Late points should be negative (all negative window)
    expect(rolling[rolling.length - 1].value).toBeLessThan(0);
  });

  it("returns empty for insufficient data", () => {
    const returns = [0.01, 0.02];
    const times = ["2024-01-01", "2024-01-02"];

    const rolling = calcRollingValues(returns, times, 10, calcSharpeRatio);
    expect(rolling).toHaveLength(0);
  });
});

// ─── calcDailyReturns consistency ────────────────────────

describe("calcDailyReturns vs navIndex dailyReturn consistency", () => {
  it("calcDailyReturns from navIndex series matches pre-computed dailyReturn", () => {
    const navSeries = [1.0, 1.01, 1.005, 1.02, 0.98];
    const computed = calcDailyReturns(navSeries);

    // Manual verification
    expect(computed[0]).toBeCloseTo(0.01, 10);        // (1.01 - 1.0) / 1.0
    expect(computed[1]).toBeCloseTo(-0.00495, 4);      // (1.005 - 1.01) / 1.01
    expect(computed[2]).toBeCloseTo(0.01493, 4);       // (1.02 - 1.005) / 1.005
    expect(computed[3]).toBeCloseTo(-0.03922, 4);      // (0.98 - 1.02) / 1.02
  });

  it("navIndex can be reconstructed from dailyReturns", () => {
    const originalNav = [1.0, 1.05, 0.98, 1.1, 1.15];
    const returns = calcDailyReturns(originalNav);

    // Reconstruct
    let nav = originalNav[0];
    for (let i = 0; i < returns.length; i++) {
      nav = nav * (1 + returns[i]);
      expect(nav).toBeCloseTo(originalNav[i + 1], 10);
    }
  });
});

// ─── edge cases ──────────────────────────────────────────

describe("edge cases", () => {
  it("single data point: no return, no drawdown", () => {
    expect(calcDailyReturns([1.0])).toEqual([]);
    expect(calcMaxDrawdown([1.0])).toBe(0);
  });

  it("two identical points: 0% return", () => {
    const returns = calcDailyReturns([1.0, 1.0]);
    expect(returns[0]).toBe(0);
  });

  it("very small returns don't cause floating point issues", () => {
    const nav = 9.721657; // typical tearsheet navIndex
    const smallReturn = 0.00001; // 0.001%
    const nextNav = nav * (1 + smallReturn);
    const computedReturn = (nextNav - nav) / nav;

    expect(computedReturn).toBeCloseTo(smallReturn, 10);
  });

  it("large navIndex values chain correctly", () => {
    // Tearsheet last value is ~9.72
    let nav = 9.721657;
    const returns = [0.001, -0.002, 0.003, 0.0005];

    for (const r of returns) {
      nav = nav * (1 + r);
    }

    // Should still be close to expected
    const expected = 9.721657 * (1.001) * (0.998) * (1.003) * (1.0005);
    expect(nav).toBeCloseTo(expected, 6);
  });

  it("monthly return with zero navIndex returns 0 (no NaN)", () => {
    const first = 0;
    const last = 1.05;
    const returnPct = first > 0 ? ((last / first) - 1) * 100 : 0;

    expect(returnPct).toBe(0);
    expect(Number.isNaN(returnPct)).toBe(false);
    expect(Number.isFinite(returnPct)).toBe(true);
  });
});
