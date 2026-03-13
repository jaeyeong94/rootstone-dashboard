"use client";

import { benchmarkMetrics } from "@/lib/strategy-data";

const DISPLAY_METRICS = [
  {
    key: "Alpha",
    description: "Annualized excess return vs benchmark",
    btcLabel: "BTC: 0.00",
  },
  {
    key: "Beta",
    description: "Market sensitivity coefficient",
    btcLabel: "BTC: 1.00",
  },
  {
    key: "Correlation",
    description: "Pearson correlation with BTC",
    btcLabel: "BTC: 1.00",
  },
];

export function AlphaBetaCards() {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
        Market Independence
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        Near-zero market exposure confirms structurally independent alpha
      </p>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {DISPLAY_METRICS.map((m) => {
          const data = benchmarkMetrics.find((b) => b.metric === m.key);
          if (!data) return null;

          return (
            <div
              key={m.key}
              data-testid={`metric-card-${m.key.toLowerCase()}`}
              className="rounded-sm border border-border-subtle bg-bg-primary p-4"
            >
              <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-text-primary">
                {data.rebeta}
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {m.key}
              </p>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {m.description}
              </p>
              <p className="mt-2 text-[10px] font-[family-name:var(--font-mono)] text-text-muted">
                {m.btcLabel}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
