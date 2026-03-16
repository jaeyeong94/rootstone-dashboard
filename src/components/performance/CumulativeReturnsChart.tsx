"use client";

import { useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { V31_START_DATE } from "@/lib/constants";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CumulativeReturnsChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);

  const { data: curveData, isLoading: curveLoading } = useSWR<{ curve: EquityCurvePoint[] }>(
    "/api/bybit/equity-curve",
    fetcher,
    { refreshInterval: 300000 }
  );

  const { data: btcData, isLoading: btcLoading } = useSWR<{ series: BenchmarkPoint[] }>(
    "/api/bybit/benchmark?symbol=BTCUSDT&limit=2000&startDate=2021-03-02",
    fetcher,
    { refreshInterval: 300000 }
  );

  const rebetaCurve = useMemo(() => curveData?.curve ?? [], [curveData]);
  const btcCurve = useMemo(() => btcData?.series ?? [], [btcData]);

  useEffect(() => {
    if (!containerRef.current || rebetaCurve.length === 0) return;

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

      // v1 series (bronze)
      const v1 = rebetaCurve.filter((p) => p.time < V31_START_DATE);
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
      const v31 = rebetaCurve.filter((p) => p.time >= V31_START_DATE);
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
      if (btcCurve.length > 0) {
        const line = chart.addLineSeries({
          color: "#555555",
          lineWidth: 1,
          priceFormat,
          title: "BTC",
        });
        line.setData(btcCurve.map((p) => ({ time: p.time, value: p.value })));
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
  }, [rebetaCurve, btcCurve]);

  if (curveLoading || btcLoading) {
    return <div className="h-[320px] animate-pulse rounded bg-bg-elevated" />;
  }

  return <div ref={containerRef} />;
}
