"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "1M" | "3M" | "6M" | "1Y" | "3Y" | "ALL";

const PERIOD_DAYS: Record<Period, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
  ALL: 99999,
};

function filterByPeriod<T extends { time: string }>(
  data: T[],
  period: Period
): T[] {
  if (period === "ALL") return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return data.filter((p) => p.time >= cutoffStr);
}

export function PerformanceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  const strategySeriesRef = useRef<ReturnType<
    ReturnType<
      typeof import("lightweight-charts").createChart
    >["addAreaSeries"]
  > | null>(null);
  const benchmarkSeriesRef = useRef<ReturnType<
    ReturnType<
      typeof import("lightweight-charts").createChart
    >["addLineSeries"]
  > | null>(null);
  const [period, setPeriod] = useState<Period>("ALL");

  const { data: curveData, isLoading: curveLoading } = useSWR(
    "/api/bybit/equity-curve",
    fetcher,
    { refreshInterval: 300000 }
  );
  const { data: benchmarkData } = useSWR(
    "/api/bybit/benchmark?symbol=BTCUSDT&limit=1000",
    fetcher,
    { refreshInterval: 3600000 }
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
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: chartContainerRef.current.clientWidth,
        height: 420,
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

      const strategySeries = chart.addAreaSeries({
        lineColor: "#C5A049",
        lineWidth: 2,
        topColor: "rgba(197, 160, 73, 0.15)",
        bottomColor: "rgba(197, 160, 73, 0)",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(2)}%`,
        },
        title: "Rebeta v3.1",
      });

      const benchmarkSeries = chart.addLineSeries({
        color: "#997B66",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(2)}%`,
        },
        title: "BTC",
      });

      chartRef.current = chart;
      strategySeriesRef.current = strategySeries;
      benchmarkSeriesRef.current = benchmarkSeries;

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
        strategySeriesRef.current = null;
        benchmarkSeriesRef.current = null;
      }
    };
  }, []);

  // Update data when data or period changes
  useEffect(() => {
    if (!strategySeriesRef.current) return;

    const curve: EquityCurvePoint[] = curveData?.curve ?? [];
    const benchmark: BenchmarkPoint[] = benchmarkData?.series ?? [];

    const filteredCurve = filterByPeriod(curve, period);
    const filteredBenchmark = filterByPeriod(benchmark, period);

    strategySeriesRef.current.setData(
      filteredCurve.map((p) => ({ time: p.time, value: p.value }))
    );

    benchmarkSeriesRef.current?.setData(
      filteredBenchmark.map((p) => ({ time: p.time, value: p.value }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [curveData, benchmarkData, period]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
            Performance
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-gold" />
              <span className="text-[10px] text-text-muted">Rebeta v3.1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 border-t border-dashed border-bronze" />
              <span className="text-[10px] text-text-muted">BTC</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {(["1M", "3M", "6M", "1Y", "3Y", "ALL"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-1 text-[11px] uppercase tracking-[1px] transition-colors",
                period === p
                  ? "text-bronze"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        {curveLoading && (
          <div className="absolute inset-0 z-10 h-[420px] animate-pulse rounded bg-bg-elevated" />
        )}
        <div ref={chartContainerRef} className="h-[420px]" />
      </div>
    </div>
  );
}
