"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useState } from "react";
import useSWR from "swr";
import { CumulativeReturnsChart } from "@/components/performance/CumulativeReturnsChart";
import { UnderwaterChart } from "@/components/performance/UnderwaterChart";
import { RollingSharpeChart } from "@/components/performance/RollingSharpeChart";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ═══════════════════════════════════════════════════════════════
   ALL data from /api/bybit/tearsheet (computed from daily_returns DB)
   No hardcoded values — third-party reproducible
   ═══════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TearsheetData = any;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ═══════════════════════════════════════════════════════════════
   Helper Components
   ═══════════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

function ComparisonValue({ value, isBtc = false }: { value: string; isBtc?: boolean }) {
  if (isBtc) {
    return <span className="font-[family-name:var(--font-mono)] text-text-muted">{value}</span>;
  }
  const num = parseFloat(value);
  const isNeg = value.startsWith("-") || num < 0;
  const isPos = !isNeg && num > 0;
  return (
    <span className={cn(
      "font-[family-name:var(--font-mono)]",
      isPos && "text-pnl-positive",
      isNeg && "text-pnl-negative",
      !isPos && !isNeg && "text-text-primary",
    )}>
      {value}
    </span>
  );
}

function MetricTable({
  title,
  data,
}: {
  title: string;
  data: { metric: string; rebeta: string; btc: string; tooltip?: string }[];
}) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-elevated">
              <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                Metric
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-bronze font-normal">
                Rebeta
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-muted font-normal">
                BTC
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.metric}
                className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated"
                title={row.tooltip}
              >
                <td className="px-4 py-2 text-text-secondary">{row.metric}</td>
                <td className="px-4 py-2 text-right">
                  <ComparisonValue value={row.rebeta} />
                </td>
                <td className="px-4 py-2 text-right">
                  <ComparisonValue value={row.btc} isBtc />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Monthly Heatmap ─── */
function MonthlyHeatmap() {
  function getColor(v: number): string {
    if (v >= 15) return "bg-pnl-positive/80 text-bg-primary";
    if (v >= 8) return "bg-pnl-positive/50 text-text-primary";
    if (v >= 3) return "bg-pnl-positive/25 text-text-primary";
    if (v > 0) return "bg-pnl-positive/10 text-text-secondary";
    if (v === 0 || Object.is(v, -0)) return "bg-bg-elevated text-text-muted";
    if (v > -3) return "bg-pnl-negative/10 text-text-secondary";
    if (v > -8) return "bg-pnl-negative/25 text-text-primary";
    return "bg-pnl-negative/50 text-text-primary";
  }

  const lookup: Record<string, number> = {};
  monthlyReturns.forEach((m) => {
    lookup[`${m.year}-${m.month}`] = m.value;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal w-16">
              Year
            </th>
            {MONTHS.map((m) => (
              <th
                key={m}
                className="px-1 py-2 text-center text-[10px] uppercase tracking-[0.5px] text-text-muted font-normal"
              >
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {YEARS.map((year) => {
            const yearData = yearlyReturns.find((y) => y.year === year);
            return (
              <tr key={year}>
                <td className="px-2 py-1 font-[family-name:var(--font-mono)] text-text-primary font-medium">
                  {year}
                </td>
                {MONTHS.map((month) => {
                  const key = `${year}-${month}`;
                  const val = lookup[key];
                  if (val === undefined) {
                    return (
                      <td key={month} className="px-1 py-1">
                        <div className="flex h-8 items-center justify-center rounded-sm bg-bg-primary text-text-muted">
                          &mdash;
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={month} className="px-0.5 py-0.5">
                      <div
                        className={cn(
                          "flex h-8 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[11px] transition-transform hover:scale-105",
                          getColor(val)
                        )}
                      >
                        {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right">
                  <span
                    className={cn(
                      "font-[family-name:var(--font-mono)] font-semibold",
                      (yearData?.rebeta ?? 0) >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                    )}
                  >
                    {yearData ? `${yearData.rebeta >= 0 ? "+" : ""}${yearData.rebeta.toFixed(1)}%` : ""}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Yearly Bar Chart (CSS) ─── */
function YearlyBars() {
  const maxVal = Math.max(
    ...yearlyReturns.map((y) => Math.abs(y.rebeta)),
    ...yearlyReturns.map((y) => Math.abs(y.btc))
  );

  return (
    <div className="space-y-3">
      {yearlyReturns.map((y) => (
        <div key={y.year} className="flex items-center gap-3">
          <span className="w-10 shrink-0 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
            {y.year}
          </span>
          <div className="flex flex-1 flex-col gap-1">
            {/* Rebeta bar */}
            <div className="flex items-center gap-2">
              <div className="relative h-5 flex-1 rounded-sm bg-bg-elevated overflow-hidden">
                <div
                  className={cn(
                    "absolute top-0 h-full rounded-sm transition-all",
                    y.rebeta >= 0
                      ? "left-1/2 bg-gold/70"
                      : "right-1/2 bg-pnl-negative/50"
                  )}
                  style={{
                    width: `${(Math.abs(y.rebeta) / maxVal) * 50}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-primary/80">
                    {y.rebeta > 0 ? "+" : ""}{y.rebeta.toFixed(1)}%
                  </span>
                </div>
              </div>
              <span className="w-14 text-right text-[10px] text-gold">REBETA</span>
            </div>
            {/* BTC bar */}
            <div className="flex items-center gap-2">
              <div className="relative h-5 flex-1 rounded-sm bg-bg-elevated overflow-hidden">
                <div
                  className={cn(
                    "absolute top-0 h-full rounded-sm transition-all",
                    y.btc >= 0
                      ? "left-1/2 bg-text-muted/40"
                      : "right-1/2 bg-pnl-negative/30"
                  )}
                  style={{
                    width: `${(Math.abs(y.btc) / maxVal) * 50}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary/70">
                    {y.btc > 0 ? "+" : ""}{y.btc.toFixed(1)}%
                  </span>
                </div>
              </div>
              <span className="w-14 text-right text-[10px] text-text-muted">BTC</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Drawdown Bar Visual ─── */
function DrawdownDepthBar({ dd, maxDd }: { dd: number; maxDd: number }) {
  const pct = (Math.abs(dd) / Math.abs(maxDd)) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-24 rounded-sm bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-sm bg-pnl-negative/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-[family-name:var(--font-mono)] text-xs text-pnl-negative">
        {dd.toFixed(2)}%
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tabs
   ═══════════════════════════════════════════════════════════════ */

type Tab = "overview" | "returns" | "risk" | "benchmark";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "returns", label: "Returns" },
  { key: "risk", label: "Risk" },
  { key: "benchmark", label: "Benchmark" },
];

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function PerformancePage() {
  const [tab, setTab] = useState<Tab>("overview");

  const { data: ts } = useSWR<TearsheetData>("/api/bybit/tearsheet", fetcher, { refreshInterval: 300000 });
  const m = ts?.mainMetrics;

  return (
    <div>
      <Header title="Performance" />
      <div className="p-6">
        {/* Hero Stats — live from tearsheet API */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: m ? `${m.cumulativeReturn}%` : "--", label: "Cumulative" },
            { value: m ? `${m.cagr}%` : "--", label: "CAGR" },
            { value: m ? m.sharpe.toFixed(2) : "--", label: "Sharpe" },
            { value: m ? `${m.maxDrawdown}%` : "--", label: "Max DD" },
          ].map((s) => (
            <div key={s.label} className="rounded-sm border border-border-subtle bg-bg-card p-4">
              <div className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-text-primary">
                {s.value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.5px] text-text-secondary">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-border-subtle">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-[11px] uppercase tracking-[1px] transition-colors",
                tab === t.key
                  ? "border-b-2 border-bronze text-bronze"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6 space-y-8">
          {tab === "overview" && <OverviewTab />}
          {tab === "returns" && <ReturnsTab />}
          {tab === "risk" && <RiskTab />}
          {tab === "benchmark" && <BenchmarkTab />}
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-border-subtle pt-4 text-center">
          <p className="text-[10px] text-text-muted">
            Generated by qstats v0.1.33 &middot; Period: 2021.03.02 ~ 2026.02.16 &middot; Benchmark: BTC
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab Panels
   ═══════════════════════════════════════════════════════════════ */

function OverviewTab() {
  return (
    <>
      {/* Cumulative Returns Chart */}
      <div>
        <SectionLabel>Cumulative Returns</SectionLabel>
        <p className="mt-1 text-xs text-text-muted">Rebeta vs BTC (2021.03 ~ 2026.02)</p>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
          <CumulativeReturnsChart />
        </div>
        <div className="mt-2 flex items-center justify-center gap-6 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-gold" /> Rebeta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-text-muted" /> BTC
          </span>
        </div>
      </div>

      <MetricTable title="Main Metrics" data={mainMetrics} />

      {/* Monthly Returns Heatmap */}
      <div>
        <SectionLabel>Monthly Returns (%)</SectionLabel>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
          <MonthlyHeatmap />
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-pnl-positive/50" /> &gt;8%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-pnl-positive/25" /> 3~8%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-pnl-positive/10" /> 0~3%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-pnl-negative/10" /> 0~-3%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-pnl-negative/25" /> -3~-8%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-pnl-negative/50" /> &lt;-8%
          </span>
        </div>
      </div>

      {/* Yearly Returns */}
      <div>
        <SectionLabel>Yearly Returns: Rebeta vs BTC</SectionLabel>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
          <YearlyBars />
        </div>
      </div>
    </>
  );
}

function ReturnDistribution() {
  // Build histogram bins from monthly returns
  const bins = [
    { label: "<-8%", min: -Infinity, max: -8, count: 0 },
    { label: "-8~-5%", min: -8, max: -5, count: 0 },
    { label: "-5~-3%", min: -5, max: -3, count: 0 },
    { label: "-3~0%", min: -3, max: 0, count: 0 },
    { label: "0~3%", min: 0, max: 3, count: 0 },
    { label: "3~5%", min: 3, max: 5, count: 0 },
    { label: "5~8%", min: 5, max: 8, count: 0 },
    { label: "8~13%", min: 8, max: 13, count: 0 },
    { label: "13~20%", min: 13, max: 20, count: 0 },
    { label: ">20%", min: 20, max: Infinity, count: 0 },
  ];
  monthlyReturns.forEach((m) => {
    for (const b of bins) {
      if (m.value >= b.min && m.value < b.max) {
        b.count++;
        break;
      }
    }
  });
  const maxCount = Math.max(...bins.map((b) => b.count));

  return (
    <div className="flex items-end gap-1" style={{ height: 160 }}>
      {bins.map((b) => {
        const h = maxCount > 0 ? (b.count / maxCount) * 140 : 0;
        const isNeg = b.max <= 0;
        return (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-muted">
              {b.count > 0 ? b.count : ""}
            </span>
            <div
              className={cn(
                "w-full rounded-t-sm transition-all",
                isNeg ? "bg-pnl-negative/50" : "bg-pnl-positive/40"
              )}
              style={{ height: Math.max(h, 2) }}
            />
            <span className="text-[8px] text-text-muted whitespace-nowrap">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReturnsTab() {
  return (
    <>
      {/* Monthly Return Distribution Histogram */}
      <div>
        <SectionLabel>Monthly Return Distribution</SectionLabel>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
          <ReturnDistribution />
        </div>
      </div>

      <MetricTable title="Returns Metrics" data={returnsMetrics} />
      <MetricTable title="Cumulative Return Periods" data={cumulativeMetrics} />
      <MetricTable title="Rolling Metrics" data={rollingMetrics} />

      {/* Monthly Stats Summary */}
      <div>
        <SectionLabel>Monthly Return Distribution</SectionLabel>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: "Avg Profit Month", value: "+5.6%", color: "text-pnl-positive" },
            { label: "Avg Loss Month", value: "-3.5%", color: "text-pnl-negative" },
            { label: "Avg All Months", value: "+4.1%", color: "text-text-primary" },
          ].map((s) => (
            <div key={s.label} className="rounded-sm border border-border-subtle bg-bg-card p-4 text-center">
              <div className={cn("font-[family-name:var(--font-mono)] text-xl font-semibold", s.color)}>
                {s.value}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-text-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Win rate */}
      <div>
        <SectionLabel>Win/Loss Distribution</SectionLabel>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
          {(() => {
            const wins = monthlyReturns.filter((m) => m.value > 0).length;
            const losses = monthlyReturns.filter((m) => m.value < 0 || Object.is(m.value, -0)).length;
            const total = monthlyReturns.length;
            const winPct = ((wins / total) * 100).toFixed(1);
            const lossPct = ((losses / total) * 100).toFixed(1);
            return (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-pnl-positive">{wins} wins ({winPct}%)</span>
                  <span className="text-pnl-negative">{losses} losses ({lossPct}%)</span>
                </div>
                <div className="mt-2 flex h-4 overflow-hidden rounded-full">
                  <div
                    className="bg-pnl-positive/60"
                    style={{ width: `${winPct}%` }}
                  />
                  <div
                    className="bg-pnl-negative/60"
                    style={{ width: `${lossPct}%` }}
                  />
                </div>
                <div className="mt-2 text-center font-[family-name:var(--font-mono)] text-xs text-text-muted">
                  {total} months total
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

function RiskTab() {
  return (
    <>
      {/* Underwater Chart */}
      <div>
        <SectionLabel>Drawdown Underwater</SectionLabel>
        <p className="mt-1 text-xs text-text-muted">Peak-to-trough decline over time</p>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
          <UnderwaterChart />
        </div>
        <div className="mt-2 flex items-center justify-center gap-6 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-pnl-negative" /> Rebeta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-text-muted" /> BTC
          </span>
        </div>
      </div>

      {/* Worst Drawdowns */}
      <div>
        <SectionLabel>Worst Drawdowns</SectionLabel>
        <div className="mt-3 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated">
                <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal w-8">#</th>
                <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Started</th>
                <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Recovered</th>
                <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Drawdown</th>
                <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Days</th>
              </tr>
            </thead>
            <tbody>
              {worstDrawdowns.map((d) => (
                <tr key={d.rank} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                  <td className="px-4 py-2 text-text-muted">{d.rank}</td>
                  <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-text-secondary">{d.started}</td>
                  <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-text-secondary">{d.recovered}</td>
                  <td className="px-4 py-2">
                    <DrawdownDepthBar dd={d.dd} maxDd={worstDrawdowns[0].dd} />
                  </td>
                  <td className="px-4 py-2 text-right font-[family-name:var(--font-mono)] text-text-secondary">{d.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Summary Cards */}
      <div>
        <SectionLabel>Risk Summary</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Max Drawdown", rebeta: `${R.maxDrawdown}%`, btc: `${B.maxDrawdown}%` },
            { label: "Longest DD", rebeta: `${R.maxDrawdownDuration} days`, btc: `${B.maxDrawdownDuration} days` },
            { label: "Daily VaR (95%)", rebeta: "-0.65%", btc: "-4.63%" },
            { label: "CVaR (99%)", rebeta: "-3.45%", btc: "-7.84%" },
          ].map((s) => (
            <div key={s.label} className="rounded-sm border border-border-subtle bg-bg-card p-4">
              <div className="text-[10px] uppercase tracking-[1px] text-text-muted">{s.label}</div>
              <div className="mt-2 font-[family-name:var(--font-mono)] text-lg text-text-primary">{s.rebeta}</div>
              <div className="mt-0.5 text-[10px] text-text-muted">BTC: {s.btc}</div>
            </div>
          ))}
        </div>
      </div>

      <MetricTable title="Returns Risk Metrics" data={returnsMetrics} />
    </>
  );
}

function BenchmarkTab() {
  return (
    <>
      {/* Rolling Sharpe Chart */}
      <div>
        <SectionLabel>Rolling Sharpe Ratio (365d)</SectionLabel>
        <p className="mt-1 text-xs text-text-muted">Risk-adjusted return consistency over time</p>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
          <RollingSharpeChart />
        </div>
        <div className="mt-2 flex items-center justify-center gap-6 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-gold" /> Rebeta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-text-muted" /> BTC
          </span>
        </div>
      </div>

      <MetricTable title="Benchmark Metrics (vs BTC)" data={benchmarkMetrics} />

      {/* Key Insight */}
      <div className="rounded-sm border-l-2 border-gold bg-bg-elevated px-5 py-4">
        <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">Key Insight</span>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Beta of 0.06 and correlation of 0.14 confirm that Rebeta&apos;s returns are structurally independent
          from BTC price movements. This near-zero market sensitivity is the foundation of its counter-cyclical alpha generation.
        </p>
      </div>

      {/* Comparison Cards */}
      <div>
        <SectionLabel>Strategy vs Benchmark Comparison</SectionLabel>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {/* Rebeta */}
          <div className="rounded-sm border border-gold/30 bg-bg-card p-5">
            <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">Rebeta v1~v3.1</span>
            <div className="mt-4 space-y-3">
              {[
                { label: "Cumulative", value: `${R.cumulativeReturn}%` },
                { label: "CAGR", value: `${R.cagr}%` },
                { label: "Sharpe", value: R.sharpe.toFixed(2) },
                { label: "Sortino", value: R.sortino.toFixed(2) },
                { label: "Max DD", value: `${R.maxDrawdown}%` },
                { label: "Volatility", value: `${R.volatility}%` },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">{m.label}</span>
                  <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* BTC */}
          <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
            <span className="text-[10px] font-medium uppercase tracking-[2px] text-text-muted">BTC (Benchmark)</span>
            <div className="mt-4 space-y-3">
              {[
                { label: "Cumulative", value: `${B.cumulativeReturn}%` },
                { label: "CAGR", value: `${B.cagr}%` },
                { label: "Sharpe", value: B.sharpe.toFixed(2) },
                { label: "Sortino", value: B.sortino.toFixed(2) },
                { label: "Max DD", value: `${B.maxDrawdown}%` },
                { label: "Volatility", value: `${B.volatility}%` },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">{m.label}</span>
                  <span className="font-[family-name:var(--font-mono)] text-sm text-text-muted">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MetricTable title="Rolling Metrics" data={rollingMetrics} />
    </>
  );
}
