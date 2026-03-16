"use client";

import { useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Compute drawdown series from a cumulative return curve.
 *  Input: [{time, value}] where value is cumulative return %.
 *  Output: [{time, value}] where value is drawdown as a decimal (e.g. -0.15 = -15%).
 */
function computeDrawdown(curve: { time: string; value: number }[]): { time: string; value: number }[] {
  if (curve.length === 0) return [];

  let peakNav = 1 + curve[0].value / 100;
  return curve.map((p) => {
    const nav = 1 + p.value / 100;
    if (nav > peakNav) peakNav = nav;
    const dd = (nav - peakNav) / peakNav;
    return { time: p.time, value: dd };
  });
}

export function UnderwaterChart() {
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

  const rebetaDD = useMemo(() => computeDrawdown(curveData?.curve ?? []), [curveData]);
  const btcDD = useMemo(() => computeDrawdown(btcData?.series ?? []), [btcData]);

  useEffect(() => {
    if (!containerRef.current || rebetaDD.length === 0) return;

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
      const area = chart.addAreaSeries({
        lineColor: "#EF4444",
        lineWidth: 2,
        topColor: "rgba(239, 68, 68, 0)",
        bottomColor: "rgba(239, 68, 68, 0.3)",
        invertFilledArea: true,
        priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(1)}%` },
        title: "Rebeta DD",
        priceScaleId: "right",
      });
      area.setData(rebetaDD.map((p) => ({ time: p.time, value: p.value })));

      // BTC drawdown (underwater = 색칠을 선 위쪽 0까지)
      if (btcDD.length > 0) {
        const area2 = chart.addAreaSeries({
          lineColor: "#555555",
          lineWidth: 1,
          topColor: "rgba(85, 85, 85, 0.15)",
          bottomColor: "rgba(85, 85, 85, 0)",
          invertFilledArea: true,
          priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(1)}%` },
          title: "BTC DD",
          priceScaleId: "left",
        });
        area2.setData(btcDD.map((p) => ({ time: p.time, value: p.value })));
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
  }, [rebetaDD, btcDD]);

  if (curveLoading || btcLoading) {
    return <div className="h-[240px] animate-pulse rounded bg-bg-elevated" />;
  }

  return <div ref={containerRef} />;
}
