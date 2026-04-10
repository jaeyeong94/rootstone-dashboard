"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface MatrixData {
  period: string;
  assets: string[];
  matrix: number[][];
  rollingCorrelation: Record<string, string | number>[];
  rollingKeys: string[];
}

interface FrontierData {
  frontier: {
    btcWeight: number;
    rebetaWeight: number;
    expectedReturn: number;
    volatility: number;
    sharpe: number;
  }[];
  optimal: { btcWeight: number; rebetaWeight: number };
  days: number;
}

interface BenchmarkAsset {
  symbol: string;
  name: string;
  cumulativeReturn: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  correlationWithRebeta: number;
}

interface BenchmarkData {
  rebeta: BenchmarkAsset;
  benchmarks: BenchmarkAsset[];
  cumulativeCurves: Record<string, { date: string; value: number }[]>;
  dataRange: { start: string; end: string; days: number };
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function getCorrelationColor(value: number): string {
  if (value >= 0.7) return "bg-pnl-negative/60";
  if (value >= 0.3) return "bg-pnl-negative/30";
  if (value > -0.3) return "bg-bg-elevated";
  if (value > -0.7) return "bg-blue-500/30";
  return "bg-blue-500/60";
}

function getCorrelationTextColor(value: number): string {
  if (Math.abs(value) >= 0.7) return "text-text-primary font-semibold";
  if (Math.abs(value) >= 0.3) return "text-text-primary";
  return "text-text-secondary";
}

function formatPct(v: number, digits = 2): string {
  const pct = v * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

const BENCHMARK_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  SPY: "#4A90D9",
  QQQ: "#7B68EE",
  GLD: "#DAA520",
  IEF: "#20B2AA",
};

const ROLLING_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SPY: "#4A90D9",
  QQQ: "#7B68EE",
  GLD: "#DAA520",
  IEF: "#20B2AA",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Correlation Heatmap Cell
   ═══════════════════════════════════════════════════════════════ */

function CorrelationCell({
  value,
  isDiagonal,
}: {
  value: number;
  isDiagonal: boolean;
}) {
  if (isDiagonal) {
    return (
      <div className="flex h-12 w-full items-center justify-center rounded-sm bg-bg-elevated border border-border-subtle">
        <span className="font-[family-name:var(--font-mono)] text-xs text-bronze">
          1.00
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-12 w-full flex-col items-center justify-center rounded-sm border border-border-subtle transition-colors",
        getCorrelationColor(value)
      )}
    >
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-xs",
          getCorrelationTextColor(value)
        )}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}
      </span>
      <span className="mt-0.5 text-[8px] uppercase tracking-[0.5px] text-text-muted">
        {Math.abs(value) >= 0.7
          ? "strong"
          : Math.abs(value) >= 0.3
            ? "mod"
            : "weak"}
      </span>
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

type Period = "30" | "90" | "180" | "365";

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "180", label: "180D" },
  { key: "365", label: "365D" },
];

export default function CorrelationPage() {
  const [period, setPeriod] = useState<Period>("90");
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [frontierData, setFrontierData] = useState<FrontierData | null>(null);
  const [frontierLoading, setFrontierLoading] = useState(true);

  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(true);

  // Fetch correlation matrix when period changes
  useEffect(() => {
    setMatrixLoading(true);
    setMatrixError(null);
    fetch(`/api/correlation/matrix?period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setMatrixData(data);
      })
      .catch((e) => setMatrixError(e.message))
      .finally(() => setMatrixLoading(false));
  }, [period]);

  // Fetch efficient frontier + benchmarks once
  useEffect(() => {
    setFrontierLoading(true);
    fetch("/api/correlation/frontier?period=365")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setFrontierData(data);
      })
      .catch(() => {})
      .finally(() => setFrontierLoading(false));

    setBenchmarkLoading(true);
    fetch("/api/correlation/benchmarks")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setBenchmarkData(data);
      })
      .catch(() => {})
      .finally(() => setBenchmarkLoading(false));
  }, []);

  const assets = matrixData?.assets ?? ["Rebeta", "BTC", "ETH"];
  const matrix = matrixData?.matrix ?? null;

  const optimal = frontierData?.optimal;

  /* ─ Insight text ─ */
  function buildInsightText(): string {
    if (!frontierData?.optimal || !matrixData) return "";
    const { btcWeight: optBtc, rebetaWeight: optRebeta } = frontierData.optimal;
    const rebetaBtcCorr = matrixData.matrix[0]?.[1] ?? 0;
    const corrDesc =
      Math.abs(rebetaBtcCorr) < 0.3
        ? "near-zero correlation"
        : Math.abs(rebetaBtcCorr) < 0.6
          ? "low correlation"
          : "moderate correlation";

    return `Based on ${frontierData.days}-day historical data, the optimal Sharpe allocation is ${optBtc}% BTC / ${optRebeta}% Rebeta. ` +
      `Rebeta's ${corrDesc} with BTC (${rebetaBtcCorr >= 0 ? "+" : ""}${rebetaBtcCorr.toFixed(2)}) means blending the two assets ` +
      `reduces portfolio volatility without proportionally reducing returns, improving the risk-adjusted outcome.`;
  }

  return (
    <div>
      <Header title="Correlation" />
      <div className="p-6 space-y-10">

        {/* ── A. Correlation Matrix ── */}
        <section>
          <div className="flex items-center justify-between">
            <SectionLabel>Correlation Matrix</SectionLabel>
            {/* Period tabs */}
            <div className="flex gap-1 border border-border-subtle rounded-sm overflow-hidden">
              {PERIOD_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPeriod(t.key)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] uppercase tracking-[1px] transition-colors",
                    period === t.key
                      ? "bg-bg-elevated text-bronze"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
            {matrixLoading ? (
              <div className="flex items-center justify-center h-40 text-text-muted text-sm">
                Calculating correlations...
              </div>
            ) : matrixError ? (
              <div className="flex items-center justify-center h-40 text-pnl-negative text-sm">
                {matrixError}
              </div>
            ) : matrix ? (
              <div className="overflow-x-auto">
                {/* Row labels column + matrix grid */}
                <div style={{ minWidth: `${80 + assets.length * 72}px` }}>
                  {/* Header row */}
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `80px repeat(${assets.length}, 1fr)` }}
                  >
                    <div />
                    {assets.map((a) => (
                      <div
                        key={a}
                        className="flex items-center justify-center pb-2 text-[10px] uppercase tracking-[1px] text-text-secondary"
                      >
                        {a}
                      </div>
                    ))}
                  </div>
                  {/* Matrix rows */}
                  {assets.map((rowAsset, i) => (
                    <div
                      key={rowAsset}
                      className="grid gap-1 mb-1"
                      style={{ gridTemplateColumns: `80px repeat(${assets.length}, 1fr)` }}
                    >
                      <div className="flex items-center text-[10px] uppercase tracking-[1px] text-text-secondary pr-1">
                        {rowAsset}
                      </div>
                      {assets.map((_, j) => (
                        <CorrelationCell
                          key={j}
                          value={matrix[i][j]}
                          isDiagonal={i === j}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-text-muted flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-blue-500/60" />
                    Strong neg (&lt;-0.7)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-blue-500/30" />
                    Mod neg
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-bg-elevated border border-border-subtle" />
                    Near zero
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-pnl-negative/30" />
                    Mod pos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-pnl-negative/60" />
                    Strong pos (&gt;0.7)
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── B. Rolling Correlation Chart ── */}
        <section>
          <SectionLabel>Rolling Correlation (90-Day Window)</SectionLabel>
          <p className="mt-1 text-xs text-text-muted">
            Rebeta correlation with major asset classes over time
          </p>
          <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
            {matrixLoading ? (
              <div className="flex items-center justify-center h-48 text-text-muted text-sm">
                Loading chart data...
              </div>
            ) : matrixData?.rollingCorrelation && matrixData.rollingCorrelation.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={matrixData.rollingCorrelation}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1C1C1C" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#888888", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#333333" }}
                    tickFormatter={(v: string) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[-1, 1]}
                    tick={{ fill: "#888888", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#333333" }}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-sm border border-border-subtle bg-bg-card px-3 py-2 text-xs shadow-lg">
                          <p className="mb-1 font-[family-name:var(--font-mono)] text-text-muted">{label}</p>
                          {payload.map((p) => (
                            <p key={p.name} style={{ color: p.color as string }}>
                              Rebeta / {p.name}:{" "}
                              <span className="font-[family-name:var(--font-mono)]">
                                {(p.value as number) >= 0 ? "+" : ""}
                                {(p.value as number).toFixed(3)}
                              </span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: "#888888", paddingTop: 8 }}
                    formatter={(value: string) => `Rebeta / ${value}`}
                  />
                  <ReferenceLine y={0} stroke="#444444" strokeDasharray="4 4" />
                  {(matrixData.rollingKeys ?? []).map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={ROLLING_COLORS[key] ?? "#666"}
                      strokeWidth={key === "BTC" ? 2 : 1.2}
                      dot={false}
                      name={key}
                      strokeOpacity={key === "BTC" || key === "ETH" ? 1 : 0.8}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-muted text-sm">
                Insufficient data for rolling correlation. Increase the period or add more snapshots.
              </div>
            )}
          </div>
        </section>

        {/* ── C. Asset Class Comparison ── */}
        <section>
          <SectionLabel>Asset Class Comparison</SectionLabel>
          <p className="mt-1 text-xs text-text-muted">
            Rebeta vs. major traditional and crypto asset classes
          </p>

          {benchmarkLoading ? (
            <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
              <div className="flex items-center justify-center h-40 text-text-muted text-sm">
                Loading benchmark data...
              </div>
            </div>
          ) : benchmarkData ? (
            <div className="mt-3 space-y-6">
              {/* Metrics Table */}
              <div className="overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-bg-elevated">
                        <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                          Asset
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                          CAGR
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                          Volatility
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                          Sharpe
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                          Max DD
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                          Corr w/ Rebeta
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Rebeta row - highlighted */}
                      <tr className="border-b border-border-subtle bg-bg-elevated/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full bg-gold" />
                            <span className="text-gold font-medium">{benchmarkData.rebeta.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-gold">
                          {formatPct(benchmarkData.rebeta.cagr)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-text-primary">
                          {formatPct(benchmarkData.rebeta.volatility)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-text-primary">
                          {benchmarkData.rebeta.sharpe.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-pnl-negative">
                          {formatPct(benchmarkData.rebeta.maxDrawdown)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-bronze">
                          1.00
                        </td>
                      </tr>
                      {/* Benchmark rows */}
                      {benchmarkData.benchmarks.map((bm) => {
                        const corrColor =
                          Math.abs(bm.correlationWithRebeta) < 0.3
                            ? "text-pnl-positive"
                            : Math.abs(bm.correlationWithRebeta) < 0.6
                              ? "text-text-secondary"
                              : "text-pnl-negative";
                        return (
                          <tr
                            key={bm.symbol}
                            className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated"
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ backgroundColor: BENCHMARK_COLORS[bm.symbol] ?? "#666" }}
                                />
                                <span className="text-text-primary">{bm.name}</span>
                                <span className="text-[10px] text-text-muted">({bm.symbol})</span>
                              </div>
                            </td>
                            <td className={cn(
                              "px-4 py-2.5 text-right font-[family-name:var(--font-mono)]",
                              bm.cagr >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                            )}>
                              {formatPct(bm.cagr)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-text-secondary">
                              {formatPct(bm.volatility)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-text-secondary">
                              {bm.sharpe.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] text-pnl-negative">
                              {formatPct(bm.maxDrawdown)}
                            </td>
                            <td className={cn(
                              "px-4 py-2.5 text-right font-[family-name:var(--font-mono)]",
                              corrColor
                            )}>
                              {bm.correlationWithRebeta >= 0 ? "+" : ""}
                              {bm.correlationWithRebeta.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cumulative Returns Chart */}
              <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
                <p className="text-[11px] uppercase tracking-[1px] text-text-muted mb-3">
                  Cumulative Returns (Rebeta operational period)
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C1C1C" />
                    <XAxis
                      dataKey="date"
                      type="category"
                      allowDuplicatedCategory={false}
                      tick={{ fill: "#888888", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                      tickLine={false}
                      axisLine={{ stroke: "#333333" }}
                      tickFormatter={(v: string) => v.slice(2, 7)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#888888", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                      tickLine={false}
                      axisLine={{ stroke: "#333333" }}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-sm border border-border-subtle bg-bg-card px-3 py-2 text-xs shadow-lg">
                            <p className="mb-1 font-[family-name:var(--font-mono)] text-text-muted">{label}</p>
                            {payload.map((p) => (
                              <p key={p.name} style={{ color: p.color as string }}>
                                {p.name}:{" "}
                                <span className="font-[family-name:var(--font-mono)]">
                                  {((p.value as number) * 100).toFixed(2)}%
                                </span>
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="#444444" strokeDasharray="4 4" />
                    {/* Rebeta curve - prominent */}
                    {benchmarkData.cumulativeCurves["Rebeta"] && (
                      <Line
                        data={benchmarkData.cumulativeCurves["Rebeta"]}
                        type="monotone"
                        dataKey="value"
                        stroke="#C5A049"
                        strokeWidth={2.5}
                        dot={false}
                        name="Rebeta"
                      />
                    )}
                    {/* BTC */}
                    {benchmarkData.cumulativeCurves["BTC"] && (
                      <Line
                        data={benchmarkData.cumulativeCurves["BTC"]}
                        type="monotone"
                        dataKey="value"
                        stroke="#F7931A"
                        strokeWidth={1.5}
                        dot={false}
                        name="BTC"
                        strokeDasharray="4 2"
                      />
                    )}
                    {/* Traditional benchmarks */}
                    {Object.entries(benchmarkData.cumulativeCurves)
                      .filter(([key]) => key !== "Rebeta" && key !== "BTC")
                      .map(([symbol, curve]) => (
                        <Line
                          key={symbol}
                          data={curve}
                          type="monotone"
                          dataKey="value"
                          stroke={BENCHMARK_COLORS[symbol] ?? "#666"}
                          strokeWidth={1}
                          dot={false}
                          name={symbol}
                          strokeOpacity={0.7}
                        />
                      ))}
                    <Legend
                      wrapperStyle={{ fontSize: 10, color: "#888888", paddingTop: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <p className="mt-2 text-center text-[10px] text-text-muted">
                  Data range: {benchmarkData.dataRange.start} to {benchmarkData.dataRange.end} ({benchmarkData.dataRange.days} trading days)
                </p>
              </div>

              {/* Low Correlation Insight */}
              {(() => {
                const lowCorrAssets = benchmarkData.benchmarks.filter(
                  (b) => Math.abs(b.correlationWithRebeta) < 0.3
                );
                if (lowCorrAssets.length === 0) return null;
                return (
                  <div className="rounded-sm border-l-2 border-gold bg-bg-elevated px-5 py-4">
                    <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">
                      Diversification Advantage
                    </span>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                      Rebeta shows near-zero correlation with{" "}
                      {lowCorrAssets.map((a) => a.name).join(", ")}
                      , indicating strong diversification potential when added to a traditional portfolio.
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </section>

        {/* ── D. Key Insights Panel ── */}
        <section>
          <SectionLabel>Key Insights</SectionLabel>
          <div className="mt-3 space-y-3">
            {/* Optimal allocation insight */}
            {!frontierLoading && frontierData && (
              <div className="rounded-sm border-l-2 border-gold bg-bg-elevated px-5 py-4">
                <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">
                  Optimal Allocation
                </span>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {buildInsightText()}
                </p>
              </div>
            )}

            {/* Frontier summary cards */}
            {!frontierLoading && frontierData && frontierData.frontier.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  frontierData.frontier.find((p) => p.btcWeight === 0) ?? frontierData.frontier[0],
                  frontierData.frontier.find((p) => p.btcWeight === frontierData.optimal.btcWeight) ?? frontierData.frontier[Math.floor(frontierData.frontier.length / 2)],
                  frontierData.frontier.find((p) => p.btcWeight === 100) ?? frontierData.frontier[frontierData.frontier.length - 1],
                ].map((pt, idx) => {
                  const labels = ["Pure Rebeta", `${pt.rebetaWeight}/${pt.btcWeight} Mix`, "Pure BTC"];
                  const colors = ["text-gold", "text-bronze", "text-text-muted"];
                  return (
                    <div
                      key={idx}
                      className="rounded-sm border border-border-subtle bg-bg-card p-4"
                    >
                      <div className={cn("text-[10px] uppercase tracking-[1px] mb-2", colors[idx])}>
                        {labels[idx]}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">Sharpe</span>
                          <span className="font-[family-name:var(--font-mono)] text-text-primary">
                            {pt.sharpe.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">CAGR</span>
                          <span className="font-[family-name:var(--font-mono)] text-text-primary">
                            {formatPct(pt.expectedReturn)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">Volatility</span>
                          <span className="font-[family-name:var(--font-mono)] text-text-primary">
                            {formatPct(pt.volatility)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Static structural insight */}
            <div className="rounded-sm border-l-2 border-bronze bg-bg-elevated px-5 py-4">
              <span className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
                Structural Independence
              </span>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Rebeta&apos;s mean-reversion strategy generates returns orthogonal to directional BTC
                exposure. Its low beta and near-zero market correlation make it a natural
                complement in a crypto portfolio, reducing drawdown duration without sacrificing upside.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
