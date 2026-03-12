"use client";

import { useEffect, useRef, useState } from "react";
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

function SinglePositionCard({ position }: { position: Position }) {
  const livePrice = useTickerStore((s) => s.getPrice(position.symbol));
  const currentPrice = livePrice || position.markPrice;
  const entryPrice = parseFloat(position.entryPrice);
  const pnlPercent =
    position.side === "Buy"
      ? (parseFloat(currentPrice) - entryPrice) / entryPrice
      : (entryPrice - parseFloat(currentPrice)) / entryPrice;

  const prevPnlRef = useRef(pnlPercent);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (Math.abs(pnlPercent - prevPnlRef.current) > 0.0001) {
      setFlash(pnlPercent > prevPnlRef.current ? "up" : "down");
      prevPnlRef.current = pnlPercent;
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
  }, [pnlPercent]);

  const priceMove = ((parseFloat(currentPrice) - entryPrice) / entryPrice) * 100;
  const barWidth = Math.min(Math.abs(priceMove) * 5, 100);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {position.symbol.replace("USDT", "")}
          </span>
          <span
            className={cn(
              "text-[10px] uppercase tracking-[1px]",
              position.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
            )}
          >
            {position.side === "Buy" ? "LONG" : "SHORT"}
          </span>
          <span className="text-[10px] text-text-dim">{position.leverage}x</span>
        </div>
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-lg font-medium",
            getPnlColor(pnlPercent),
            flash === "up" && "tick-up",
            flash === "down" && "tick-down"
          )}
        >
          {formatPnlPercent(pnlPercent)}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[10px]">
          <span className="text-text-muted">
            Entry {formatNumber(entryPrice)}
          </span>
          <span className={cn("font-[family-name:var(--font-mono)]", getPnlColor(pnlPercent))}>
            {formatNumber(parseFloat(currentPrice))}
          </span>
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-bg-elevated">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              pnlPercent >= 0 ? "bg-pnl-positive/50" : "bg-pnl-negative/50"
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function PositionCards() {
  const { data, isLoading } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 5000,
  });

  const positions: Position[] = data?.positions ?? [];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Open Positions
        </span>
        <span className="font-[family-name:var(--font-mono)] text-sm text-text-secondary">
          {positions.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <span className="text-sm text-text-muted">
              Waiting for signal...
            </span>
          </div>
        ) : (
          positions.map((pos) => (
            <SinglePositionCard key={pos.symbol} position={pos} />
          ))
        )}
      </div>
    </div>
  );
}
