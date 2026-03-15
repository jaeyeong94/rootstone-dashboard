"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { UTCTimestamp } from "lightweight-charts";

interface DrawdownDataPoint {
  time: number; // UTCTimestamp (seconds since epoch)
  value: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DrawdownChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof import("lightweight-charts").createChart>["addAreaSeries"]> | null>(null);
  const [chartReady, setChartReady] = useState(false);

  const { data, isLoading } = useSWR("/api/bybit/drawdown", fetcher, {
    refreshInterval: 300000,
  });

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
          scaleMargins: { top: 0.05, bottom: 0.05 },
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

      const series = chart.addAreaSeries({
        lineColor: "#EF4444",
        lineWidth: 1,
        topColor: "rgba(239, 68, 68, 0.05)",
        bottomColor: "rgba(239, 68, 68, 0.25)",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(2)}%`,
        },
      });

      chartRef.current = chart;
      seriesRef.current = series;
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

  useEffect(() => {
    if (!chartReady || !seriesRef.current || !data?.series?.length) return;

    const series: DrawdownDataPoint[] = data.series;
    seriesRef.current.setData(
      series.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      }))
    );

    const minPoint = series.reduce(
      (min, p) => (p.value < min.value ? p : min),
      series[0]
    );

    if (minPoint) {
      seriesRef.current.setMarkers([
        {
          time: minPoint.time as UTCTimestamp,
          position: "belowBar",
          color: "#EF4444",
          shape: "arrowUp",
          text: `${minPoint.value.toFixed(1)}%`,
        },
      ]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, chartReady]);

  return (
    <div className="min-w-0 rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Drawdown
      </span>
      <div className="relative mt-3">
        {isLoading && (
          <div className="absolute inset-0 z-10 h-[200px] animate-pulse rounded bg-bg-elevated" />
        )}
        {!isLoading && !data?.series?.length ? (
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
