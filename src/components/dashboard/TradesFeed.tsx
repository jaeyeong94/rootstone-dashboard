"use client";

import useSWR from "swr";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Execution {
  execId: string;
  execTime: string;
  symbol: string;
  side: string;
  execPrice: string;
  execQty: string;
}

export function TradesFeed() {
  const { data, isLoading } = useSWR("/api/bybit/executions?limit=10", fetcher, {
    refreshInterval: 15000,
  });

  const executions: Execution[] = data?.list ?? [];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Recent Trades
        </span>
        {executions.length > 0 && (
          <span className="text-[10px] text-text-muted">
            {executions.length} trades
          </span>
        )}
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            No recent trades
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border-subtle" />
            <div className="space-y-1">
              {executions.map((exec, index) => {
                const time = new Date(parseInt(exec.execTime));
                const isBuy = exec.side === "Buy";

                return (
                  <div
                    key={exec.execId}
                    className={cn(
                      "relative flex items-center gap-3 rounded-sm py-2 pl-5 pr-3 transition-colors hover:bg-bg-elevated/50",
                      index === 0 && "animate-slide-in"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute left-[4px] h-[7px] w-[7px] rounded-full",
                        isBuy ? "bg-pnl-positive" : "bg-pnl-negative"
                      )}
                    />

                    <div className="flex flex-1 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
                          {exec.symbol.replace("USDT", "")}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-[1px]",
                            isBuy ? "text-pnl-positive" : "text-pnl-negative"
                          )}
                        >
                          {isBuy ? "BUY" : "SELL"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                          {formatNumber(parseFloat(exec.execPrice))} x{" "}
                          {formatNumber(parseFloat(exec.execQty), 4)}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatRelativeTime(time)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
