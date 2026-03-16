"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { AnimatedSparkline } from "./AnimatedSparkline";
import staticCurve from "@/data/cumulative-returns.json";
import type { EquityCurvePoint } from "@/types";
import { STRATEGY_INCEPTION_DATE } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INCEPTION_DATE = new Date(STRATEGY_INCEPTION_DATE);

function daysLive(): number {
  return Math.floor((Date.now() - INCEPTION_DATE.getTime()) / 86400000);
}

interface TearsheetData {
  mainMetrics: {
    cumulativeReturn: number;
    cagr: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
  };
}

export function HeroZone() {
  // Live tearsheet metrics from DB
  const { data: tearsheet } = useSWR<TearsheetData>(
    "/api/bybit/tearsheet",
    fetcher,
    { refreshInterval: 300000 }
  );

  const { data: curveData } = useSWR<{ curve: EquityCurvePoint[] }>(
    "/api/bybit/equity-curve",
    fetcher,
    { refreshInterval: 300000 }
  );

  // Static tearsheet + live compound extension
  const curve = useMemo(() => {
    const typed = staticCurve as { time: string; value: number }[];
    const liveCurve: EquityCurvePoint[] = curveData?.curve ?? [];
    const staticEndDate = typed.length > 0 ? typed[typed.length - 1].time : "";
    const liveAfterStatic = liveCurve.filter((p) => p.time > staticEndDate);

    if (liveAfterStatic.length > 0) {
      const staticEndValue = typed[typed.length - 1].value;
      const staticEndMultiplier = 1 + staticEndValue / 100;
      const liveAtStaticEnd = liveCurve.find((p) => p.time >= staticEndDate);
      const liveBaseline = liveAtStaticEnd?.value ?? liveAfterStatic[0].value;
      const liveBaselineMultiplier = 1 + liveBaseline / 100;
      const extension = liveAfterStatic.map((p) => ({
        time: p.time,
        value: (staticEndMultiplier * ((1 + p.value / 100) / liveBaselineMultiplier) - 1) * 100,
      }));
      return [...typed, ...extension];
    }

    return typed;
  }, [curveData]);

  const liveReady = !!curveData;
  const lastValue = curve.length > 0 ? curve[curve.length - 1].value / 100 : 0;
  const animatedReturn = useCountUp(liveReady ? lastValue : 0, 2000);

  const m = tearsheet?.mainMetrics;
  const kpis = [
    { label: "CAGR", value: m ? `${m.cagr}%` : "--" },
    { label: "Sharpe Ratio", value: m ? m.sharpe.toFixed(2) : "--" },
    { label: "Sortino Ratio", value: m ? m.sortino.toFixed(2) : "--" },
    { label: "Max Drawdown", value: m ? `${m.maxDrawdown}%` : "--" },
  ];

  return (
    <div className="relative flex min-h-[55vh] flex-col justify-between overflow-hidden border-b border-border-subtle pb-0">
      {/* 배경 그리드 패턴 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(153,123,102,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(153,123,102,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pt-6 xl:px-12">
        <p className="text-[11px] uppercase tracking-[2px] text-bronze/70">
          Rebeta v1~v3.1 · Algorithmic Strategy
        </p>

        <div className="mt-4">
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-5xl font-medium leading-none xl:text-6xl",
              liveReady ? getPnlColor(lastValue) : "text-text-muted",
              "glow-gold"
            )}
          >
            {liveReady ? formatPnlPercent(animatedReturn) : formatPnlPercent(0)}
          </span>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-text-muted">
            Cumulative Return · Since Mar 2021 ·{" "}
            <span className="text-bronze">{daysLive()} days live</span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-sm border border-border-subtle bg-bg-card/80 p-3 backdrop-blur-sm"
              style={{
                animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
              }}
            >
              <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
                {kpi.label}
              </p>
              <p className="mt-1.5 font-[family-name:var(--font-mono)] text-lg font-medium text-text-primary">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-auto opacity-60">
        <AnimatedSparkline data={curve} />
      </div>
    </div>
  );
}
