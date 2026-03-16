"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BenchmarkAsset {
  symbol: string;
  name: string;
  correlationWithRebeta: number;
  cagr: number;
  volatility: number;
  sharpe: number;
}

interface BenchmarkData {
  rebeta: BenchmarkAsset;
  benchmarks: BenchmarkAsset[];
}

/**
 * Alpha/Beta/Correlation cards — live from /api/correlation/benchmarks.
 */
export function AlphaBetaCards() {
  const { data } = useSWR<BenchmarkData>(
    "/api/correlation/benchmarks",
    fetcher,
    { refreshInterval: 3600000 }
  );

  const btc = data?.benchmarks?.find((b) => b.symbol === "BTC");
  const corr = btc?.correlationWithRebeta;

  const metrics = [
    {
      label: "Correlation",
      value: corr !== undefined ? (corr >= 0 ? `+${corr.toFixed(2)}` : corr.toFixed(2)) : "--",
      description: "Pearson correlation with BTC",
      btcLabel: "BTC: 1.00",
    },
    {
      label: "Sharpe",
      value: data?.rebeta ? data.rebeta.sharpe.toFixed(2) : "--",
      description: "Risk-adjusted return (live period)",
      btcLabel: btc ? `BTC: ${btc.sharpe.toFixed(2)}` : "BTC: --",
    },
    {
      label: "Volatility",
      value: data?.rebeta ? `${(data.rebeta.volatility * 100).toFixed(1)}%` : "--",
      description: "Annualized std deviation",
      btcLabel: btc ? `BTC: ${(btc.volatility * 100).toFixed(1)}%` : "BTC: --",
    },
  ];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
        Market Independence
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        Near-zero market exposure confirms structurally independent alpha
      </p>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            data-testid={`metric-card-${m.label.toLowerCase()}`}
            className="rounded-sm border border-border-subtle bg-bg-primary p-4"
          >
            <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-text-primary">
              {m.value}
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {m.label}
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">
              {m.description}
            </p>
            <p className="mt-2 text-[10px] font-[family-name:var(--font-mono)] text-text-muted">
              {m.btcLabel}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
