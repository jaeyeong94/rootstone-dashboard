"use client";

import { useEffect, useRef } from "react";
import chartData from "@/data/underwater.json";

export function UnderwaterChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (chartRef.current) chartRef.current.remove();

      const chart = createChart(containerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#BBBBBB",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: containerRef.current!.clientWidth,
        height: 240,
        rightPriceScale: { borderColor: "#333333" },
        leftPriceScale: { visible: true, borderColor: "#333333" },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      // Rebeta drawdown
      const rebetaSeries = chartData.find((s) => s.name === "daily_return");
      if (rebetaSeries) {
        const area = chart.addAreaSeries({
          lineColor: "#EF4444",
          lineWidth: 2,
          topColor: "rgba(239, 68, 68, 0.3)",
          bottomColor: "rgba(239, 68, 68, 0)",
          priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(1)}%` },
          title: "Rebeta DD",
          priceScaleId: "right",
        });
        area.setData(
          rebetaSeries.x.map((date: string, i: number) => ({
            time: date,
            value: rebetaSeries.y[i],
          }))
        );
      }

      // BTC drawdown
      const btcSeries = chartData.find((s) => s.name === "BTC");
      if (btcSeries) {
        const area2 = chart.addAreaSeries({
          lineColor: "#555555",
          lineWidth: 1,
          topColor: "rgba(85, 85, 85, 0)",
          bottomColor: "rgba(85, 85, 85, 0.15)",
          priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(1)}%` },
          title: "BTC DD",
          priceScaleId: "left",
        });
        area2.setData(
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
