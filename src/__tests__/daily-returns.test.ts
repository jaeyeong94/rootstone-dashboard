import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB layer
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/db", () => ({
  db: () => ({
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                orderBy: (...oArgs: unknown[]) => {
                  mockOrderBy(...oArgs);
                  return mockOrderBy.mock.results[mockOrderBy.mock.calls.length - 1]?.value ?? [];
                },
              };
            },
            orderBy: (...oArgs: unknown[]) => {
              mockOrderBy(...oArgs);
              return {
                limit: (...lArgs: unknown[]) => {
                  mockLimit(...lArgs);
                  return mockLimit.mock.results[mockLimit.mock.calls.length - 1]?.value ?? [];
                },
              };
            },
          };
        },
      };
    },
  }),
}));

vi.mock("@/lib/db/schema", () => ({
  dailyReturns: {
    date: "date",
    navIndex: "nav_index",
    dailyReturn: "daily_return",
  },
}));

// Sample data
const SAMPLE_DATA = [
  { date: "2024-11-17", navIndex: 1.0, dailyReturn: 0 },
  { date: "2024-11-18", navIndex: 1.005, dailyReturn: 0.005 },
  { date: "2024-11-19", navIndex: 1.012, dailyReturn: 0.006965 },
  { date: "2024-11-20", navIndex: 0.998, dailyReturn: -0.013834 },
  { date: "2024-11-21", navIndex: 1.015, dailyReturn: 0.017034 },
  { date: "2024-12-01", navIndex: 1.05, dailyReturn: 0.003 },
  { date: "2024-12-15", navIndex: 1.08, dailyReturn: 0.002 },
  { date: "2025-01-05", navIndex: 1.12, dailyReturn: 0.001 },
  { date: "2025-01-20", navIndex: 1.15, dailyReturn: 0.0015 },
];

import {
  getDailyReturns,
  getDailyReturnsSinceV31,
  getCumulativeCurve,
  getMonthlyReturns,
  getLatestDailyReturn,
} from "@/lib/daily-returns";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDailyReturns", () => {
  it("returns all rows when no date range specified", async () => {
    mockOrderBy.mockReturnValueOnce(SAMPLE_DATA);
    const result = await getDailyReturns();
    expect(result).toEqual(SAMPLE_DATA);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
  });

  it("passes from/to filters correctly", async () => {
    mockOrderBy.mockReturnValueOnce(SAMPLE_DATA.slice(0, 3));
    const result = await getDailyReturns({ from: "2024-11-17", to: "2024-11-19" });
    expect(result).toHaveLength(3);
    expect(mockWhere).toHaveBeenCalled();
  });

  it("returns empty array when no data", async () => {
    mockOrderBy.mockReturnValueOnce([]);
    const result = await getDailyReturns();
    expect(result).toEqual([]);
  });
});

describe("getDailyReturnsSinceV31", () => {
  it("filters from v3.1 start date (2024-11-17)", async () => {
    mockOrderBy.mockReturnValueOnce(SAMPLE_DATA);
    const result = await getDailyReturnsSinceV31();
    expect(result).toEqual(SAMPLE_DATA);
    // Should have called with from filter
    expect(mockWhere).toHaveBeenCalled();
  });
});

describe("getCumulativeCurve", () => {
  it("returns empty array for no data", async () => {
    mockOrderBy.mockReturnValueOnce([]);
    const result = await getCumulativeCurve();
    expect(result).toEqual([]);
  });

  it("rebases to period start = 0%", async () => {
    mockOrderBy.mockReturnValueOnce(SAMPLE_DATA.slice(0, 5));
    const result = await getCumulativeCurve();

    // First point should be 0%
    expect(result[0].value).toBe(0);
    expect(result[0].date).toBe("2024-11-17");
  });

  it("calculates cumulative return correctly", async () => {
    const data = [
      { date: "2024-11-17", navIndex: 1.0, dailyReturn: 0 },
      { date: "2024-11-18", navIndex: 1.1, dailyReturn: 0.1 },
      { date: "2024-11-19", navIndex: 1.2, dailyReturn: 0.0909 },
    ];
    mockOrderBy.mockReturnValueOnce(data);
    const result = await getCumulativeCurve();

    expect(result[0].value).toBe(0);       // 0%
    expect(result[1].value).toBeCloseTo(10); // +10%
    expect(result[2].value).toBeCloseTo(20); // +20%
  });

  it("handles negative cumulative returns", async () => {
    const data = [
      { date: "2024-11-17", navIndex: 1.0, dailyReturn: 0 },
      { date: "2024-11-18", navIndex: 0.95, dailyReturn: -0.05 },
    ];
    mockOrderBy.mockReturnValueOnce(data);
    const result = await getCumulativeCurve();

    expect(result[1].value).toBeCloseTo(-5); // -5%
  });
});

describe("getMonthlyReturns", () => {
  it("returns empty array for no data", async () => {
    mockOrderBy.mockReturnValueOnce([]);
    const result = await getMonthlyReturns();
    expect(result).toEqual([]);
  });

  it("groups by month and calculates return from navIndex ratio", async () => {
    mockOrderBy.mockReturnValueOnce(SAMPLE_DATA);
    const result = await getMonthlyReturns();

    // Should have 3 months: 2024-11, 2024-12, 2025-01
    expect(result).toHaveLength(3);
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(11);
    expect(result[1].year).toBe(2024);
    expect(result[1].month).toBe(12);
    expect(result[2].year).toBe(2025);
    expect(result[2].month).toBe(1);
  });

  it("calculates monthly return as (last navIndex / first navIndex) - 1", async () => {
    const data = [
      { date: "2024-11-01", navIndex: 1.0, dailyReturn: 0 },
      { date: "2024-11-15", navIndex: 1.05, dailyReturn: 0.003 },
      { date: "2024-11-30", navIndex: 1.1, dailyReturn: 0.002 },
    ];
    mockOrderBy.mockReturnValueOnce(data);
    const result = await getMonthlyReturns();

    expect(result).toHaveLength(1);
    // (1.1 / 1.0 - 1) * 100 = 10%
    expect(result[0].returnPct).toBeCloseTo(10);
  });

  it("returns sorted by month", async () => {
    mockOrderBy.mockReturnValueOnce(SAMPLE_DATA);
    const result = await getMonthlyReturns();

    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1].year * 100 + result[i - 1].month;
      const curr = result[i].year * 100 + result[i].month;
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

describe("getLatestDailyReturn", () => {
  it("returns null when no data", async () => {
    mockLimit.mockReturnValueOnce([]);
    const result = await getLatestDailyReturn();
    expect(result).toBeNull();
  });

  it("returns the most recent entry", async () => {
    const latest = { date: "2025-01-20", navIndex: 1.15, dailyReturn: 0.0015 };
    mockLimit.mockReturnValueOnce([latest]);
    const result = await getLatestDailyReturn();
    expect(result).toEqual(latest);
  });
});
