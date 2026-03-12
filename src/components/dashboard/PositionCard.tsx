"use client";

import useSWR from "swr";
import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber, formatPnlPercent, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Position {
  symbol: string;
  side: "Buy" | "Sell";
  size: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  unrealisedPnl: string;
}

export function PositionCard() {
  const { data, isLoading } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
        <div className="h-4 w-32 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-bg-elevated" />
          ))}
        </div>
      </div>
    );
  }

  const positions: Position[] = data?.positions ?? [];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[1px] text-text-secondary">
          Open Positions
        </span>
        <span className="font-[family-name:var(--font-mono)] text-sm text-text-secondary">
          {positions.length}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {positions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-text-muted">
              Waiting for signal...
            </span>
          </div>
        ) : (
          positions.map((pos) => (
            <PositionRow key={pos.symbol} position={pos} />
          ))
        )}
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const livePrice = useTickerStore((s) => s.getPrice(position.symbol));
  const currentPrice = livePrice || position.markPrice;
  const entryPrice = parseFloat(position.entryPrice);
  const pnlPercent =
    position.side === "Buy"
      ? (parseFloat(currentPrice) - entryPrice) / entryPrice
      : (entryPrice - parseFloat(currentPrice)) / entryPrice;

  return (
    <div className="flex items-center justify-between rounded-sm bg-bg-elevated px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
          {position.symbol.replace("USDT", "")}
        </span>
        <span
          className={cn(
            "text-[11px] uppercase tracking-[1px]",
            position.side === "Buy"
              ? "text-pnl-positive"
              : "text-pnl-negative"
          )}
        >
          {position.side === "Buy" ? "LONG" : "SHORT"}
        </span>
        <span className="text-xs text-text-muted">
          {position.leverage}x
        </span>
      </div>

      <div className="text-right">
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-sm num-transition",
            getPnlColor(pnlPercent)
          )}
        >
          {formatPnlPercent(pnlPercent)}
        </span>
        <div className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
          {formatNumber(parseFloat(currentPrice))}
        </div>
      </div>
    </div>
  );
}
