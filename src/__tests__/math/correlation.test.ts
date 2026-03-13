import { describe, it, expect } from "vitest";
import {
  pearsonCorrelation,
  correlationMatrix,
  rollingCorrelation,
  pricesToReturns,
} from "@/lib/math/correlation";

describe("pearsonCorrelation", () => {
  it("returns 1 for perfectly correlated arrays", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
  });

  it("returns -1 for perfectly inversely correlated arrays", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 5);
  });

  it("returns 0 for uncorrelated arrays", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [3, 1, 4, 1, 5]; // no clear pattern
    const corr = pearsonCorrelation(x, y);
    expect(Math.abs(corr)).toBeLessThan(0.5);
  });

  it("handles arrays of different lengths (uses shorter)", () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [2, 4, 6];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
  });

  it("returns 0 for arrays with less than 2 elements", () => {
    expect(pearsonCorrelation([1], [2])).toBe(0);
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it("returns 0 for constant arrays", () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBe(0);
  });
});

describe("correlationMatrix", () => {
  it("returns identity for single series", () => {
    const matrix = correlationMatrix([[1, 2, 3]]);
    expect(matrix).toEqual([[1]]);
  });

  it("returns symmetric matrix for two series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [5, 4, 3, 2, 1];
    const matrix = correlationMatrix([a, b]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[0][1]).toBeCloseTo(-1, 5);
    expect(matrix[1][0]).toBeCloseTo(-1, 5);
  });

  it("diagonal is always 1", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const c = [7, 8, 9];
    const matrix = correlationMatrix([a, b, c]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[2][2]).toBe(1);
  });
});

describe("rollingCorrelation", () => {
  it("calculates rolling windows correctly", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const times = x.map((_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
    const result = rollingCorrelation(x, y, times, 5);
    // All windows should show perfect correlation
    expect(result.length).toBe(6); // 10 - 5 + 1 = 6
    result.forEach((r) => expect(r.value).toBeCloseTo(1, 5));
  });

  it("returns empty for window larger than data", () => {
    const result = rollingCorrelation([1, 2], [3, 4], ["a", "b"], 5);
    expect(result).toHaveLength(0);
  });
});

describe("pricesToReturns", () => {
  it("calculates daily returns from prices", () => {
    const prices = [100, 110, 105, 115];
    const returns = pricesToReturns(prices);
    expect(returns).toHaveLength(3);
    expect(returns[0]).toBeCloseTo(0.1, 5);    // 100 → 110: +10%
    expect(returns[1]).toBeCloseTo(-0.0455, 3); // 110 → 105: -4.55%
    expect(returns[2]).toBeCloseTo(0.0952, 3);  // 105 → 115: +9.52%
  });

  it("handles single price", () => {
    expect(pricesToReturns([100])).toHaveLength(0);
  });

  it("handles zero price gracefully", () => {
    const returns = pricesToReturns([0, 100]);
    expect(returns[0]).toBe(0);
  });
});
