"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn, formatNumber } from "@/lib/utils";
import type { BybitExecution } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function timeAgo(ms: string): string {
  const diff = Date.now() - parseInt(ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export function ExecutionsSidebar() {
  const { data } = useSWR("/api/bybit/executions?limit=50", fetcher, {
    refreshInterval: 10000,
  });

  const executions: BybitExecution[] = data?.list ?? [];
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (executions.length === 0) return;
    const currentIds = new Set<string>(executions.map((e) => e.execId));
    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!prevIdsRef.current.has(id) && prevIdsRef.current.size > 0) {
        fresh.add(id);
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (fresh.size > 0) {
      setNewIds(fresh);
      timer = setTimeout(() => setNewIds(new Set()), 1500);
    }
    prevIdsRef.current = currentIds;
    return () => clearTimeout(timer);
  }, [executions]);

  return (
    <div className="flex flex-col rounded-sm border border-border-subtle bg-bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          History
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-[live-pulse_2s_ease-in-out_infinite] rounded-full bg-status-live" />
          <span className="text-[10px] text-status-live">Live</span>
        </span>
      </div>

      {/* Scrollable list */}
      <div className="max-h-[260px] overflow-y-auto">
        {executions.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <span className="text-xs text-text-muted">No executions</span>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {executions.slice(0, 30).map((ex) => {
              const isNew = newIds.has(ex.execId);
              const isLong = ex.side === "Buy";
              return (
                <div
                  key={ex.execId}
                  className={cn(
                    "flex items-center justify-between px-4 py-2 transition-colors duration-500",
                    isNew ? "bg-bronze/10" : "hover:bg-bg-elevated"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "shrink-0 rounded-sm px-1 py-0.5 text-[9px] uppercase tracking-[1px]",
                        isLong
                          ? "bg-pnl-positive/15 text-pnl-positive"
                          : "bg-pnl-negative/15 text-pnl-negative"
                      )}
                    >
                      {isLong ? "L" : "S"}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-text-primary truncate">
                      {ex.symbol.replace("USDT", "")}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted truncate">
                      @{formatNumber(parseFloat(ex.execPrice))}
                    </span>
                  </div>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-text-dim">
                    {timeAgo(ex.execTime)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
