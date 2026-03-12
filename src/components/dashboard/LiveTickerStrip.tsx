"use client";

import { useEffect, useRef, useState } from "react";
import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber } from "@/lib/utils";

const COINS = [
  { symbol: "BTCUSDT", name: "BTC" },
  { symbol: "ETHUSDT", name: "ETH" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "LTCUSDT", name: "LTC" },
];

function TickerItem({ symbol, name }: { symbol: string; name: string }) {
  const ticker = useTickerStore((s) => s.tickers[symbol]);
  const prevPriceRef = useRef<string | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const price = ticker?.lastPrice;
  const change = ticker?.price24hPcnt;
  const changeNum = change ? parseFloat(change) * 100 : null;

  useEffect(() => {
    if (!price || !prevPriceRef.current) {
      prevPriceRef.current = price ?? null;
      return;
    }
    if (price !== prevPriceRef.current) {
      const direction = parseFloat(price) > parseFloat(prevPriceRef.current) ? "up" : "down";
      setFlash(direction);
      prevPriceRef.current = price;
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
  }, [price]);

  return (
    <div className="flex items-center gap-3 rounded-sm bg-bg-elevated px-4 py-3">
      <span className="text-xs font-medium text-text-secondary">{name}</span>
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-sm text-text-primary",
          flash === "up" && "tick-up",
          flash === "down" && "tick-down"
        )}
      >
        {price
          ? formatNumber(parseFloat(price), parseFloat(price) < 1 ? 4 : 2)
          : "--"}
      </span>
      {changeNum !== null && (
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-[11px]",
            changeNum > 0
              ? "text-pnl-positive"
              : changeNum < 0
                ? "text-pnl-negative"
                : "text-text-muted"
          )}
        >
          {changeNum >= 0 ? "+" : ""}
          {changeNum.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export function LiveTickerStrip() {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Market
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-status-live animate-live-pulse" />
          <span className="text-[10px] uppercase tracking-[1px] text-status-live">
            Live
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {COINS.map((c) => (
          <TickerItem key={c.symbol} symbol={c.symbol} name={c.name} />
        ))}
      </div>
    </div>
  );
}
