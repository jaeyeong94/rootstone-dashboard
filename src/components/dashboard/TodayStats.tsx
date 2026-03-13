"use client";

import useSWR from "swr";
import { cn, formatNumber } from "@/lib/utils";
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
  return list.filter((e) => {
    const ts = Number(e.execTime);
    return ts >= todayStart;
  });
}

interface TodayStatsData {
  totalCount: number;
  longCount: number;
  shortCount: number;
  totalVolume: number;
  largestTrade: number;
  totalFee: number;
}

function calcStats(executions: BybitExecution[]): TodayStatsData {
  let longCount = 0;
  let shortCount = 0;
  let totalVolume = 0;
  let largestTrade = 0;
  let totalFee = 0;

  for (const e of executions) {
    const price = parseFloat(e.execPrice);
    const qty = parseFloat(e.execQty);
    const fee = parseFloat(e.execFee);
    const notional = price * qty;

    if (e.side === "Buy") longCount++;
    else shortCount++;

    totalVolume += notional;
    if (notional > largestTrade) largestTrade = notional;
    totalFee += fee;
  }

  return {
    totalCount: executions.length,
    longCount,
    shortCount,
    totalVolume,
    largestTrade,
    totalFee,
  };
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${formatNumber(value, 0)}`;
}

export function TodayStats() {
  const { data, error, isLoading } = useSWR<ExecutionsResponse>(
    "/api/bybit/executions?limit=200",
    fetcher,
    { refreshInterval: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
            <div className="h-7 w-24 rounded bg-white/5 animate-pulse mt-0.5" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.list) {
    return (
      <div className="text-[11px] text-text-muted">
        executions unavailable
      </div>
    );
  }

  const todayExecs = getTodayExecutions(data.list);
  const stats = calcStats(todayExecs);

  const longRatio =
    stats.totalCount > 0
      ? Math.round((stats.longCount / stats.totalCount) * 100)
      : 0;
  const shortRatio = 100 - longRatio;

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
      <StatBlock
        label="Today Trades"
        value={stats.totalCount.toString()}
        sub="UTC 00:00 기준"
      />
      <StatBlock
        label="Long / Short"
        value={`${longRatio}% / ${shortRatio}%`}
        sub={`${stats.longCount}L · ${stats.shortCount}S`}
      />
      <StatBlock
        label="Total Volume"
        value={formatVolume(stats.totalVolume)}
        sub={stats.totalCount > 0 ? `avg ${formatVolume(stats.totalVolume / stats.totalCount)}` : "—"}
      />
      <StatBlock
        label="Largest Trade"
        value={stats.largestTrade > 0 ? formatVolume(stats.largestTrade) : "—"}
        sub={stats.totalFee > 0 ? `fees $${formatNumber(stats.totalFee, 2)}` : undefined}
      />
    </div>
  );
}
