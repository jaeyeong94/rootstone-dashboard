"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { AnimatedSparkline } from "./AnimatedSparkline";
import staticCurve from "@/data/cumulative-returns.json";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INCEPTION_DATE = new Date("2021-03-02");

function daysLive(): number {
  return Math.floor((Date.now() - INCEPTION_DATE.getTime()) / 86400000);
}

// Tearsheet composite metrics (v1~v3.1, 2021.03.02 ~ 2026.02.16)
const COMPOSITE = {
  sharpe: "1.91",
  sortino: "3.22",
  maxDrawdown: "-22.0%",
};

export function HeroZone() {
  const { data: balanceData } = useSWR<{ changePercent: number }>(
    "/api/bybit/balance?period=30d",
    fetcher,
    { refreshInterval: 60000 }
  );

  // Use static cumulative returns for the sparkline and headline number
  const curve = useMemo(
    () =>
      (staticCurve as { time: string; value: number }[]).map((p) => ({
        time: p.time,
        value: p.value,
      })),
    []
  );
  const lastValue = curve.length > 0 ? curve[curve.length - 1].value / 100 : 0;
  const animatedReturn = useCountUp(lastValue, 2000);

  const kpis = [
    {
      label: "Sharpe Ratio",
      value: COMPOSITE.sharpe,
    },
    {
      label: "Sortino Ratio",
      value: COMPOSITE.sortino,
    },
    {
      label: "Max Drawdown",
      value: COMPOSITE.maxDrawdown,
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

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pt-6 lg:px-12">
        {/* 서브타이틀 */}
        <p className="text-[11px] uppercase tracking-[2px] text-bronze/70">
          Rebeta v1~v3.1 · Algorithmic Strategy
        </p>

        {/* 누적 수익률 카운터 */}
        <div className="mt-4">
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-5xl font-medium leading-none lg:text-6xl",
              curve.length > 0 ? getPnlColor(lastValue) : "text-text-muted",
              "glow-gold"
            )}
          >
            {curve.length > 0 ? formatPnlPercent(animatedReturn) : "--"}
          </span>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-text-muted">
            Cumulative Return · Since Mar 2021 ·{" "}
            <span className="text-bronze">{daysLive()} days live</span>
          </p>
        </div>

        {/* KPI 카드 */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
