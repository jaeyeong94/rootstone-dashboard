"use client";

import { useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import type { RollingMetricPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RollingSharpeChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);

  const { data: metricsData, isLoading } = useSWR<{
    sharpe: RollingMetricPoint[];
    volatility: RollingMetricPoint[];
    btcSharpe?: RollingMetricPoint[];
  }>(
    "/api/bybit/rolling-metrics?window=365",
    fetcher,
    { refreshInterval: 300000 }
  );

  const sharpeData = useMemo(() => metricsData?.sharpe ?? [], [metricsData]);
  const btcSharpeData = useMemo(() => metricsData?.btcSharpe ?? [], [metricsData]);

  useEffect(() => {
    if (!containerRef.current || sharpeData.length === 0) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (chartRef.current) chartRef.current.remove();

      const chart = createChart(containerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#888888",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: containerRef.current!.clientWidth,
        height: 280,
        rightPriceScale: { borderColor: "#333333" },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      // Rebeta Rolling Sharpe
      const line = chart.addLineSeries({
        color: "#C5A049",
        lineWidth: 2,
        priceFormat: { type: "custom", formatter: (p: number) => p.toFixed(2) },
        title: "Rebeta",
      });
      line.setData(
        sharpeData
          .filter((d) => d.value !== null && d.value !== undefined)
          .map((d) => ({ time: d.time, value: d.value }))
      );

      // BTC Rolling Sharpe
      if (btcSharpeData.length > 0) {
        const btcLine = chart.addLineSeries({
          color: "#555555",
          lineWidth: 1,
          priceFormat: { type: "custom", formatter: (p: number) => p.toFixed(2) },
          title: "BTC",
        });
        btcLine.setData(
          btcSharpeData
            .filter((d) => d.value !== null && d.value !== undefined)
            .map((d) => ({ time: d.time, value: d.value }))
        );
      }

      // Zero line
      if (sharpeData.length > 0) {
        const zeroLine = chart.addLineSeries({
          color: "#333333",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        zeroLine.setData([
          { time: sharpeData[0].time, value: 0 },
          { time: sharpeData[sharpeData.length - 1].time, value: 0 },
        ]);
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;

      const handleResize = () => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [sharpeData, btcSharpeData]);

  if (isLoading) {
    return <div className="h-[280px] animate-pulse rounded bg-bg-elevated" />;
  }

  return <div ref={containerRef} />;
}
