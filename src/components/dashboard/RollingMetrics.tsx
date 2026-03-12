"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { RollingMetricPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RollingMetrics() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const sharpeSeriesRef = useRef<ReturnType<ReturnType<typeof import("lightweight-charts").createChart>["addLineSeries"]> | null>(null);
  const volSeriesRef = useRef<ReturnType<ReturnType<typeof import("lightweight-charts").createChart>["addLineSeries"]> | null>(null);

  const { data, isLoading } = useSWR(
    "/api/bybit/rolling-metrics?window=30",
    fetcher,
    { refreshInterval: 300000 }
  );

  // Initialize chart once
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
        height: 200,
        rightPriceScale: {
          borderColor: "#333333",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      const sharpeSeries = chart.addLineSeries({
        color: "#C5A049",
        lineWidth: 2,
        title: "Sharpe (30d)",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => price.toFixed(2),
        },
      });

      const volSeries = chart.addLineSeries({
        color: "#997B66",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: "Vol (30d)",
        priceScaleId: "vol",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(1)}%`,
        },
      });

      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
      });

      chartRef.current = chart;
      sharpeSeriesRef.current = sharpeSeries;
      volSeriesRef.current = volSeries;

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
        sharpeSeriesRef.current = null;
        volSeriesRef.current = null;
      }
    };
  }, []);

  // Update data when data changes
  useEffect(() => {
    if (!sharpeSeriesRef.current || !data) return;

    const sharpe: RollingMetricPoint[] = data.sharpe ?? [];
    const volatility: RollingMetricPoint[] = data.volatility ?? [];

    sharpeSeriesRef.current.setData(
      sharpe.map((p) => ({ time: p.time, value: p.value }))
    );
    volSeriesRef.current?.setData(
      volatility.map((p) => ({ time: p.time, value: p.value }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center gap-4">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Rolling Metrics (30d)
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 bg-gold" />
            <span className="text-[9px] text-text-muted">Sharpe</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 border-t border-dashed border-bronze" />
            <span className="text-[9px] text-text-muted">Volatility</span>
          </div>
        </div>
      </div>
      <div className="relative mt-3">
        {isLoading && (
          <div className="absolute inset-0 z-10 h-[200px] animate-pulse rounded bg-bg-elevated" />
        )}
        {!isLoading && !data?.sharpe?.length ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-text-muted">
            Collecting data...
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[200px]" />
        )}
      </div>
    </div>
  );
}
