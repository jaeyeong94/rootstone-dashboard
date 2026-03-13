"use client";

import { useEffect, useRef } from "react";
import rebetaData from "@/data/cumulative-returns.json";
import btcData from "@/data/cumulative-returns-btc.json";

const V31_START = "2024-11-17";

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

      const priceFormat = {
        type: "custom" as const,
        formatter: (p: number) => `${p.toFixed(1)}%`,
      };

      const typed = rebetaData as { time: string; value: number }[];

      // v1 series (bronze)
      const v1 = typed.filter((p) => p.time < V31_START);
      const v1Area = chart.addAreaSeries({
        lineColor: "#997B66",
        lineWidth: 2,
        topColor: "rgba(153, 123, 102, 0.10)",
        bottomColor: "rgba(153, 123, 102, 0)",
        priceFormat,
        title: "Rebeta v1",
      });
      v1Area.setData(v1.map((p) => ({ time: p.time, value: p.value })));

      // v3.1 series (gold)
      const v31 = typed.filter((p) => p.time >= V31_START);
      const v31Area = chart.addAreaSeries({
        lineColor: "#C5A049",
        lineWidth: 2,
        topColor: "rgba(197, 160, 73, 0.25)",
        bottomColor: "rgba(197, 160, 73, 0)",
        priceFormat,
        title: "Rebeta v3.1",
      });
      v31Area.setData(v31.map((p) => ({ time: p.time, value: p.value })));

      // BTC series
      const btcTyped = btcData as { time: string; value: number }[];
      const line = chart.addLineSeries({
        color: "#555555",
        lineWidth: 1,
        priceFormat,
        title: "BTC",
      });
      line.setData(btcTyped.map((p) => ({ time: p.time, value: p.value })));

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
