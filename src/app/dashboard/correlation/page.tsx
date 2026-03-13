"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
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
  rollingCorrelation: { time: string; rebetaBtc: number; rebetaEth: number }[];
}

interface SimulateData {
  equityCurve: { time: string; btcOnly: number; mixed: number; rebetaOnly: number }[];
  metrics: {
    btcOnly: PortfolioMetrics | null;
    mixed: PortfolioMetrics | null;
    rebetaOnly: PortfolioMetrics | null;
  };
  weights: { btc: number; rebeta: number };
  days: number;
}

interface PortfolioMetrics {
  cumulativeReturn: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  volatility: number;
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
      <div className="flex h-16 w-full items-center justify-center rounded-sm bg-bg-elevated border border-border-subtle">
        <span className="font-[family-name:var(--font-mono)] text-sm text-bronze">
          1.00
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-16 w-full flex-col items-center justify-center rounded-sm border border-border-subtle transition-colors",
        getCorrelationColor(value)
      )}
    >
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-sm",
          getCorrelationTextColor(value)
        )}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-[1px] text-text-muted">
        {Math.abs(value) >= 0.7
          ? "strong"
          : Math.abs(value) >= 0.3
            ? "moderate"
            : "weak"}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Custom Tooltip for Recharts
   ═══════════════════════════════════════════════════════════════ */

function RollingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-[family-name:var(--font-mono)] text-text-muted">
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-[family-name:var(--font-mono)]">
            {p.value >= 0 ? "+" : ""}
            {p.value.toFixed(3)}
          </span>
        </p>
      ))}
    </div>
  );
}

function EquityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-[family-name:var(--font-mono)] text-text-muted">
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-[family-name:var(--font-mono)]">
            {((p.value - 1) * 100).toFixed(2)}%
          </span>
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Metrics Table Row
   ═══════════════════════════════════════════════════════════════ */

function MetricsComparisonTable({
  metrics,
  btcWeight,
  rebetaWeight,
}: {
  metrics: SimulateData["metrics"];
  btcWeight: number;
  rebetaWeight: number;
}) {
  const rows: { label: string; key: keyof PortfolioMetrics; format: (v: number) => string; isPositiveBetter: boolean }[] = [
    {
      label: "Cumulative Return",
      key: "cumulativeReturn",
      format: (v) => formatPct(v),
      isPositiveBetter: true,
    },
    {
      label: "CAGR",
      key: "cagr",
      format: (v) => formatPct(v),
      isPositiveBetter: true,
    },
    {
      label: "Sharpe Ratio",
      key: "sharpe",
      format: (v) => v.toFixed(3),
      isPositiveBetter: true,
    },
    {
      label: "Sortino Ratio",
      key: "sortino",
      format: (v) => v.toFixed(3),
      isPositiveBetter: true,
    },
    {
      label: "Max Drawdown",
      key: "maxDrawdown",
      format: (v) => formatPct(v),
      isPositiveBetter: false,
    },
    {
      label: "Volatility",
      key: "volatility",
      format: (v) => formatPct(v),
      isPositiveBetter: false,
    },
  ];

  const cols = [
    { label: "Pure BTC", data: metrics.btcOnly, color: "text-text-muted" },
    { label: `${btcWeight}/${rebetaWeight} Mix`, data: metrics.mixed, color: "text-bronze" },
    { label: "Pure Rebeta", data: metrics.rebetaOnly, color: "text-gold" },
  ];

  return (
    <div className="overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-elevated">
            <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
              Metric
            </th>
            {cols.map((c) => (
              <th
                key={c.label}
                className={cn(
                  "px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] font-normal",
                  c.color
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = cols.map((c) =>
              c.data ? c.data[row.key] : null
            );

            return (
              <tr
                key={row.label}
                className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated"
              >
                <td className="px-4 py-2 text-text-secondary">{row.label}</td>
                {values.map((v, i) => {
                  if (v === null) {
                    return (
                      <td
                        key={i}
                        className="px-4 py-2 text-right font-[family-name:var(--font-mono)] text-text-muted"
                      >
                        —
                      </td>
                    );
                  }
                  const best = values.filter((x) => x !== null) as number[];
                  const isBest = row.isPositiveBetter
                    ? v === Math.max(...best)
                    : v === Math.min(...best);

                  const isNeg = v < 0;
                  const isPos = v > 0 && row.isPositiveBetter;

                  return (
                    <td
                      key={i}
                      className={cn(
                        "px-4 py-2 text-right font-[family-name:var(--font-mono)]",
                        isBest && "font-semibold",
                        isPos && isBest && "text-pnl-positive",
                        isNeg && isBest && "text-pnl-negative",
                        !isBest && "text-text-secondary"
                      )}
                    >
                      {row.format(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

type Period = "30" | "90" | "180";

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "180", label: "180D" },
];

const PRESETS: { label: string; btc: number; rebeta: number }[] = [
  { label: "80/20", btc: 80, rebeta: 20 },
  { label: "60/40", btc: 60, rebeta: 40 },
  { label: "50/50", btc: 50, rebeta: 50 },
  { label: "20/80", btc: 20, rebeta: 80 },
];

export default function CorrelationPage() {
  const [period, setPeriod] = useState<Period>("90");
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [btcWeight, setBtcWeight] = useState(60);
  const rebetaWeight = 100 - btcWeight;

  const [simData, setSimData] = useState<SimulateData | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const [frontierData, setFrontierData] = useState<FrontierData | null>(null);
  const [frontierLoading, setFrontierLoading] = useState(true);

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

  // Fetch efficient frontier once
  useEffect(() => {
    setFrontierLoading(true);
    fetch("/api/correlation/frontier?period=365")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setFrontierData(data);
      })
      .catch(() => {})
      .finally(() => setFrontierLoading(false));
  }, []);

  // Fetch simulation when weights change (debounced)
  const fetchSim = useCallback(
    (btc: number, rebeta: number) => {
      setSimLoading(true);
      setSimError(null);
      fetch(`/api/correlation/simulate?btcWeight=${btc}&rebetaWeight=${rebeta}&period=365`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setSimData(data);
        })
        .catch((e) => setSimError(e.message))
        .finally(() => setSimLoading(false));
    },
    []
  );

  // Initial sim fetch
  useEffect(() => {
    fetchSim(60, 40);
  }, [fetchSim]);

  // Debounce slider
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSim(btcWeight, rebetaWeight);
    }, 600);
    return () => clearTimeout(timer);
  }, [btcWeight, rebetaWeight, fetchSim]);

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
                <div className="min-w-[360px]">
                  {/* Header row */}
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `120px repeat(${assets.length}, 1fr)` }}
                  >
                    <div />
                    {assets.map((a) => (
                      <div
                        key={a}
                        className="flex items-center justify-center pb-2 text-[11px] uppercase tracking-[1px] text-text-secondary"
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
                      style={{ gridTemplateColumns: `120px repeat(${assets.length}, 1fr)` }}
                    >
                      <div className="flex items-center text-[11px] uppercase tracking-[1px] text-text-secondary pr-2">
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
          <SectionLabel>Rolling Correlation (21-Day Window)</SectionLabel>
          <p className="mt-1 text-xs text-text-muted">
            Rebeta correlation with BTC and ETH over time
          </p>
          <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
            {matrixLoading ? (
              <div className="flex items-center justify-center h-48 text-text-muted text-sm">
                Loading chart data...
              </div>
            ) : matrixData?.rollingCorrelation && matrixData.rollingCorrelation.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
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
                    tickFormatter={(v: string) => v.slice(5)} // MM-DD
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[-1, 1]}
                    tick={{ fill: "#888888", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#333333" }}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip content={<RollingTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: "#888888" }}
                    formatter={(value) =>
                      value === "rebetaBtc" ? "Rebeta / BTC" : "Rebeta / ETH"
                    }
                  />
                  <ReferenceLine y={0} stroke="#444444" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="rebetaBtc"
                    stroke="#C5A049"
                    strokeWidth={1.5}
                    dot={false}
                    name="rebetaBtc"
                  />
                  <Line
                    type="monotone"
                    dataKey="rebetaEth"
                    stroke="#555555"
                    strokeWidth={1.5}
                    dot={false}
                    name="rebetaEth"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-muted text-sm">
                Insufficient data for rolling correlation. Increase the period or add more snapshots.
              </div>
            )}
          </div>

          {/* Chart legend */}
          <div className="mt-2 flex items-center justify-center gap-6 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-gold" /> Rebeta / BTC
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-text-muted" /> Rebeta / ETH
            </span>
          </div>
        </section>

        {/* ── C. Portfolio Simulator ── */}
        <section>
          <SectionLabel>Portfolio Simulator</SectionLabel>
          <p className="mt-1 text-xs text-text-muted">
            Blend BTC and Rebeta to explore risk/return tradeoffs
          </p>

          <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5 space-y-5">
            {/* Weight Controls */}
            <div className="space-y-3">
              {/* Allocation display */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-text-secondary">
                  BTC:{" "}
                  <span className="font-[family-name:var(--font-mono)] text-text-muted">
                    {btcWeight}%
                  </span>
                </div>
                <div className="text-xs text-text-secondary">
                  Rebeta:{" "}
                  <span className="font-[family-name:var(--font-mono)] text-gold">
                    {rebetaWeight}%
                  </span>
                </div>
              </div>

              {/* Slider */}
              <div className="relative">
                {/* Visual fill track */}
                <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full bg-text-muted/50 rounded-full transition-all"
                    style={{ width: `${btcWeight}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={btcWeight}
                  onChange={(e) => setBtcWeight(parseInt(e.target.value, 10))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ accentColor: "#997B66" }}
                />
                {/* Visible thumb */}
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-bronze bg-bg-primary transition-all"
                  style={{ left: `calc(${btcWeight}% - 8px)` }}
                />
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setBtcWeight(p.btc)}
                    className={cn(
                      "px-3 py-1.5 text-[11px] uppercase tracking-[1px] rounded-sm border transition-colors",
                      btcWeight === p.btc
                        ? "border-bronze text-bronze bg-bg-elevated"
                        : "border-border-subtle text-text-muted hover:border-bronze/50 hover:text-text-secondary"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                {optimal && (
                  <button
                    onClick={() => setBtcWeight(optimal.btcWeight)}
                    className={cn(
                      "ml-auto px-3 py-1.5 text-[11px] uppercase tracking-[1px] rounded-sm border transition-colors",
                      btcWeight === optimal.btcWeight
                        ? "border-gold text-gold bg-bg-elevated"
                        : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold"
                    )}
                  >
                    Optimal ({optimal.btcWeight}/{optimal.rebetaWeight})
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Table */}
            {simLoading ? (
              <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                Simulating portfolio...
              </div>
            ) : simError ? (
              <div className="flex items-center justify-center h-32 text-pnl-negative text-sm">
                {simError}
              </div>
            ) : simData ? (
              <>
                <MetricsComparisonTable
                  metrics={simData.metrics}
                  btcWeight={btcWeight}
                  rebetaWeight={rebetaWeight}
                />

                {/* Equity Curve Chart */}
                {simData.equityCurve.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-[1px] text-text-muted mb-2">
                      Simulated Equity Curve (1-year, normalized to 1.0)
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart
                        data={simData.equityCurve}
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
                          tick={{ fill: "#888888", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                          tickLine={false}
                          axisLine={{ stroke: "#333333" }}
                          tickFormatter={(v: number) => `${((v - 1) * 100).toFixed(0)}%`}
                        />
                        <Tooltip content={<EquityTooltip />} />
                        <ReferenceLine y={1} stroke="#333333" strokeDasharray="4 4" />
                        <Line
                          type="monotone"
                          dataKey="btcOnly"
                          stroke="#555555"
                          strokeWidth={1.5}
                          dot={false}
                          name="Pure BTC"
                        />
                        <Line
                          type="monotone"
                          dataKey="mixed"
                          stroke="#997B66"
                          strokeWidth={2}
                          dot={false}
                          name={`${btcWeight}/${rebetaWeight} Mix`}
                        />
                        <Line
                          type="monotone"
                          dataKey="rebetaOnly"
                          stroke="#C5A049"
                          strokeWidth={1.5}
                          dot={false}
                          name="Pure Rebeta"
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="mt-2 flex items-center justify-center gap-6 text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 bg-text-muted" /> Pure BTC
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 bg-bronze" /> {btcWeight}/{rebetaWeight} Mix
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 bg-gold" /> Pure Rebeta
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
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
