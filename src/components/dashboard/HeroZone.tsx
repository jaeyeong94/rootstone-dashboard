"use client";

import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { AnimatedSparkline } from "./AnimatedSparkline";
import type { EquityCurvePoint, StrategyMetrics } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INCEPTION_DATE = new Date("2022-03-01");

function daysLive(): number {
  return Math.floor((Date.now() - INCEPTION_DATE.getTime()) / 86400000);
}

export function HeroZone() {
  const { data: curveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });
  const { data: metrics } = useSWR<StrategyMetrics>("/api/bybit/metrics", fetcher, {
    refreshInterval: 300000,
  });
  const { data: balanceData } = useSWR<{ changePercent: number }>(
    "/api/bybit/balance?period=24h",
    fetcher,
    { refreshInterval: 30000 }
  );

  const curve: EquityCurvePoint[] = curveData?.curve ?? [];
  const lastValue = curve.length > 0 ? curve[curve.length - 1].value / 100 : 0;
  const animatedReturn = useCountUp(lastValue, 2000);

  const kpis = [
    {
      label: "Sharpe Ratio",
      value: metrics?.sharpeRatio != null ? metrics.sharpeRatio.toFixed(2) : "--",
    },
    {
      label: "Sortino Ratio",
      value: metrics?.sortinoRatio != null ? metrics.sortinoRatio.toFixed(2) : "--",
    },
    {
      label: "Max Drawdown",
      value: metrics?.maxDrawdown != null ? `${metrics.maxDrawdown.toFixed(1)}%` : "--",
    },
    {
      label: "Win Rate",
      value: metrics?.winRate != null ? `${metrics.winRate.toFixed(1)}%` : "--",
    },
    {
      label: "Today",
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
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden border-b border-border-subtle pb-0">
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

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pt-8 lg:px-12">
        {/* 서브타이틀 */}
        <p className="text-[11px] uppercase tracking-[2px] text-bronze/70">
          Rebeta v3.1 · Algorithmic Strategy
        </p>

        {/* 누적 수익률 카운터 */}
        <div className="mt-6">
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-7xl font-medium leading-none lg:text-8xl",
              curve.length > 0 ? getPnlColor(lastValue) : "text-text-muted",
              "glow-gold"
            )}
          >
            {curve.length > 0 ? formatPnlPercent(animatedReturn) : "--"}
          </span>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-text-muted">
            Cumulative Return · Since Mar 2022 ·{" "}
            <span className="text-bronze">{daysLive()} days live</span>
          </p>
        </div>

        {/* KPI 5개 카드 */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-sm border border-border-subtle bg-bg-card/80 p-4 backdrop-blur-sm"
              style={{
                animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
              }}
            >
              <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
                {kpi.label}
              </p>
              <p
                className={cn(
                  "mt-1.5 font-[family-name:var(--font-mono)] text-xl font-medium",
                  kpi.color ?? "text-text-primary"
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단: 스파크라인 + 스크롤 힌트 */}
      <div className="relative z-10 mt-auto">
        <div className="px-0 opacity-60">
          <AnimatedSparkline data={curve} />
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="flex flex-col items-center gap-1 text-text-dim">
            <span className="text-[10px] uppercase tracking-[1px]">Scroll</span>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path
                d="M1 1l7 7 7-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
