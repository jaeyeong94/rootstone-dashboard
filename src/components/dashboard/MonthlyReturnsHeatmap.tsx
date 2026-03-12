"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { MonthlyReturn } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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
  const { data, isLoading } = useSWR("/api/bybit/monthly-returns", fetcher, {
    refreshInterval: 300000,
  });

  const returns: MonthlyReturn[] = data?.returns ?? [];

  const yearMap = new Map<number, Map<number, number>>();
  for (const r of returns) {
    if (!yearMap.has(r.year)) yearMap.set(r.year, new Map());
    yearMap.get(r.year)!.set(r.month, r.return);
  }

  const years = Array.from(yearMap.keys()).sort((a, b) => b - a);

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-4 h-32 animate-pulse rounded bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Monthly Returns
      </span>

      {returns.length === 0 ? (
        <div className="mt-4 flex h-24 items-center justify-center text-sm text-text-muted">
          Collecting data...
        </div>
      ) : (
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
      )}
    </div>
  );
}
