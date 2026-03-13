"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PRESETS = [
  { label: "$10K", value: 10000 },
  { label: "$50K", value: 50000 },
  { label: "$100K", value: 100000 },
];

function formatUSD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function GrowthSimulator() {
  const [amount, setAmount] = useState(10000);

  const { data } = useSWR<{
    curve: { time: string; value: number }[];
  }>("/api/bybit/equity-curve", fetcher, { refreshInterval: 300_000 });

  const lastReturn = useMemo(() => {
    if (!data?.curve?.length) return 0;
    return data.curve[data.curve.length - 1].value;
  }, [data]);

  const currentValue = amount * (1 + lastReturn / 100);
  const profit = currentValue - amount;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
        If You Invested
      </p>
      <p className="mt-1 text-xs text-text-muted">
        Growth simulation based on live Rebeta v3.1 performance
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_auto_1fr]">
        {/* Left: Input */}
        <div>
          <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
            Initial Investment
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-semibold text-text-primary">
            {formatUSD(amount)}
          </p>

          {/* Slider */}
          <input
            type="range"
            role="slider"
            min={1000}
            max={500000}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-4 w-full accent-bronze"
          />

          {/* Presets */}
          <div className="mt-3 flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setAmount(p.value)}
                className={cn(
                  "px-3 py-1.5 text-[10px] uppercase tracking-[1px] border transition-colors",
                  amount === p.value
                    ? "border-bronze text-bronze bg-bronze/10"
                    : "border-border-subtle text-text-muted hover:text-text-secondary hover:border-text-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden items-center xl:flex">
          <div className="text-2xl text-text-muted">&rarr;</div>
        </div>

        {/* Right: Result */}
        <div>
          <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
            Current Value
          </p>
          <p
            data-testid="current-value"
            className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-semibold text-gold"
          >
            {formatUSD(currentValue)}
          </p>

          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
                Return
              </p>
              <p
                data-testid="return-pct"
                className={cn(
                  "mt-1 font-[family-name:var(--font-mono)] text-lg font-semibold",
                  lastReturn >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                )}
              >
                {lastReturn >= 0 ? "+" : ""}
                {lastReturn.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
                Profit
              </p>
              <p
                data-testid="profit-amount"
                className={cn(
                  "mt-1 font-[family-name:var(--font-mono)] text-lg font-semibold",
                  profit >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                )}
              >
                {profit >= 0 ? "+" : ""}
                {formatUSD(profit)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
