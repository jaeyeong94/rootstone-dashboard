"use client";

import { useState } from "react";
import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "24h" | "7d" | "30d";

export function BalanceCard() {
  const [period, setPeriod] = useState<Period>("24h");
  const { data, isLoading } = useSWR(
    `/api/bybit/balance?period=${period}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const changePercent = data?.changePercent ?? 0;
  const hasHistory = data?.hasHistory ?? false;

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-4 h-12 w-40 animate-pulse rounded bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      {/* Period Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[1px] text-text-secondary">
          Balance Change
        </span>
        <div className="flex gap-1">
          {(["24h", "7d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-1 text-[11px] uppercase tracking-[1px] transition-colors",
                period === p
                  ? "text-bronze"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Change Value */}
      <div className="mt-4">
        {hasHistory ? (
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-4xl font-medium num-transition",
              getPnlColor(changePercent)
            )}
          >
            {formatPnlPercent(changePercent)}
          </span>
        ) : (
          <span className="font-[family-name:var(--font-mono)] text-4xl font-medium text-text-muted">
            --
          </span>
        )}
      </div>

      {/* Sub label */}
      <p className="mt-2 text-xs text-text-muted">
        {!hasHistory
          ? "Collecting data..."
          : period === "24h"
            ? "vs 24 hours ago"
            : period === "7d"
              ? "vs 7 days ago"
              : "vs 30 days ago"}
      </p>
    </div>
  );
}
