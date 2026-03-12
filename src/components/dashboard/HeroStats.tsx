"use client";

import { useState } from "react";
import useSWR from "swr";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "24h" | "7d" | "30d" | "ALL";

export function HeroStats() {
  const [period, setPeriod] = useState<Period>("ALL");

  const { data: curveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });
  const { data: balanceData } = useSWR(
    `/api/bybit/balance?period=${period === "ALL" ? "30d" : period}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const curve: EquityCurvePoint[] = curveData?.curve ?? [];
  const sparklineData = curve.slice(-30);

  const displayValue =
    period === "ALL"
      ? (curve.length > 0 ? curve[curve.length - 1].value / 100 : 0)
      : (balanceData?.changePercent ?? 0);

  const animatedValue = useCountUp(displayValue, 800);
  const hasData = period === "ALL" ? curve.length > 0 : balanceData?.hasHistory;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Cumulative Return
        </span>
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "ALL"] as Period[]).map((p) => (
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

      <div className="mt-4 flex items-end justify-between gap-6">
        <div>
          {hasData ? (
            <span
              className={cn(
                "font-[family-name:var(--font-mono)] text-5xl font-medium glow-gold",
                getPnlColor(displayValue)
              )}
            >
              {formatPnlPercent(animatedValue)}
            </span>
          ) : (
            <span className="font-[family-name:var(--font-mono)] text-5xl font-medium text-text-muted">
              --
            </span>
          )}
          <p className="mt-1 text-xs text-text-muted">
            {period === "ALL" ? "Since inception" : `vs ${period} ago`}
          </p>
        </div>

        {sparklineData.length > 1 && (
          <div className="h-16 w-40 min-w-[160px]">
            <ResponsiveContainer width={160} height={64}>
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C5A049" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C5A049" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#C5A049"
                  strokeWidth={1.5}
                  fill="url(#sparkGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
