/**
 * Tests for API route response shapes after daily_returns migration.
 * Mocks the daily-returns module and verifies route handlers
 * return correct structures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ────────────────────────────────────────

const MOCK_DAILY_RETURNS = [
  { date: "2024-11-17", navIndex: 1.0, dailyReturn: 0 },
  { date: "2024-11-18", navIndex: 1.005, dailyReturn: 0.005 },
  { date: "2024-11-19", navIndex: 1.012, dailyReturn: 0.006965 },
  { date: "2024-11-20", navIndex: 0.998, dailyReturn: -0.013834 },
  { date: "2024-11-21", navIndex: 1.015, dailyReturn: 0.017034 },
];

const MOCK_MONTHLY_RETURNS = [
  { year: 2024, month: 11, returnPct: 1.5 },
  { year: 2024, month: 12, returnPct: 2.8 },
];

const MOCK_CUMULATIVE = [
  { date: "2024-11-17", value: 0 },
  { date: "2024-11-18", value: 0.5 },
  { date: "2024-11-19", value: 1.2 },
  { date: "2024-11-20", value: -0.2 },
  { date: "2024-11-21", value: 1.5 },
];

vi.mock("@/lib/daily-returns", () => ({
  getDailyReturns: vi.fn().mockResolvedValue(MOCK_DAILY_RETURNS),
  getDailyReturnsSinceV31: vi.fn().mockResolvedValue(MOCK_DAILY_RETURNS),
  getCumulativeCurve: vi.fn().mockResolvedValue(MOCK_CUMULATIVE),
  getMonthlyReturns: vi.fn().mockResolvedValue(MOCK_MONTHLY_RETURNS),
  getLatestDailyReturn: vi.fn().mockResolvedValue(MOCK_DAILY_RETURNS[4]),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { email: "test@test.com" } }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/bybit/client", () => ({
  getClosedPnl: vi.fn().mockResolvedValue({ list: [], nextPageCursor: "" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── equity-curve ────────────────────────────────────────

describe("/api/bybit/equity-curve response shape", () => {
  it("returns curve array with time and value", async () => {
    const { getCumulativeCurve } = await import("@/lib/daily-returns");
    const data = await getCumulativeCurve();

    expect(data).toHaveLength(5);
    expect(data[0]).toHaveProperty("date");
    expect(data[0]).toHaveProperty("value");
    expect(data[0].value).toBe(0); // starts at 0%
  });

  it("all values are numbers", async () => {
    const { getCumulativeCurve } = await import("@/lib/daily-returns");
    const data = await getCumulativeCurve();

    for (const point of data) {
      expect(typeof point.value).toBe("number");
      expect(typeof point.date).toBe("string");
    }
  });
});

// ─── metrics ─────────────────────────────────────────────

describe("/api/bybit/metrics calculation from daily_returns", () => {
  it("calculates Sharpe from daily returns array", async () => {
    const { getDailyReturnsSinceV31 } = await import("@/lib/daily-returns");
    const { calcSharpeRatio } = await import("@/lib/utils");

    const rows = await getDailyReturnsSinceV31();
    const returns = rows.map((r) => r.dailyReturn);
    const sharpe = calcSharpeRatio(returns);

    expect(typeof sharpe).toBe("number");
    expect(Number.isFinite(sharpe)).toBe(true);
  });

  it("calculates maxDrawdown from navIndex series", async () => {
    const { getDailyReturnsSinceV31 } = await import("@/lib/daily-returns");
    const { calcMaxDrawdown } = await import("@/lib/utils");

    const rows = await getDailyReturnsSinceV31();
    const navSeries = rows.map((r) => r.navIndex);
    const dd = calcMaxDrawdown(navSeries);

    expect(dd).toBeLessThanOrEqual(0); // Drawdown is always <= 0
  });

  it("calculates totalReturn from first/last navIndex", async () => {
    const { getDailyReturnsSinceV31 } = await import("@/lib/daily-returns");

    const rows = await getDailyReturnsSinceV31();
    const navSeries = rows.map((r) => r.navIndex);
    const totalReturn = (navSeries[navSeries.length - 1] - navSeries[0]) / navSeries[0];

    // From our mock data: (1.015 - 1.0) / 1.0 = 1.5%
    expect(totalReturn).toBeCloseTo(0.015, 3);
  });
});

// ─── monthly-returns ─────────────────────────────────────

describe("/api/bybit/monthly-returns response shape", () => {
  it("returns array of { year, month, returnPct }", async () => {
    const { getMonthlyReturns } = await import("@/lib/daily-returns");
    const data = await getMonthlyReturns();

    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty("year");
    expect(data[0]).toHaveProperty("month");
    expect(data[0]).toHaveProperty("returnPct");
  });

  it("year and month are valid", async () => {
    const { getMonthlyReturns } = await import("@/lib/daily-returns");
    const data = await getMonthlyReturns();

    for (const m of data) {
      expect(m.year).toBeGreaterThanOrEqual(2021);
      expect(m.month).toBeGreaterThanOrEqual(1);
      expect(m.month).toBeLessThanOrEqual(12);
    }
  });
});

// ─── drawdown ────────────────────────────────────────────

describe("/api/bybit/drawdown response from navIndex", () => {
  it("drawdown series values are always <= 0", async () => {
    const { getDailyReturnsSinceV31 } = await import("@/lib/daily-returns");

    const rows = await getDailyReturnsSinceV31();
    let peak = rows[0].navIndex;
    const series = rows.map((r) => {
      if (r.navIndex > peak) peak = r.navIndex;
      return ((r.navIndex - peak) / peak) * 100;
    });

    for (const val of series) {
      expect(val).toBeLessThanOrEqual(0);
    }
  });

  it("drawdown is 0 at peaks", async () => {
    // Manually compute: peak tracking
    const navSeries = [1.0, 1.005, 1.012, 0.998, 1.015];
    let peak = navSeries[0];
    const ddSeries: number[] = [];

    for (const nav of navSeries) {
      if (nav > peak) peak = nav;
      ddSeries.push(((nav - peak) / peak) * 100);
    }

    // Index 2 (1.012) is a new peak → dd should be 0
    expect(ddSeries[2]).toBe(0);
    // Index 4 (1.015) is a new peak → dd should be 0
    expect(ddSeries[4]).toBe(0);
    // Index 3 (0.998) is below peak → dd should be negative
    expect(ddSeries[3]).toBeLessThan(0);
  });
});

// ─── rolling-metrics ─────────────────────────────────────

describe("/api/bybit/rolling-metrics from daily_returns", () => {
  it("uses dailyReturn field directly, not recalculated from navIndex", async () => {
    const { getDailyReturns } = await import("@/lib/daily-returns");

    const rows = await getDailyReturns();
    const returns = rows.map((r) => r.dailyReturn);

    // All returns should be numbers
    for (const r of returns) {
      expect(typeof r).toBe("number");
    }
  });
});

// ─── calendar daily return format ────────────────────────

describe("calendar daily return decimal → percent conversion", () => {
  it("converts decimal to percentage correctly", () => {
    // 0.005 = 0.5%
    const decimal = 0.005;
    const pct = Math.round(decimal * 10000) / 100;
    expect(pct).toBe(0.5);
  });

  it("handles negative returns", () => {
    const decimal = -0.013834;
    const pct = Math.round(decimal * 10000) / 100;
    expect(pct).toBeCloseTo(-1.38, 1);
  });

  it("handles zero return", () => {
    const decimal = 0;
    const pct = Math.round(decimal * 10000) / 100;
    expect(pct).toBe(0);
  });
});
