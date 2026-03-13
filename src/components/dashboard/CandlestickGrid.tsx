"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Interval = "1h" | "4h" | "D";

const INTERVAL_MAP: Record<Interval, { api: string; limit: number }> = {
  "1h": { api: "60", limit: 72 },
  "4h": { api: "240", limit: 60 },
  D: { api: "D", limit: 90 },
};

const SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC" },
  { symbol: "ETHUSDT", label: "ETH" },
  { symbol: "XRPUSDT", label: "XRP" },
  { symbol: "LTCUSDT", label: "LTC" },
];

interface KlinePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function SingleCandleChart({
  symbol,
  label,
  interval,
}: {
  symbol: string;
  label: string;
  interval: Interval;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  const seriesRef = useRef<ReturnType<
    ReturnType<
      typeof import("lightweight-charts").createChart
    >["addCandlestickSeries"]
  > | null>(null);
  const [chartReady, setChartReady] = useState(false);

  const { api, limit } = INTERVAL_MAP[interval];

  const { data, isLoading } = useSWR(
    `/api/bybit/kline-spark?symbol=${symbol}&interval=${api}&limit=${limit}`,
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

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (!chartContainerRef.current) return;
      if (chartRef.current) chartRef.current.remove();

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#888888",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: chartContainerRef.current.clientWidth,
        height: 180,
        rightPriceScale: {
          borderColor: "#333333",
          scaleMargins: { top: 0.1, bottom: 0.1 },
          minimumWidth: 60,
        },
        timeScale: {
          borderColor: "#333333",
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#C5A049",
        downColor: "#EF4444",
        borderUpColor: "#C5A049",
        borderDownColor: "#EF4444",
        wickUpColor: "#C5A049",
        wickDownColor: "#EF4444",
      });

      chartRef.current = chart;
      seriesRef.current = candleSeries;
      setChartReady(true);

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        setChartReady(false);
      }
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!chartReady || !seriesRef.current || points.length === 0) return;

    const candleData = points.map((p) => ({
      time: Math.floor(p.time / 1000) as import("lightweight-charts").Time,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));

    seriesRef.current.setData(candleData);
    chartRef.current?.timeScale().fitContent();
  }, [points, chartReady]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {label}
          </span>
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-xs",
              getPnlColor(changePercent)
            )}
          >
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>
        <span className="font-[family-name:var(--font-mono)] text-sm text-text-secondary">
          {livePrice ? formatNumber(parseFloat(livePrice)) : "--"}
        </span>
      </div>

      {/* Chart */}
      <div className="relative mt-2">
        {isLoading && (
          <div className="absolute inset-0 z-10 h-[180px] animate-pulse rounded bg-bg-elevated" />
        )}
        <div ref={chartContainerRef} className="h-[180px]" />
      </div>
    </div>
  );
}

export function CandlestickGrid() {
  const [interval, setInterval] = useState<Interval>("1h");

  return (
    <div>
      {/* Interval toggle (shared across all charts) */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Market Charts
        </span>
        <div className="flex gap-1">
          {(["1h", "4h", "D"] as Interval[]).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={cn(
                "px-2 py-1 text-[11px] uppercase tracking-[1px] transition-colors",
                interval === iv
                  ? "text-bronze"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* 2x2 grid — key includes interval so components remount on interval change */}
      <div className="grid grid-cols-2 gap-3">
        {SYMBOLS.map(({ symbol, label }) => (
          <SingleCandleChart
            key={`${symbol}-${interval}`}
            symbol={symbol}
            label={label}
            interval={interval}
          />
        ))}
      </div>
    </div>
  );
}
