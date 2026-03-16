"use client";

import { useEffect, useRef } from "react";
import chartData from "@/data/rolling-sharpe.json";

export function RollingSharpeChart() {
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
        height: 280,
        rightPriceScale: { borderColor: "#333333" },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      // Helper to filter out null values
      function toValidData(series: { x: string[]; y: (number | null)[] }) {
        return series.x
          .map((date: string, i: number) => ({ time: date, value: series.y[i] }))
          .filter((d): d is { time: string; value: number } => d.value !== null && d.value !== undefined);
      }

      // Rebeta Rolling Sharpe
      const rebetaSeries = chartData.find((s) => s.name === "daily_return");
      if (rebetaSeries) {
        const line = chart.addLineSeries({
          color: "#C5A049",
          lineWidth: 2,
          priceFormat: { type: "custom", formatter: (p: number) => p.toFixed(2) },
          title: "Rebeta",
        });
        line.setData(toValidData(rebetaSeries));
      }

      // BTC Rolling Sharpe
      const btcSeries = chartData.find((s) => s.name === "BTC");
      if (btcSeries) {
        const line2 = chart.addLineSeries({
          color: "#555555",
          lineWidth: 1,
          priceFormat: { type: "custom", formatter: (p: number) => p.toFixed(2) },
          title: "BTC",
        });
        line2.setData(toValidData(btcSeries));
      }

      // Zero line
      const zeroLine = chart.addLineSeries({
        color: "#333333",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const rebeta = chartData.find((s) => s.name === "daily_return");
      if (rebeta && rebeta.x.length > 0) {
        zeroLine.setData([
          { time: rebeta.x[0], value: 0 },
          { time: rebeta.x[rebeta.x.length - 1], value: 0 },
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
  }, []);

  return <div ref={containerRef} />;
}
