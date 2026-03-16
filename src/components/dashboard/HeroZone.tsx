"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { AnimatedSparkline } from "./AnimatedSparkline";
import staticCurve from "@/data/cumulative-returns.json";
import type { EquityCurvePoint } from "@/types";
import { STRATEGY_INCEPTION_DATE, COMPOSITE_TEARSHEET } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INCEPTION_DATE = new Date(STRATEGY_INCEPTION_DATE);

function daysLive(): number {
  return Math.floor((Date.now() - INCEPTION_DATE.getTime()) / 86400000);
}

export function HeroZone() {
  const { data: balanceData } = useSWR<{ changePercent: number }>(
    "/api/bybit/balance?period=30d",
    fetcher,
    { refreshInterval: 60000 }
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
      // Compound rebase: R_t = S_mul × (C_mul / L_mul) - 1
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

  const kpis = [
    {
      label: "Sharpe Ratio",
      value: COMPOSITE_TEARSHEET.sharpe.toFixed(2),
    },
    {
      label: "Sortino Ratio",
      value: COMPOSITE_TEARSHEET.sortino.toFixed(2),
    },
    {
      label: "Max Drawdown",
      value: `${COMPOSITE_TEARSHEET.maxDrawdown.toFixed(1)}%`,
    },
    {
      label: "30D Return",
      value:
        balanceData?.changePercent != null
          ? formatPnlPercent(balanceData.changePercent)
          : "--",
      color:
        balanceData?.changePercent != null
          ? getPnlColor(balanceData.changePercent)
          : undefined,
    },
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
        {/* 서브타이틀 */}
        <p className="text-[11px] uppercase tracking-[2px] text-bronze/70">
          Rebeta v1~v3.1 · Algorithmic Strategy
        </p>

        {/* 누적 수익률 카운터 */}
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

        {/* KPI 카드 */}
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
              <p
                className={cn(
                  "mt-1.5 font-[family-name:var(--font-mono)] text-lg font-medium",
                  kpi.color ?? "text-text-primary"
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단: 스파크라인 */}
      <div className="relative z-10 mt-auto opacity-60">
        <AnimatedSparkline data={curve} />
      </div>
    </div>
  );
}
