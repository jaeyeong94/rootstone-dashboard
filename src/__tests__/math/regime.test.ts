import { describe, it, expect } from "vitest";
import {
  estimateRegime,
  classifyDay,
  getRegimeDisplay,
} from "@/lib/math/regime";

describe("estimateRegime", () => {
  it("detects CORE regime in normal conditions", () => {
    // Low volatility, high correlation, neutral momentum
    const btcReturns = Array(30).fill(0.005); // mild positive returns
    const ethReturns = Array(30).fill(0.004);
    const result = estimateRegime(btcReturns, ethReturns, 2.0, [2, 1.5, 3, 1]);

    expect(result.regime).toBe("core");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it("detects CRISIS regime in extreme conditions", () => {
    // High volatility returns + negative 7d return
    const btcReturns = Array(30)
      .fill(0)
      .map((_, i) => (i % 2 === 0 ? 0.08 : -0.08)); // ±8% daily swings
    const ethReturns = Array(30)
      .fill(0)
      .map((_, i) => (i % 2 === 0 ? 0.06 : -0.06));
    const result = estimateRegime(btcReturns, ethReturns, -15, [-15, -20, -12, -18]);

    expect(result.regime).toBe("crisis");
  });

  it("detects CHALLENGING regime in mixed conditions", () => {
    // Moderate volatility, mild negative return
    const btcReturns = Array(30)
      .fill(0)
      .map((_, i) => (i % 2 === 0 ? 0.04 : -0.04)); // ±4% swings
    const ethReturns = Array(30)
      .fill(0)
      .map((_, i) => (i % 2 === 0 ? 0.02 : -0.03));
    const result = estimateRegime(btcReturns, ethReturns, -5, [-5, -3, -2, -4]);

    expect(["challenging", "crisis"]).toContain(result.regime);
  });

  it("always returns confidence between 0.5 and 0.95", () => {
    const scenarios = [
      { btcR: Array(30).fill(0.001), ethR: Array(30).fill(0.001), r7: 1, all: [1, 1, 1, 1] },
      { btcR: Array(30).fill(0.1).map((_, i) => i % 2 ? 0.1 : -0.1), ethR: Array(30).fill(0), r7: -20, all: [-20, -15, -25, -10] },
    ];

    scenarios.forEach(({ btcR, ethR, r7, all }) => {
      const result = estimateRegime(btcR, ethR, r7, all);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  it("returns all indicator values", () => {
    const btcReturns = Array(30).fill(0.01);
    const ethReturns = Array(30).fill(0.01);
    const result = estimateRegime(btcReturns, ethReturns, 5, [5, 4, 6, 3]);

    expect(result.indicators).toHaveProperty("btcVolatility30d");
    expect(result.indicators).toHaveProperty("btcEthCorrelation");
    expect(result.indicators).toHaveProperty("momentumScore");
    expect(result.indicators).toHaveProperty("btcReturn7d");
  });
});

describe("classifyDay", () => {
  it("returns core for low volatility and positive returns", () => {
    expect(classifyDay(30, 5)).toBe("core");
  });

  it("returns crisis for high volatility and sharp decline", () => {
    expect(classifyDay(90, -15)).toBe("crisis");
  });

  it("returns challenging for moderate volatility", () => {
    expect(classifyDay(55, 0)).toBe("challenging");
  });

  it("returns challenging for mild decline", () => {
    expect(classifyDay(30, -5)).toBe("challenging");
  });
});

describe("getRegimeDisplay", () => {
  it("returns correct display for core", () => {
    const display = getRegimeDisplay("core");
    expect(display.label).toBe("CORE");
    expect(display.color).toBe("text-gold");
  });

  it("returns correct display for crisis", () => {
    const display = getRegimeDisplay("crisis");
    expect(display.label).toBe("CRISIS");
    expect(display.color).toBe("text-pnl-negative");
  });

  it("returns correct display for challenging", () => {
    const display = getRegimeDisplay("challenging");
    expect(display.label).toBe("CHALLENGING");
    expect(display.color).toBe("text-status-warn");
  });
});
