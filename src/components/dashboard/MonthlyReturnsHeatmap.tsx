"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { MonthlyReturn } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_INDEX: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

// Static tearsheet data (v1~v3.1): 2021.03 ~ 2026.02
const STATIC_MONTHLY: MonthlyReturn[] = [
  // 2021
  { year: 2021, month: 3, return: 7.6 }, { year: 2021, month: 4, return: 12.7 },
  { year: 2021, month: 5, return: 30.2 }, { year: 2021, month: 6, return: 2.9 },
  { year: 2021, month: 7, return: 1.5 }, { year: 2021, month: 8, return: 1.2 },
  { year: 2021, month: 9, return: -9.3 }, { year: 2021, month: 10, return: 8.5 },
  { year: 2021, month: 11, return: 8.0 }, { year: 2021, month: 12, return: 5.4 },
  // 2022
  { year: 2022, month: 1, return: -6.8 }, { year: 2022, month: 2, return: 8.2 },
  { year: 2022, month: 3, return: 2.9 }, { year: 2022, month: 4, return: 5.4 },
  { year: 2022, month: 5, return: 13.6 }, { year: 2022, month: 6, return: 11.9 },
  { year: 2022, month: 7, return: -1.9 }, { year: 2022, month: 8, return: 1.1 },
  { year: 2022, month: 9, return: -1.0 }, { year: 2022, month: 10, return: 5.4 },
  { year: 2022, month: 11, return: -8.6 }, { year: 2022, month: 12, return: -4.4 },
  // 2023
  { year: 2023, month: 1, return: 13.4 }, { year: 2023, month: 2, return: 0.8 },
  { year: 2023, month: 3, return: -1.0 }, { year: 2023, month: 4, return: 1.9 },
  { year: 2023, month: 5, return: 3.6 }, { year: 2023, month: 6, return: 2.4 },
  { year: 2023, month: 7, return: 18.5 }, { year: 2023, month: 8, return: 3.2 },
  { year: 2023, month: 9, return: 2.3 }, { year: 2023, month: 10, return: 2.5 },
  { year: 2023, month: 11, return: 5.1 }, { year: 2023, month: 12, return: 8.0 },
  // 2024
  { year: 2024, month: 1, return: 3.0 }, { year: 2024, month: 2, return: 8.9 },
  { year: 2024, month: 3, return: 4.9 }, { year: 2024, month: 4, return: 2.7 },
  { year: 2024, month: 5, return: 1.5 }, { year: 2024, month: 6, return: 5.9 },
  { year: 2024, month: 7, return: 0.1 }, { year: 2024, month: 8, return: 3.3 },
  { year: 2024, month: 9, return: 1.1 }, { year: 2024, month: 10, return: -1.4 },
  { year: 2024, month: 11, return: 4.5 }, { year: 2024, month: 12, return: 1.2 },
  // 2025
  { year: 2025, month: 1, return: 3.6 }, { year: 2025, month: 2, return: 22.3 },
  { year: 2025, month: 3, return: -0.0 }, { year: 2025, month: 4, return: 9.3 },
  { year: 2025, month: 5, return: 0.3 }, { year: 2025, month: 6, return: 0.1 },
  { year: 2025, month: 7, return: 2.9 }, { year: 2025, month: 8, return: 0.2 },
  { year: 2025, month: 9, return: 0.3 }, { year: 2025, month: 10, return: 1.6 },
  { year: 2025, month: 11, return: -0.6 }, { year: 2025, month: 12, return: 0.5 },
  // 2026
  { year: 2026, month: 1, return: 0.8 }, { year: 2026, month: 2, return: 11.6 },
];

// Last static data point
const STATIC_END = "2026-02";

function getCellBg(value: number | null): string {
  if (value === null) return "bg-bg-elevated";
  if (value >= 10) return "bg-pnl-positive/40";
  if (value >= 5) return "bg-pnl-positive/25";
  if (value >= 2) return "bg-pnl-positive/15";
  if (value > 0) return "bg-pnl-positive/8";
  if (value === 0) return "bg-bg-elevated";
  if (value > -2) return "bg-pnl-negative/8";
  if (value > -5) return "bg-pnl-negative/15";
  if (value > -10) return "bg-pnl-negative/25";
  return "bg-pnl-negative/40";
}

function getCellText(value: number | null): string {
  if (value === null) return "text-text-dim";
  if (value > 0) return "text-pnl-positive";
  if (value < 0) return "text-pnl-negative";
  return "text-text-muted";
}

export function MonthlyReturnsHeatmap() {
  // Fetch live data for months beyond the static tearsheet
  const { data } = useSWR("/api/bybit/monthly-returns", fetcher, {
    refreshInterval: 300000,
  });

  const liveReturns: MonthlyReturn[] = data?.returns ?? [];

  // Merge: static as base, live data overwrites for overlapping months after STATIC_END
  const yearMap = new Map<number, Map<number, number>>();

  for (const r of STATIC_MONTHLY) {
    if (!yearMap.has(r.year)) yearMap.set(r.year, new Map());
    yearMap.get(r.year)!.set(r.month, r.return);
  }

  // Add live data for months after static data ends
  for (const r of liveReturns) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (key > STATIC_END) {
      if (!yearMap.has(r.year)) yearMap.set(r.year, new Map());
      yearMap.get(r.year)!.set(r.month, r.return);
    }
  }

  const years = Array.from(yearMap.keys()).sort((a, b) => b - a);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Monthly Returns
      </span>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-[1px] text-text-muted">
                Year
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-[1px] text-text-muted"
                >
                  {m}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center text-[10px] uppercase tracking-[1px] text-text-muted">
                YTD
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const months = yearMap.get(year)!;
              const ytd = Array.from(months.values()).reduce(
                (sum, v) => sum + v,
                0
              );
              return (
                <tr key={year}>
                  <td className="px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                    {year}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(
                    (month) => {
                      const val = months.get(month) ?? null;
                      return (
                        <td key={month} className="px-0.5 py-0.5">
                          <div
                            className={cn(
                              "heatmap-cell flex h-7 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[10px]",
                              getCellBg(val),
                              getCellText(val)
                            )}
                            title={
                              val !== null
                                ? `${year} ${MONTHS[month - 1]}: ${val >= 0 ? "+" : ""}${val.toFixed(2)}%`
                                : ""
                            }
                          >
                            {val !== null
                              ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}`
                              : ""}
                          </div>
                        </td>
                      );
                    }
                  )}
                  <td className="px-0.5 py-0.5">
                    <div
                      className={cn(
                        "flex h-7 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[10px] font-medium",
                        getCellBg(ytd),
                        getCellText(ytd)
                      )}
                    >
                      {ytd >= 0 ? "+" : ""}
                      {ytd.toFixed(1)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
