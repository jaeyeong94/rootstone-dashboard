"use client";

import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor, formatRelativeTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MetricCardProps {
  label: string;
  value: string;
  valueColor?: string;
}

function MetricCard({ label, value, valueColor }: MetricCardProps) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        {label}
      </span>
      <div
        className={cn(
          "mt-2 font-[family-name:var(--font-mono)] text-2xl font-medium",
          valueColor || "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function MetricsGrid() {
  const { data: balanceData } = useSWR("/api/bybit/balance?period=24h", fetcher, {
    refreshInterval: 30000,
  });
  const { data: posData } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 5000,
  });

  const todayChangePercent = balanceData?.changePercent ?? 0;
  const positionCount = posData?.count ?? 0;

  // Last position update as proxy for last rebalance
  const lastUpdate = posData?.positions?.[0]?.updatedTime;
  const lastRebalance = lastUpdate
    ? formatRelativeTime(new Date(parseInt(lastUpdate)))
    : "-";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        label="24h Change"
        value={
          balanceData?.hasHistory
            ? formatPnlPercent(todayChangePercent)
            : "--"
        }
        valueColor={
          balanceData?.hasHistory
            ? getPnlColor(todayChangePercent)
            : undefined
        }
      />
      <MetricCard
        label="Open Positions"
        value={positionCount.toString()}
      />
      <MetricCard
        label="Last Rebalance"
        value={lastRebalance}
      />
      <MetricCard
        label="Strategy"
        value="Rebeta v3.1"
        valueColor="text-bronze"
      />
    </div>
  );
}
