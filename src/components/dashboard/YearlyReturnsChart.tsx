"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatReturn(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

interface TearsheetYearly {
  year: number;
  return: number;
}

export function YearlyReturnsChart() {
  const { data } = useSWR<{ yearlyReturns: TearsheetYearly[] }>(
    "/api/bybit/tearsheet",
    fetcher,
    { refreshInterval: 300000 }
  );

  const yearlyReturns = data?.yearlyReturns ?? [];

  if (yearlyReturns.length === 0) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">Yearly Returns</p>
        <div className="mt-4 flex h-32 items-center justify-center text-sm text-text-muted">Loading...</div>
      </div>
    );
  }

  const maxVal = Math.max(...yearlyReturns.map((y) => Math.abs(y.return)));

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
            Yearly Returns
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Rebeta annual performance (compounded from daily returns)
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {yearlyReturns.map((y) => (
          <div key={y.year} className="flex items-center gap-3">
            <span className="w-10 shrink-0 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
              {y.year}
            </span>
            <div className="flex items-center gap-2 flex-1">
              <div className="relative h-6 flex-1 rounded-sm bg-bg-elevated overflow-hidden">
                <div
                  data-testid={`bar-rebeta-${y.year}`}
                  className={cn(
                    "absolute top-0 h-full rounded-sm transition-all duration-500",
                    y.return >= 0
                      ? "left-1/2 bg-gold/70"
                      : "right-1/2 bg-pnl-negative/50"
                  )}
                  style={{
                    width: `${(Math.abs(y.return) / maxVal) * 50}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-primary/80">
                    {formatReturn(y.return)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
