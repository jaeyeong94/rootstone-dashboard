"use client";

import { Header } from "@/components/layout/Header";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, formatNumber, getPnlColor } from "@/lib/utils";

interface Execution {
  execId: string;
  execTime: string;
  symbol: string;
  side: string;
  execType: string;
  execPrice: string;
  execQty: string;
  execFee: string;
}

function ExecTypeBadge({ type }: { type: string }) {
  const label = type === "Funding" ? "FUNDING" : type === "Trade" ? "TRADE" : type.toUpperCase();
  const color =
    type === "Trade"
      ? "text-gold bg-gold/10"
      : type === "Funding"
        ? "text-text-muted bg-bg-primary"
        : "text-text-secondary bg-bg-primary";

  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.5px]", color)}>
      {label}
    </span>
  );
}

export default function HistoryPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (pageCursor: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (pageCursor) params.set("cursor", pageCursor);

    const res = await fetch(`/api/bybit/executions?${params}`);
    const data = await res.json();
    return data;
  }, []);

  // Initial load
  useEffect(() => {
    fetchPage("").then((data) => {
      setExecutions(data?.list ?? []);
      setCursor(data?.nextPageCursor ?? "");
      setHasMore(!!(data?.nextPageCursor));
      setIsLoading(false);
    });
  }, [fetchPage]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isFetchingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          setIsFetchingMore(true);
          fetchPage(cursor).then((data) => {
            const newItems: Execution[] = data?.list ?? [];
            setExecutions((prev) => [...prev, ...newItems]);
            setCursor(data?.nextPageCursor ?? "");
            setHasMore(!!(data?.nextPageCursor) && newItems.length > 0);
            setIsFetchingMore(false);
          });
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMore, isFetchingMore, fetchPage]);

  return (
    <div>
      <Header title="Trade History" />
      <div className="p-6">
        <div className="rounded-sm border border-border-subtle bg-bg-card">
          {/* Table Header */}
          <div className="sticky top-0 z-10 grid grid-cols-7 gap-4 border-b border-border-subtle bg-bg-card px-4 py-3 text-[11px] uppercase tracking-[1px] text-text-secondary">
            <span>Time</span>
            <span>Symbol</span>
            <span>Type</span>
            <span>Side</span>
            <span className="text-right">Price</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Fee</span>
          </div>

          {/* Table Body */}
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-bg-elevated" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-text-muted">
              No recent trades
            </div>
          ) : (
            <>
              {executions.map((exec) => (
                <div
                  key={exec.execId}
                  className="grid grid-cols-7 gap-4 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-bg-elevated"
                >
                  <span className="text-xs text-text-secondary">
                    {new Date(parseInt(exec.execTime)).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
                    {exec.symbol.replace("USDT", "")}
                  </span>
                  <span>
                    <ExecTypeBadge type={exec.execType} />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-[1px]",
                      exec.side === "Buy"
                        ? "text-pnl-positive"
                        : "text-pnl-negative"
                    )}
                  >
                    {exec.side === "Buy" ? "BUY" : "SELL"}
                  </span>
                  <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
                    {formatNumber(parseFloat(exec.execPrice))}
                  </span>
                  <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
                    {formatNumber(parseFloat(exec.execQty), 4)}
                  </span>
                  <span
                    className={cn(
                      "text-right font-[family-name:var(--font-mono)] text-xs",
                      getPnlColor(-parseFloat(exec.execFee))
                    )}
                  >
                    {formatNumber(parseFloat(exec.execFee), 6)}
                  </span>
                </div>
              ))}

              {/* Sentinel for infinite scroll */}
              <div ref={sentinelRef} className="h-1" />

              {isFetchingMore && (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-bronze" />
                </div>
              )}

              {!hasMore && executions.length > 0 && (
                <div className="py-4 text-center text-xs text-text-muted">
                  {executions.length} records loaded
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
