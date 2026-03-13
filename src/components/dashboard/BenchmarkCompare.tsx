"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BenchmarkCompare() {
  const { data: curveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });

  const startDate: string | null = curveData?.startDate ?? null;

  const { data: benchData } = useSWR(
    startDate
      ? `/api/bybit/benchmark?symbol=BTCUSDT&limit=1800&startDate=${startDate}`
      : null,
    fetcher,
    { refreshInterval: 3600000 }
  );

  const curve: EquityCurvePoint[] = curveData?.curve ?? [];
  const btc: BenchmarkPoint[] = useMemo(
    () => benchData?.series ?? [],
    [benchData]
  );

  const rebetaLast = curve.length > 0 ? curve[curve.length - 1].value : 0;
  const btcLast = btc.length > 0 ? btc[btc.length - 1].value : 0;
  const alpha = rebetaLast - btcLast;

  const btcMap = useMemo(() => new Map(btc.map((b) => [b.time, b])), [btc]);

  // 차트용 다운샘플 (최대 60포인트)
  const step = Math.max(1, Math.floor(curve.length / 60));
  const chartData = curve
    .filter((_, i) => i % step === 0)
    .map((c) => {
      const btcPoint = btcMap.get(c.time);
      return {
        time: c.time,
        rebeta: parseFloat(c.value.toFixed(2)),
        btc: btcPoint ? parseFloat(btcPoint.value.toFixed(2)) : null,
      };
    });

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        vs BTC Benchmark
      </span>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-text-muted">Rebeta v3.1</p>
          <p
            className={cn(
              "mt-1 font-[family-name:var(--font-mono)] text-2xl font-medium",
              rebetaLast >= 0 ? "text-pnl-positive" : "text-pnl-negative"
            )}
          >
            {rebetaLast >= 0 ? "+" : ""}
            {rebetaLast.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">BTC (Hold)</p>
          <p
            className={cn(
              "mt-1 font-[family-name:var(--font-mono)] text-2xl font-medium",
              btcLast >= 0 ? "text-bronze" : "text-pnl-negative"
            )}
          >
            {btcLast >= 0 ? "+" : ""}
            {btcLast.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-gold/30 bg-gold/5 px-2 py-1">
        <span className="text-[10px] text-text-muted">Alpha</span>
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-xs font-medium",
            alpha >= 0 ? "text-pnl-positive" : "text-pnl-negative"
          )}
        >
          {alpha >= 0 ? "+" : ""}
          {alpha.toFixed(1)}%
        </span>
      </div>

      {chartData.length > 1 && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" hide />
              <Tooltip
                contentStyle={{
                  background: "#161616",
                  border: "1px solid #2A2A2A",
                  borderRadius: "2px",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => {
                  if (value == null) return ["—"];
                  const num = typeof value === "number" ? value : parseFloat(String(value));
                  return [isNaN(num) ? "—" : `${num.toFixed(2)}%`];
                }}
                labelFormatter={() => ""}
              />
              <Line
                type="monotone"
                dataKey="rebeta"
                stroke="#C5A049"
                strokeWidth={1.5}
                dot={false}
                name="Rebeta"
              />
              <Line
                type="monotone"
                dataKey="btc"
                stroke="#997B66"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="BTC"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
