"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { usePositionStore } from "@/stores/usePositionStore";
import { useOrdersStore } from "@/stores/useOrdersStore";
import type { BybitExecution } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatBlock({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[1px] text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-xl font-medium text-text-primary",
          valueClass
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-text-dim">{sub}</span>}
    </div>
  );
}

interface ExecutionsResponse {
  list: BybitExecution[];
  nextPageCursor: string;
}

function getTodayExecutions(list: BybitExecution[]): BybitExecution[] {
  const now = new Date();
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return list.filter((e) => Number(e.execTime) >= todayStart);
}

export function TodayStats() {
  const { data, error, isLoading } = useSWR<ExecutionsResponse>(
    "/api/bybit/executions?limit=200",
    fetcher,
    { refreshInterval: 30_000 }
  );

  // Track last update time
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const formatTime = useCallback((d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }), []);

  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  // Live stores
  const positions = usePositionStore((s) => s.positions);
  const totalEquity = usePositionStore((s) => s.totalEquity);
  const orderCount = useOrdersStore((s) => s.orders.length);

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card">
        <div className="border-b border-border-subtle px-4 py-3">
          <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
            Today Stats
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
              <div className="h-7 w-20 rounded bg-white/5 animate-pulse mt-0.5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.list) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card px-4 py-4">
        <span className="text-[11px] text-text-muted">executions unavailable</span>
      </div>
    );
  }

  const todayExecs = getTodayExecutions(data.list);

  // Realized PnL: sum of closedPnl from today's executions / totalEquity
  let realizedPnlUsdt = 0;
  for (const e of todayExecs) {
    realizedPnlUsdt += parseFloat(e.closedPnl || "0");
  }
  const realizedPnlPct = totalEquity > 0 ? realizedPnlUsdt / totalEquity : 0;

  // Portfolio Exposure: Σ(size × markPrice) / totalEquity
  let totalPositionValue = 0;
  for (const p of positions) {
    totalPositionValue += parseFloat(p.size) * parseFloat(p.markPrice);
  }
  const exposure = totalEquity > 0 ? (totalPositionValue / totalEquity) * 100 : 0;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Today Stats
        </span>
        {lastUpdated && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
            {formatTime(lastUpdated)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4">
        <StatBlock
          label="Realized PnL"
          value={formatPnlPercent(realizedPnlPct)}
          valueClass={getPnlColor(realizedPnlPct)}
        />
        <StatBlock
          label="Open Orders"
          value={orderCount.toString()}
        />
        <StatBlock
          label="Fills Today"
          value={todayExecs.length.toString()}
        />
        <StatBlock
          label="Exposure"
          value={`${exposure.toFixed(1)}%`}
        />
      </div>
    </div>
  );
}
