"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn, formatNumber } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Execution {
  execId: string;
  symbol: string;
  side: "Buy" | "Sell";
  execQty: string;
  execPrice: string;
  closedSize: string;
  execTime: string;
}

function timeAgo(ms: string): string {
  const diff = Date.now() - parseInt(ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function ExecutionsFeed() {
  const { data } = useSWR("/api/bybit/executions?limit=20", fetcher, {
    refreshInterval: 10000,
  });

  const executions: Execution[] = data?.list ?? [];
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (executions.length === 0) return;
    const currentIds = new Set(executions.map((e) => e.execId));
    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!prevIdsRef.current.has(id) && prevIdsRef.current.size > 0) {
        fresh.add(id);
      }
    });
    if (fresh.size > 0) {
      setNewIds(fresh);
      setTimeout(() => setNewIds(new Set()), 1500);
    }
    prevIdsRef.current = currentIds;
  }, [executions]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Executions Feed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-[live-pulse_2s_ease-in-out_infinite] rounded-full bg-status-live" />
          <span className="text-[10px] text-status-live">Live</span>
        </span>
      </div>

      <div className="mt-3 space-y-1 overflow-hidden">
        {executions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-text-muted">No recent executions</span>
          </div>
        ) : (
          executions.slice(0, 8).map((ex) => {
            const isNew = newIds.has(ex.execId);
            const closedSize = parseFloat(ex.closedSize);
            return (
              <div
                key={ex.execId}
                className={cn(
                  "flex items-center justify-between rounded-sm px-3 py-2 transition-all duration-500",
                  isNew ? "bg-bronze/10 slide-in-top" : "hover:bg-bg-elevated"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "w-1 h-4 rounded-full shrink-0",
                      ex.side === "Buy" ? "bg-pnl-positive" : "bg-pnl-negative"
                    )}
                  />
                  <span className="font-[family-name:var(--font-mono)] text-xs text-text-primary truncate">
                    {ex.symbol.replace("USDT", "")}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[1px]",
                      ex.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
                    )}
                  >
                    {ex.side === "Buy" ? "L" : "S"}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                    @{formatNumber(parseFloat(ex.execPrice))}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {closedSize > 0 && (
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">
                      -{formatNumber(closedSize, 4)}
                    </span>
                  )}
                  <span className="text-[10px] text-text-dim w-12 text-right">
                    {timeAgo(ex.execTime)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
