"use client";

import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber } from "@/lib/utils";

const MARKETS = [
  { symbol: "BTCUSDT", name: "BTC", icon: "Bitcoin" },
  { symbol: "ETHUSDT", name: "ETH", icon: "Ethereum" },
  { symbol: "XRPUSDT", name: "XRP", icon: "Ripple" },
  { symbol: "LTCUSDT", name: "LTC", icon: "Litecoin" },
];

function MarketRow({ symbol, name }: { symbol: string; name: string }) {
  const ticker = useTickerStore((s) => s.tickers[symbol]);
  const price = ticker?.lastPrice;
  const change = ticker?.price24hPcnt;
  const changeNum = change ? parseFloat(change) * 100 : null;

  return (
    <div className="flex items-center justify-between rounded-sm bg-bg-elevated px-4 py-3 transition-colors hover:bg-bg-elevated/80">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-primary text-[11px] font-medium text-text-secondary">
          {name.charAt(0)}
        </div>
        <div>
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {name}
          </span>
          <span className="ml-1.5 text-[11px] text-text-muted">USDT</span>
        </div>
      </div>

      <div className="text-right">
        <div className="font-[family-name:var(--font-mono)] text-sm text-text-primary num-transition">
          {price ? formatNumber(parseFloat(price), parseFloat(price) < 1 ? 4 : 2) : "--"}
        </div>
        {changeNum !== null ? (
          <div
            className={cn(
              "font-[family-name:var(--font-mono)] text-[11px] num-transition",
              changeNum > 0
                ? "text-pnl-positive"
                : changeNum < 0
                  ? "text-pnl-negative"
                  : "text-text-muted"
            )}
          >
            {changeNum >= 0 ? "+" : ""}
            {changeNum.toFixed(2)}%
          </div>
        ) : (
          <div className="text-[11px] text-text-muted">--</div>
        )}
      </div>
    </div>
  );
}

export function MarketOverview() {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Market Overview
      </span>
      <div className="mt-3 space-y-1.5">
        {MARKETS.map((m) => (
          <MarketRow key={m.symbol} symbol={m.symbol} name={m.name} />
        ))}
      </div>
    </div>
  );
}
