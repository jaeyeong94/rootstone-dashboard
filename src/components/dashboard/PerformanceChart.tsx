"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";
import { V31_START_DATE, PERIOD_DAYS as PERIOD_DAYS_CONST } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "1M" | "3M" | "6M" | "1Y" | "3Y" | "ALL";

const PERIOD_DAYS: Record<Period, number> = {
  ...PERIOD_DAYS_CONST,
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
  const v1SeriesRef = useRef<ReturnType<
    ReturnType<
      typeof import("lightweight-charts").createChart
    >["addAreaSeries"]
  > | null>(null);
  const v31SeriesRef = useRef<ReturnType<
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
  const [chartReady, setChartReady] = useState(false);

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
  const btcBenchmark = useMemo(() => btcData?.series ?? [], [btcData]);

  // Split into v1 and v3.1
  const { v1Data, v31Data } = useMemo(() => {
    const v1 = rebetaCurve.filter((p) => p.time < V31_START_DATE);
    const v31 = rebetaCurve.filter((p) => p.time >= V31_START_DATE);
    return { v1Data: v1, v31Data: v31 };
  }, [rebetaCurve]);

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
        handleScroll: true,
        handleScale: true,
        timeScale: { borderColor: "#333333", timeVisible: false, fixLeftEdge: true, fixRightEdge: true },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      const priceFormat = {
        type: "custom" as const,
        formatter: (price: number) => `${price.toFixed(2)}%`,
      };

      // v1 series: bronze/muted area
      const v1Series = chart.addAreaSeries({
        lineColor: "#997B66",
        lineWidth: 2,
        topColor: "rgba(153, 123, 102, 0.10)",
        bottomColor: "rgba(153, 123, 102, 0)",
        priceFormat,
        title: "Rebeta v1",
      });

      // v3.1 series: gold area
      const v31Series = chart.addAreaSeries({
        lineColor: "#C5A049",
        lineWidth: 2,
        topColor: "rgba(197, 160, 73, 0.15)",
        bottomColor: "rgba(197, 160, 73, 0)",
        priceFormat,
        title: "Rebeta v3.1",
      });

      const benchmarkSeries = chart.addLineSeries({
        color: "#555555",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceFormat,
        title: "BTC",
      });

      chartRef.current = chart;
      v1SeriesRef.current = v1Series;
      v31SeriesRef.current = v31Series;
      benchmarkSeriesRef.current = benchmarkSeries;
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
        v1SeriesRef.current = null;
        v31SeriesRef.current = null;
        benchmarkSeriesRef.current = null;
        setChartReady(false);
      }
    };
  }, []);

  // Update data when data or period changes
  useEffect(() => {
    if (!chartReady || !v1SeriesRef.current || !v31SeriesRef.current) return;

    const filteredV1 = filterByPeriod(v1Data, period);
    const filteredV31 = filterByPeriod(v31Data, period);
    const filteredBenchmark = filterByPeriod(btcBenchmark, period);

    v1SeriesRef.current.setData(
      filteredV1.map((p) => ({ time: p.time, value: p.value }))
    );

    v31SeriesRef.current.setData(
      filteredV31.map((p) => ({ time: p.time, value: p.value }))
    );

    benchmarkSeriesRef.current?.setData(
      filteredBenchmark.map((p) => ({ time: p.time, value: p.value }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [v1Data, v31Data, btcBenchmark, period, chartReady]);

  return (
    <div className="min-w-0 rounded-sm border border-border-subtle bg-bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
            Performance
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-bronze" />
              <span className="text-[10px] text-text-muted">Rebeta v1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-gold" />
              <span className="text-[10px] text-text-muted">Rebeta v3.1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 border-t border-dashed border-text-muted" />
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
        {(curveLoading || btcLoading) && (
          <div className="absolute inset-0 z-10 h-[420px] animate-pulse rounded bg-bg-elevated" />
        )}
        <div ref={chartContainerRef} className="h-[420px]" />
      </div>
    </div>
  );
}
