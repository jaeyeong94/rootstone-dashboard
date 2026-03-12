"use client";

import { Header } from "@/components/layout/Header";
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
  liqPrice: string;
  createdTime: string;
  updatedTime: string;
}

export default function PositionsPage() {
  const { data, isLoading } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 5000,
  });

  const positions: Position[] = data?.positions ?? [];

  return (
    <div>
      <Header title="Positions" />
      <div className="p-6">
        <div className="rounded-sm border border-border-subtle bg-bg-card">
          {/* Table Header */}
          <div className="grid grid-cols-7 gap-4 border-b border-border-subtle px-4 py-3 text-[11px] uppercase tracking-[1px] text-text-secondary">
            <span>Symbol</span>
            <span>Side</span>
            <span className="text-right">Size</span>
            <span className="text-right">Entry Price</span>
            <span className="text-right">Mark Price</span>
            <span className="text-right">PnL (%)</span>
            <span className="text-right">Leverage</span>
          </div>

          {/* Table Body */}
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded bg-bg-elevated"
                />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-text-muted">
              No open positions — Waiting for signal...
            </div>
          ) : (
            positions.map((pos) => (
              <PositionRow key={pos.symbol + pos.side} position={pos} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const livePrice = useTickerStore((s) => s.getPrice(position.symbol));
  const currentPrice = livePrice || position.markPrice;
  const entry = parseFloat(position.entryPrice);
  const mark = parseFloat(currentPrice);
  const pnlPercent =
    position.side === "Buy"
      ? (mark - entry) / entry
      : (entry - mark) / entry;

  const holdingTime = position.createdTime
    ? Math.floor(
        (Date.now() - parseInt(position.createdTime)) / (1000 * 60 * 60)
      )
    : 0;

  return (
    <div className="grid grid-cols-7 gap-4 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-bg-elevated">
      <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
        {position.symbol.replace("USDT", "")}
        <span className="ml-1 text-xs text-text-muted">
          {holdingTime > 0 ? `${holdingTime}h` : "<1h"}
        </span>
      </span>

      <span
        className={cn(
          "text-[11px] uppercase tracking-[1px]",
          position.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
        )}
      >
        {position.side === "Buy" ? "LONG" : "SHORT"}
      </span>

      <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
        {formatNumber(parseFloat(position.size), 4)}
      </span>

      <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
        {formatNumber(entry)}
      </span>

      <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-primary num-transition">
        {formatNumber(mark)}
      </span>

      <span
        className={cn(
          "text-right font-[family-name:var(--font-mono)] text-sm num-transition",
          getPnlColor(pnlPercent)
        )}
      >
        {formatPnlPercent(pnlPercent)}
      </span>

      <span className="text-right font-[family-name:var(--font-mono)] text-sm text-text-secondary">
        {position.leverage}x
      </span>
    </div>
  );
}
