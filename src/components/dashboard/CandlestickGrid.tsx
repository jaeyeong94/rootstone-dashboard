"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useTickerStore } from "@/stores/useTickerStore";
import { useOrdersStore } from "@/stores/useOrdersStore";
import { cn, formatNumber, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Interval = "1h" | "4h" | "D";

const INTERVAL_MAP: Record<Interval, { api: string; limit: number }> = {
  "1h": { api: "60", limit: 72 },
  "4h": { api: "240", limit: 60 },
  D: { api: "D", limit: 1000 },
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

interface OpenOrder {
  orderId: string;
  symbol: string;
  side: string;
  price: string;
  qty: string;
  orderType: string;
}

function SingleCandleChart({
  symbol,
  label,
  interval,
  inceptionDate,
}: {
  symbol: string;
  label: string;
  interval: Interval;
  inceptionDate?: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLineRefs = useRef<any[]>([]);
  const [chartReady, setChartReady] = useState(false);

  const { api, limit } = INTERVAL_MAP[interval];

  // D 인터벌이고 inceptionDate 있으면 startTime 파라미터 추가
  const startTimeParam =
    interval === "D" && inceptionDate
      ? `&startTime=${new Date(inceptionDate).getTime()}`
      : "";

  const { data, isLoading } = useSWR(
    `/api/bybit/kline-spark?symbol=${symbol}&interval=${api}&limit=${limit}${startTimeParam}`,
    fetcher,
    { refreshInterval: 300000 }
  );

  const allOrders = useOrdersStore((s) => s.orders);

  const livePrice = useTickerStore((s) => s.getPrice(symbol));
  const change24h = useTickerStore((s) => s.getChange24h(symbol));
  const points: KlinePoint[] = useMemo(() => data?.points ?? [], [data]);
  const orders: OpenOrder[] = useMemo(
    () => allOrders.filter((o) => o.symbol === symbol),
    [allOrders, symbol]
  );

  // 24h 변동률: WebSocket ticker 데이터 (표준 24h 기준)
  const changePercent = change24h ? parseFloat(change24h) * 100 : 0;

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
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
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

  // Open order price lines
  useEffect(() => {
    if (!chartReady || !seriesRef.current) return;

    // 기존 price lines 제거
    priceLineRefs.current.forEach((pl) => {
      try {
        seriesRef.current?.removePriceLine(pl);
      } catch {}
    });
    priceLineRefs.current = [];

    // 새 price lines 추가 (Limit 오더만)
    orders
      .filter((o) => o.orderType === "Limit")
      .forEach((o) => {
        const priceVal = parseFloat(o.price);
        if (isNaN(priceVal) || priceVal <= 0) return;
        const pl = seriesRef.current!.createPriceLine({
          price: priceVal,
          color: o.side === "Buy" ? "#C5A049" : "#EF4444",
          lineWidth: 1,
          lineStyle: 2, // Dotted
          axisLabelVisible: false,
          title: "",
        });
        priceLineRefs.current.push(pl);
      });
  }, [orders, chartReady]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      {/* Header: Symbol · $Price · Change% (나란히 왼쪽 정렬) */}
      <div className="flex items-baseline gap-1.5">
        <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-text-primary">
          {label}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
          ${livePrice ? formatNumber(parseFloat(livePrice)) : "--"}
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
  const [interval, setInterval] = useState<Interval>("D");

  const { data: equityCurveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 0,
  });
  const inceptionDate: string | undefined = equityCurveData?.startDate ?? undefined;

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
            inceptionDate={inceptionDate}
          />
        ))}
      </div>
    </div>
  );
}
