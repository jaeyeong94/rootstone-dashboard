"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import { LiveIndicator } from "./LiveIndicator";
import type { StrategyMetrics } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MetricItemProps {
  label: string;
  value: string;
  color?: string;
}

function MetricItem({ label, value, color }: MetricItemProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-[1px] text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-sm font-medium",
          color || "text-text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function StrategyMetricsBar() {
  const { data, isLoading } = useSWR<StrategyMetrics>(
    "/api/bybit/metrics",
    fetcher,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="flex h-16 items-center justify-center rounded-sm border border-border-subtle bg-bg-card">
        <div className="h-3 w-64 animate-pulse rounded bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-sm border border-border-subtle bg-bg-card px-6 py-3">
      <div className="flex items-center gap-8">
        <MetricItem
          label="Sharpe"
          value={data?.sharpeRatio?.toFixed(2) ?? "--"}
          color={
            (data?.sharpeRatio ?? 0) >= 1.5
              ? "text-pnl-positive"
              : "text-text-primary"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Sortino"
          value={data?.sortinoRatio?.toFixed(2) ?? "--"}
          color={
            (data?.sortinoRatio ?? 0) >= 2
              ? "text-pnl-positive"
              : "text-text-primary"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Max DD"
          value={data?.maxDrawdown ? `${data.maxDrawdown.toFixed(1)}%` : "--"}
          color="text-pnl-negative"
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Win Rate"
          value={data?.winRate ? `${data.winRate.toFixed(0)}%` : "--"}
          color={
            (data?.winRate ?? 0) >= 55
              ? "text-pnl-positive"
              : "text-text-primary"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Avg Hold"
          value={
            data?.avgHoldingHours
              ? data.avgHoldingHours >= 24
                ? `${(data.avgHoldingHours / 24).toFixed(1)}d`
                : `${data.avgHoldingHours.toFixed(0)}h`
              : "--"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Trades"
          value={data?.totalTrades?.toString() ?? "--"}
        />
      </div>
      <LiveIndicator />
    </div>
  );
}
