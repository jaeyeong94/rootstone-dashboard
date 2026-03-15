"use client";

import useSWR from "swr";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC" },
  { symbol: "ETHUSDT", label: "ETH" },
  { symbol: "XRPUSDT", label: "XRP" },
  { symbol: "LTCUSDT", label: "LTC" },
];

interface KlinePoint {
  time: number;
  close: number;
}

function MiniChart({ symbol, label }: { symbol: string; label: string }) {
  const { data, isLoading } = useSWR(
    `/api/bybit/kline-spark?symbol=${symbol}&interval=60&limit=48`,
    fetcher,
    { refreshInterval: 300000 }
  );

  const livePrice = useTickerStore((s) => s.getPrice(symbol));
  const points: KlinePoint[] = data?.points ?? [];

  const firstClose = points.length > 0 ? points[0].close : 0;
  const lastClose = livePrice
    ? parseFloat(livePrice)
    : points.length > 0
      ? points[points.length - 1].close
      : 0;
  const changePercent =
    firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const isPositive = changePercent >= 0;

  const chartColor = isPositive ? "#C5A049" : "#EF4444";

  const chartData = points.map((p) => ({ value: p.close }));

  // Determine decimal places: small prices (< 10) use 4 decimals
  const decimals = lastClose > 0 && lastClose < 10 ? 4 : 2;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
          {label}
        </span>
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-xs font-medium",
            getPnlColor(changePercent)
          )}
        >
          {isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </div>

      <div className="mt-1">
        <span className="font-[family-name:var(--font-mono)] text-lg font-medium text-text-primary">
          {livePrice
            ? formatNumber(parseFloat(livePrice), decimals)
            : points.length > 0
              ? formatNumber(lastClose, decimals)
              : "--"}
        </span>
        <span className="ml-1 text-[10px] text-text-dim">USDT</span>
      </div>

      <div className="mt-2 h-14">
        {isLoading ? (
          <div className="h-full animate-pulse rounded bg-bg-elevated" />
        ) : chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient
                  id={`grad-${label}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={chartColor}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={chartColor}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#grad-${label})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] text-text-dim">No data</span>
          </div>
        )}
      </div>

      <div className="mt-1 text-[10px] text-text-dim">48h · 1h interval</div>
    </div>
  );
}

export function MarketMiniCharts() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {SYMBOLS.map((s) => (
        <MiniChart key={s.symbol} symbol={s.symbol} label={s.label} />
      ))}
    </div>
  );
}
