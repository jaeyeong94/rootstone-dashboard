"use client";

import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { usePositionStore } from "@/stores/usePositionStore";
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

interface LatestNavResponse {
  date: string;
  dailyReturn: number;
  navIndex: number;
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

export function TodayStats() {
  const { data, error, isLoading } = useSWR<ExecutionsResponse>(
    "/api/bybit/executions?limit=200",
    fetcher,
    { refreshInterval: 30_000 }
  );

  const { data: navData } = useSWR<LatestNavResponse>(
    "/api/bybit/latest-nav",
    fetcher,
    { refreshInterval: 300_000 }
  );

  // Open positions from live store
  const positionCount = usePositionStore((s) => s.positions.length);

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
  const dailyReturn = navData?.dailyReturn ?? null;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card">
      <div className="border-b border-border-subtle px-4 py-3">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Today Stats
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4">
        <StatBlock
          label="Daily Return"
          value={dailyReturn != null ? formatPnlPercent(dailyReturn) : "--"}
          valueClass={dailyReturn != null ? getPnlColor(dailyReturn) : undefined}
          sub={navData?.date ? `${navData.date}` : undefined}
        />
        <StatBlock
          label="Open Positions"
          value={positionCount.toString()}
        />
        <StatBlock
          label="Fills Today"
          value={todayExecs.length.toString()}
        />
        <StatBlock
          label="Last Fill"
          value={
            todayExecs.length > 0
              ? new Date(Number(todayExecs[0].execTime)).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "--"
          }
        />
      </div>
    </div>
  );
}
