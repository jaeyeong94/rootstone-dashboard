"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "1M" | "3M" | "6M" | "1Y" | "ALL";

const PERIOD_DAYS: Record<Period, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: 99999,
};

function filterByPeriod(curve: EquityCurvePoint[], period: Period): EquityCurvePoint[] {
  if (period === "ALL") return curve;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return curve.filter((p) => p.time >= cutoffStr);
}

export function EquityCurve() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof import("lightweight-charts").createChart>["addAreaSeries"]> | null>(null);
  const [period, setPeriod] = useState<Period>("ALL");
  const [chartReady, setChartReady] = useState(false);

  const { data, isLoading } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#888888",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#222222" },
          horzLines: { color: "#222222" },
        },
        width: chartContainerRef.current!.clientWidth,
        height: 360,
        rightPriceScale: { borderColor: "#333333" },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      const series = chart.addAreaSeries({
        lineColor: "#C5A049",
        lineWidth: 2,
        topColor: "rgba(197, 160, 73, 0.2)",
        bottomColor: "rgba(197, 160, 73, 0)",
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

  // Update data when data or period changes
  useEffect(() => {
    if (!chartReady || !seriesRef.current || !data?.curve?.length) return;

    const filtered = filterByPeriod(data.curve, period);
    seriesRef.current.setData(
      filtered.map((p: EquityCurvePoint) => ({
        time: p.time,
        value: p.value,
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [data, period, chartReady]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[1px] text-text-secondary">
          Equity Curve
        </span>
        <div className="flex gap-1">
          {(["1M", "3M", "6M", "1Y", "ALL"] as Period[]).map((p) => (
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

      <div className="mt-4">
        {isLoading ? (
          <div className="h-[360px] animate-pulse rounded bg-bg-elevated" />
        ) : data?.curve?.length === 0 ? (
          <div className="flex h-[360px] items-center justify-center text-sm text-text-muted">
            Collecting equity data...
          </div>
        ) : (
          <div ref={chartContainerRef} />
        )}
      </div>
    </div>
  );
}
