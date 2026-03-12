"use client";

import { useEffect, useRef } from "react";
import chartData from "@/data/cumulative-returns.json";

export function CumulativeReturnsChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
        height: 320,
        rightPriceScale: { borderColor: "#333333" },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      // Rebeta series
      const rebetaSeries = chartData.find((s) => s.name === "daily_return");
      if (rebetaSeries) {
        const area = chart.addAreaSeries({
          lineColor: "#C5A049",
          lineWidth: 2,
          topColor: "rgba(197, 160, 73, 0.25)",
          bottomColor: "rgba(197, 160, 73, 0)",
          priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(1)}%` },
          title: "Rebeta",
        });
        area.setData(
          rebetaSeries.x.map((date: string, i: number) => ({
            time: date,
            value: rebetaSeries.y[i],
          }))
        );
      }

      // BTC series
      const btcSeries = chartData.find((s) => s.name === "BTC");
      if (btcSeries) {
        const line = chart.addLineSeries({
          color: "#555555",
          lineWidth: 1,
          priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(1)}%` },
          title: "BTC",
        });
        line.setData(
          btcSeries.x.map((date: string, i: number) => ({
            time: date,
            value: btcSeries.y[i],
          }))
        );
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
  }, []);

  return <div ref={containerRef} />;
}
