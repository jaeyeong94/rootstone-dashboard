/**
 * Tests for Factsheet NAV calculation logic and cron denominator selection.
 *
 * - calcFactsheetNAV: kline open price 기반 Unrealized PnL + Cash = NAV
 * - Cron denominator: rawNav 우선, balance_snapshot fallback
 * - getKline: public API kline candle parsing
 */
import { describe, it, expect } from "vitest";

// ─── Factsheet NAV calculation logic (pure math) ─────────

describe("Factsheet NAV formula: NAV = Cash + UPL(kline open)", () => {
  /**
   * UPL = side * size * (openPrice - avgEntry)
   * NAV = cash + sum(UPL)
   */
  function calcNAV(
    cash: number,
    positions: Array<{
      side: "Buy" | "Sell";
      size: number;
      avgEntry: number;
      openPrice: number;
    }>
  ) {
    let totalUPL = 0;
    const details = positions.map((p) => {
      const sideMultiplier = p.side === "Buy" ? 1 : -1;
      const upl = sideMultiplier * p.size * (p.openPrice - p.avgEntry);
      totalUPL += upl;
      return { ...p, upl };
    });
    return { nav: cash + totalUPL, cash, unrealisedPnl: totalUPL, positions: details };
  }

  it("no positions → NAV = Cash", () => {
    const result = calcNAV(10000, []);
    expect(result.nav).toBe(10000);
    expect(result.unrealisedPnl).toBe(0);
  });

  it("single long position with profit", () => {
    const result = calcNAV(10000, [
      { side: "Buy", size: 1, avgEntry: 50000, openPrice: 51000 },
    ]);
    // UPL = 1 * 1 * (51000 - 50000) = 1000
    expect(result.unrealisedPnl).toBe(1000);
    expect(result.nav).toBe(11000);
  });

  it("single long position with loss", () => {
    const result = calcNAV(10000, [
      { side: "Buy", size: 2, avgEntry: 50000, openPrice: 49000 },
    ]);
    // UPL = 1 * 2 * (49000 - 50000) = -2000
    expect(result.unrealisedPnl).toBe(-2000);
    expect(result.nav).toBe(8000);
  });

  it("single short position with profit", () => {
    const result = calcNAV(10000, [
      { side: "Sell", size: 1, avgEntry: 50000, openPrice: 49000 },
    ]);
    // UPL = -1 * 1 * (49000 - 50000) = 1000
    expect(result.unrealisedPnl).toBe(1000);
    expect(result.nav).toBe(11000);
  });

  it("single short position with loss", () => {
    const result = calcNAV(10000, [
      { side: "Sell", size: 1, avgEntry: 50000, openPrice: 52000 },
    ]);
    // UPL = -1 * 1 * (52000 - 50000) = -2000
    expect(result.unrealisedPnl).toBe(-2000);
    expect(result.nav).toBe(8000);
  });

  it("multiple positions net out correctly", () => {
    const result = calcNAV(5000, [
      { side: "Buy", size: 0.5, avgEntry: 60000, openPrice: 62000 },  // UPL = +1000
      { side: "Sell", size: 10, avgEntry: 3000, openPrice: 3100 },    // UPL = -1000
      { side: "Buy", size: 100, avgEntry: 1.5, openPrice: 1.6 },     // UPL = +10
    ]);
    expect(result.unrealisedPnl).toBeCloseTo(10);
    expect(result.nav).toBeCloseTo(5010);
  });

  it("zero-size position contributes nothing", () => {
    const result = calcNAV(10000, [
      { side: "Buy", size: 0, avgEntry: 50000, openPrice: 60000 },
    ]);
    expect(result.unrealisedPnl).toBe(0);
    expect(result.nav).toBe(10000);
  });

  it("openPrice equals avgEntry → zero UPL", () => {
    const result = calcNAV(10000, [
      { side: "Buy", size: 5, avgEntry: 100, openPrice: 100 },
    ]);
    expect(result.unrealisedPnl).toBe(0);
    expect(result.nav).toBe(10000);
  });
});

// ─── kline open price vs mark price difference ──────────

describe("kline open vs mark price impact on NAV", () => {
  it("mark price and kline open give different NAV when they diverge", () => {
    const cash = 10000;
    const size = 1;
    const avgEntry = 50000;
    const markPrice = 51500;
    const klineOpen = 51000;

    const navMark = cash + size * (markPrice - avgEntry);
    const navKline = cash + size * (klineOpen - avgEntry);

    expect(navMark).toBe(11500);
    expect(navKline).toBe(11000);
    expect(navMark).not.toBe(navKline);
  });

  it("mark price and kline open converge for stable markets", () => {
    const cash = 10000;
    const size = 1;
    const avgEntry = 50000;
    // Stable market: mark ≈ open
    const markPrice = 50100;
    const klineOpen = 50098;

    const diff = Math.abs(
      (cash + size * (markPrice - avgEntry)) -
      (cash + size * (klineOpen - avgEntry))
    );

    expect(diff).toBeLessThan(10); // <$10 difference
  });
});

// ─── kline candle parsing ────────────────────────────────

describe("kline candle data parsing", () => {
  // Bybit kline format: [startTime, open, high, low, close, volume, turnover]
  it("extracts open price from candle array (index 1)", () => {
    const candle = ["1710374400000", "68123.50", "69000.00", "67500.00", "68800.00", "1234.5", "84000000"];
    const openPrice = parseFloat(candle[1]);
    expect(openPrice).toBe(68123.5);
  });

  it("handles string number parsing correctly", () => {
    const candle = ["1710374400000", "0.00012345", "0.00013000", "0.00011000", "0.00012500", "999999", "123.45"];
    const openPrice = parseFloat(candle[1]);
    expect(openPrice).toBe(0.00012345);
  });

  it("fallback to markPrice when candle is missing", () => {
    const candle: string[] | undefined = undefined;
    const markPrice = "68500.00";
    const openPrice = candle ? parseFloat(candle[1]) : parseFloat(markPrice);
    expect(openPrice).toBe(68500);
  });
});

// ─── Cron denominator selection logic ────────────────────

describe("cron denominator selection: rawNav vs snapshot fallback", () => {
  /**
   * Simulates the cron's denominator selection logic:
   * 1. If previous daily_returns row has rawNav → use it (kline↔kline)
   * 2. Else → fallback to balance_snapshot equity (mark price)
   */
  function selectDenominator(
    prevRow: { rawNav: number | null; navIndex: number },
    snapshotEquity: number | null
  ): { yesterdayNAV: number; denomSource: string } | null {
    if (prevRow.rawNav != null) {
      return { yesterdayNAV: prevRow.rawNav, denomSource: "rawNav" };
    }
    if (snapshotEquity != null) {
      return { yesterdayNAV: snapshotEquity, denomSource: "snapshot_fallback" };
    }
    return null; // error: no denominator
  }

  it("prefers rawNav when available (kline↔kline comparison)", () => {
    const result = selectDenominator(
      { rawNav: 10500, navIndex: 1.05 },
      10480 // snapshot exists too
    );
    expect(result!.yesterdayNAV).toBe(10500);
    expect(result!.denomSource).toBe("rawNav");
  });

  it("falls back to snapshot when rawNav is null (backfill→cron transition)", () => {
    const result = selectDenominator(
      { rawNav: null, navIndex: 1.05 },
      10480
    );
    expect(result!.yesterdayNAV).toBe(10480);
    expect(result!.denomSource).toBe("snapshot_fallback");
  });

  it("returns null when neither rawNav nor snapshot available", () => {
    const result = selectDenominator(
      { rawNav: null, navIndex: 1.05 },
      null
    );
    expect(result).toBeNull();
  });

  it("rawNav=0 is treated as valid (not null)", () => {
    // Edge case: rawNav of exactly 0 shouldn't fall through to fallback
    const result = selectDenominator(
      { rawNav: 0, navIndex: 1.0 },
      10000
    );
    expect(result!.yesterdayNAV).toBe(0);
    expect(result!.denomSource).toBe("rawNav");
  });
});

// ─── Daily return from rawNav chain ──────────────────────

describe("daily return calculation from rawNav chain", () => {
  it("computes correct daily return from consecutive rawNavs", () => {
    const yesterdayNAV = 10000;
    const todayNAV = 10150;
    const dailyReturn = (todayNAV - yesterdayNAV) / yesterdayNAV;
    expect(dailyReturn).toBeCloseTo(0.015); // +1.5%
  });

  it("negative return computed correctly", () => {
    const yesterdayNAV = 10000;
    const todayNAV = 9800;
    const dailyReturn = (todayNAV - yesterdayNAV) / yesterdayNAV;
    expect(dailyReturn).toBeCloseTo(-0.02); // -2%
  });

  it("navIndex chains correctly with rawNav-derived return", () => {
    const prevNavIndex = 9.721657;
    const yesterdayNAV = 10000;
    const todayNAV = 10050;
    const dailyReturn = (todayNAV - yesterdayNAV) / yesterdayNAV;
    const navIndex = prevNavIndex * (1 + dailyReturn);

    expect(navIndex).toBeCloseTo(9.721657 * 1.005);
  });

  it("first cron day: snapshot fallback gives slightly different return than rawNav would", () => {
    // Simulates the transition day:
    // Yesterday: snapshot equity = 10000 (mark price at 23:59)
    // If yesterday's kline-based NAV were computed: ~10020 (hypothetical)
    // Today: kline-based NAV = 10100

    const returnWithSnapshot = (10100 - 10000) / 10000;   // 1.0%
    const returnWithKline = (10100 - 10020) / 10020;       // ~0.798%

    expect(returnWithSnapshot).toBeCloseTo(0.01);
    expect(returnWithKline).toBeCloseTo(0.00798, 4);
    // After the first cron day, all subsequent days use rawNav (kline↔kline)
    expect(returnWithSnapshot).not.toBeCloseTo(returnWithKline, 3);
  });
});

// ─── rawNav persistence chain ────────────────────────────

describe("rawNav persistence chain across days", () => {
  it("after 2+ cron days, denominator is always kline-based", () => {
    // Day 1 (transition): uses snapshot as denominator
    const day1Nav = 10100;
    const day1SnapshotDenom = 10000;
    const day1Return = (day1Nav - day1SnapshotDenom) / day1SnapshotDenom;

    // Day 2: uses day1's rawNav as denominator (kline↔kline)
    const day2Nav = 10200;
    const day2Return = (day2Nav - day1Nav) / day1Nav;

    // Day 3: uses day2's rawNav as denominator (kline↔kline)
    const day3Nav = 10150;
    const day3Return = (day3Nav - day2Nav) / day2Nav;

    expect(day1Return).toBeCloseTo(0.01);
    expect(day2Return).toBeCloseTo(0.0099, 3);
    expect(day3Return).toBeCloseTo(-0.0049, 3);

    // navIndex chain
    const nav0 = 9.72;
    const nav1 = nav0 * (1 + day1Return);
    const nav2 = nav1 * (1 + day2Return);
    const nav3 = nav2 * (1 + day3Return);

    expect(nav3).toBeCloseTo(nav0 * (1 + day1Return) * (1 + day2Return) * (1 + day3Return));
  });
});
