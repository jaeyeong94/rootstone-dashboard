"use client";

import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DailyBar {
  date: string;
  value: number;
}

export function PnLDistribution() {
  const { data, isLoading } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });

  const curve: EquityCurvePoint[] = data?.curve ?? [];

  const dailyBars: DailyBar[] = [];
  for (let i = 1; i < curve.length; i++) {
    dailyBars.push({
      date: curve[i].time,
      value: parseFloat((curve[i].value - curve[i - 1].value).toFixed(3)),
    });
  }

  const recentBars = dailyBars.slice(-60);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Daily P&L
      </span>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-[200px] animate-pulse rounded bg-bg-elevated" />
        ) : recentBars.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-text-muted">
            Collecting data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentBars} barCategoryGap="15%">
              <XAxis
                dataKey="date"
                tick={{ fill: "#555555", fontSize: 9, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#222222" }}
                tickLine={false}
                interval="preserveStartEnd"
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: "#555555", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161616",
                  border: "1px solid #333333",
                  borderRadius: "2px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#888888" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => {
                  if (value === undefined || value === null) return ["", "P&L"] as [string, string];
                  const num = typeof value === "number" ? value : parseFloat(String(value));
                  return [`${num >= 0 ? "+" : ""}${num.toFixed(3)}%`, "P&L"] as [string, string];
                }}
              />
              <ReferenceLine y={0} stroke="#333333" />
              <Bar dataKey="value" radius={[1, 1, 0, 0]}>
                {recentBars.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.value >= 0 ? "#C5A049" : "#EF4444"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
