"use client";

import { Header } from "@/components/layout/Header";
import { usePositionStore } from "@/stores/usePositionStore";
import { cn, getPnlColor, formatPnlPercent } from "@/lib/utils";
import { V31_START_DATE } from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "@/types";

/* ─── Closed PnL record ─── */
interface ClosedPnlRecord {
  orderId: string;
  symbol: string;
  side: string;
  qty: string;
  avgEntryPrice: string;
  closedPnl: string;
  leverage: string;
  execType: string;
  createdTime: string;
  updatedTime: string;
  totalEquityAtTime: number;
}

/* ═══════════════════════════════════════════════════════════════
   Page: Positions (top) + Trade History (bottom)
   ═══════════════════════════════════════════════════════════════ */

export default function PositionsPage() {
  return (
    <div>
      <Header title="Positions" />
      <div className="space-y-8 p-6">
        <OpenPositions />
        <TradeHistory />
      </div>
    </div>
  );
}

/* ─── Open Positions ─── */

function OpenPositions() {
  const positions = usePositionStore((s) => s.positions);
  const isLoading = usePositionStore((s) => s.isLoading);

  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[2px] text-bronze">
        Open Positions
      </p>
      <div className="rounded-sm border border-border-subtle bg-bg-card">
        <div className="grid grid-cols-5 gap-4 border-b border-border-subtle px-4 py-3 text-[11px] uppercase tracking-[1px] text-text-secondary">
          <span>Symbol</span>
          <span>Side</span>
          <span className="text-right">PnL %</span>
          <span className="text-right">Leverage</span>
          <span className="text-right">Holding</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            No open positions — Waiting for signal...
          </div>
        ) : (
          positions.map((pos) => (
            <PositionRow key={pos.symbol + pos.side} position={pos} />
          ))
        )}
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const totalEquity = usePositionStore((s) => s.totalEquity);
  const unrealisedPnl = parseFloat(position.unrealisedPnl);
  const pnlPercent = totalEquity > 0 ? unrealisedPnl / totalEquity : 0;

  const entryMs = parseInt(position.entryTime || position.createdTime || "0");
  const holdingTime = entryMs > 0
    ? Math.floor((Date.now() - entryMs) / (1000 * 60 * 60))
    : 0;

  return (
    <div className="grid grid-cols-5 gap-4 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-bg-elevated">
      <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
        {position.symbol.replace("USDT", "")}
      </span>

      <span
        className={cn(
          "text-[11px] uppercase tracking-[1px]",
          position.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
        )}
      >
        {position.side === "Buy" ? "LONG" : "SHORT"}
      </span>

      <span
        className={cn(
          "text-right font-[family-name:var(--font-mono)] text-sm num-transition",
          getPnlColor(pnlPercent)
        )}
      >
        {formatPnlPercent(pnlPercent, 6)}
      </span>

      <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
        {position.leverage}x
      </span>

      <span className="text-right text-xs text-text-muted">
        {holdingTime > 0 ? `${holdingTime}h` : "<1h"}
      </span>
    </div>
  );
}

/* ─── Trade History (Closed PnL, time-windowed infinite scroll) ─── */

// v3.1 inception — stop fetching beyond this date
const V31_START_MS = new Date(V31_START_DATE).getTime();

function TradeHistory() {
  const [records, setRecords] = useState<ClosedPnlRecord[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [endTime, setEndTime] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (pageCursor: string, pageEndTime: number) => {
    const params = new URLSearchParams({ limit: "100", endTime: String(pageEndTime) });
    if (pageCursor) params.set("cursor", pageCursor);
    const res = await fetch(`/api/bybit/pnl?${params}`);
    return res.json();
  }, []);

  type PnlResponse = {
    list?: ClosedPnlRecord[];
    nextPageCursor?: string;
    nextEndTime?: number | null;
    error?: string;
  };

  // Fetch a page, and if the window is empty, auto-advance to the next window
  const fetchWithAutoAdvance = useCallback(
    async (
      pageCursor: string,
      pageEndTime: number,
      maxSkips = 20
    ): Promise<{ items: ClosedPnlRecord[]; cursor: string; nextEnd: number | null }> => {
      let currentEndTime = pageEndTime;
      let currentCursor = pageCursor;
      const allItems: ClosedPnlRecord[] = [];

      for (let i = 0; i < maxSkips; i++) {
        const data: PnlResponse = await fetchPage(currentCursor, currentEndTime);
        if (data?.error) throw new Error(data.error);

        const items: ClosedPnlRecord[] = data?.list ?? [];
        allItems.push(...items);

        if (data?.nextPageCursor) {
          // More pages in current window — return with cursor
          return { items: allItems, cursor: data.nextPageCursor, nextEnd: currentEndTime };
        }

        if (data?.nextEndTime && data.nextEndTime > V31_START_MS) {
          if (items.length > 0) {
            // Had results, let client trigger next window on scroll
            return { items: allItems, cursor: "", nextEnd: data.nextEndTime };
          }
          // Empty window — auto-advance immediately
          currentEndTime = data.nextEndTime;
          currentCursor = "";
          continue;
        }

        // No more windows
        return { items: allItems, cursor: "", nextEnd: null };
      }

      return { items: allItems, cursor: "", nextEnd: null };
    },
    [fetchPage]
  );

  useEffect(() => {
    fetchWithAutoAdvance("", Date.now())
      .then(({ items, cursor: c, nextEnd }) => {
        setRecords(items);
        setCursor(c);
        if (c) {
          setEndTime(Date.now());
          setHasMore(true);
        } else if (nextEnd) {
          setEndTime(nextEnd);
          setHasMore(true);
        } else {
          setHasMore(false);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setLoadError("Failed to load trade history");
        setIsLoading(false);
      });
  }, [fetchWithAutoAdvance]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isFetchingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          setIsFetchingMore(true);
          fetchWithAutoAdvance(cursor, endTime)
            .then(({ items, cursor: c, nextEnd }) => {
              setRecords((prev) => [...prev, ...items]);
              setCursor(c);
              if (c) {
                setHasMore(true);
              } else if (nextEnd) {
                setEndTime(nextEnd);
                setHasMore(true);
              } else {
                setHasMore(false);
              }
              setIsFetchingMore(false);
            })
            .catch(() => {
              setIsFetchingMore(false);
            });
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cursor, endTime, hasMore, isFetchingMore, fetchWithAutoAdvance]);

  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[2px] text-bronze">
        Trade History
      </p>
      <div className="rounded-sm border border-border-subtle bg-bg-card">
        <div className="sticky top-0 z-10 grid grid-cols-5 gap-4 border-b border-border-subtle bg-bg-card px-4 py-3 text-[11px] uppercase tracking-[1px] text-text-secondary">
          <span>Time</span>
          <span>Symbol</span>
          <span>Side</span>
          <span className="text-right">Price</span>
          <span className="text-right">PnL %</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex h-48 items-center justify-center text-sm text-pnl-negative">
            {loadError}
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            No recent trades
          </div>
        ) : (
          <>
            {records.map((rec, idx) => {
              const pnlUsdt = parseFloat(rec.closedPnl || "0");
              const equity = rec.totalEquityAtTime || 0;
              const pnlPercent = equity > 0 ? (pnlUsdt / equity) * 100 : 0;
              return (
                <div
                  key={`${rec.orderId}-${rec.updatedTime}-${idx}`}
                  className="grid grid-cols-5 gap-4 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-bg-elevated"
                >
                  <span className="text-xs text-text-secondary">
                    {new Date(parseInt(rec.updatedTime)).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
                    {rec.symbol.replace("USDT", "")}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-[1px]",
                      rec.execType === "Funding"
                        ? "text-text-muted"
                        : rec.side === "Buy"
                          ? "text-pnl-positive"
                          : "text-pnl-negative"
                    )}
                  >
                    {rec.execType === "Funding"
                      ? "FUNDING"
                      : rec.execType === "AdlTrade"
                        ? "ADL"
                        : rec.execType === "BustTrade"
                          ? "LIQUID"
                          : rec.side === "Buy"
                            ? "OPEN"
                            : "CLOSE"}
                  </span>
                  <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
                    {rec.avgEntryPrice
                      ? parseFloat(rec.avgEntryPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "—"}
                  </span>
                  <span
                    className={cn(
                      "text-right font-[family-name:var(--font-mono)] text-sm",
                      getPnlColor(pnlPercent)
                    )}
                  >
                    {formatPnlPercent(pnlPercent / 100, 6)}
                  </span>
                </div>
              );
            })}

            <div ref={sentinelRef} className="h-1" />

            {isFetchingMore && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-bronze" />
              </div>
            )}

            {!hasMore && records.length > 0 && (
              <div className="py-4 text-center text-xs text-text-muted">
                {records.length} records loaded
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
