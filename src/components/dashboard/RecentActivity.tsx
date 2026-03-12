"use client";

import useSWR from "swr";
import { cn, formatNumber } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Execution {
  execId: string;
  execTime: string;
  symbol: string;
  side: string;
  execPrice: string;
  execQty: string;
  execFee: string;
}

export function RecentActivity() {
  const { data, isLoading } = useSWR("/api/bybit/executions?limit=8", fetcher, {
    refreshInterval: 30000,
  });

  const executions: Execution[] = data?.list ?? [];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Recent Activity
        </span>
        {executions.length > 0 && (
          <span className="text-[11px] text-text-muted">
            Last {executions.length} trades
          </span>
        )}
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            No recent activity
          </div>
        ) : (
          <div className="space-y-1">
            {executions.map((exec) => {
              const time = new Date(parseInt(exec.execTime));
              return (
                <div
                  key={exec.execId}
                  className="flex items-center justify-between rounded-sm bg-bg-elevated px-3 py-2.5 transition-colors hover:bg-bg-elevated/80"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        exec.side === "Buy" ? "bg-pnl-positive" : "bg-pnl-negative"
                      )}
                    />
                    <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
                      {exec.symbol.replace("USDT", "")}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-[1px]",
                        exec.side === "Buy"
                          ? "text-pnl-positive"
                          : "text-pnl-negative"
                      )}
                    >
                      {exec.side === "Buy" ? "BUY" : "SELL"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                      {formatNumber(parseFloat(exec.execPrice))} x{" "}
                      {formatNumber(parseFloat(exec.execQty), 4)}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {time.toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
