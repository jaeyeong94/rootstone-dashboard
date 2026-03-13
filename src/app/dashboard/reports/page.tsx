"use client";

import { Header } from "@/components/layout/Header";
import { cn, formatPnlPercent, formatNumber, getPnlColor } from "@/lib/utils";
import { useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ReportSummary } from "@/app/api/reports/summary/route";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type Preset = "last-month" | "last-quarter" | "last-year" | "custom";

interface DateRange {
  start: string;
  end: string;
}

/* ═══════════════════════════════════════════════════════════════
   Date helpers
   ═══════════════════════════════════════════════════════════════ */

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  const end = toIsoDate(now);

  if (preset === "last-month") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return { start: toIsoDate(start), end };
  }
  if (preset === "last-quarter") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    return { start: toIsoDate(start), end };
  }
  if (preset === "last-year") {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    return { start: toIsoDate(start), end };
  }
  return { start: toIsoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), end };
}

/* ═══════════════════════════════════════════════════════════════
   Helper components
   ═══════════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}

function MetricCard({ label, value, sub, valueClass }: MetricCardProps) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div className="text-[10px] uppercase tracking-[1px] text-text-muted">{label}</div>
      <div
        className={cn(
          "mt-2 font-[family-name:var(--font-mono)] text-2xl font-semibold",
          valueClass ?? "text-text-primary"
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}

/* ── Equity Curve Chart ── */
interface EquityCurveProps {
  data: { time: string; value: number }[];
}

function EquityCurveChart({ data }: EquityCurveProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-text-muted">
        No equity data for period
      </div>
    );
  }

  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));
  const padding = Math.max(Math.abs(max - min) * 0.1, 0.5);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="time"
          tick={{ fill: "#555", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#222" }}
          minTickGap={60}
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fill: "#555", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: "#161616",
            border: "1px solid #222",
            borderRadius: 2,
            fontSize: 11,
            fontFamily: "JetBrains Mono, monospace",
            color: "#ccc",
          }}
          formatter={(value: unknown) => {
            const v = typeof value === "string" ? parseFloat(value) : Number(value);
            return [`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, "Return"];
          }}
          labelStyle={{ color: "#888", marginBottom: 2 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#C5A049"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: "#C5A049" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Trade highlights table ── */
interface TradeHighlight {
  symbol: string;
  closedPnlPct: number;
  side: string;
  time: string;
}

function TradeTable({
  title,
  trades,
  emptyLabel,
}: {
  title: string;
  trades: TradeHighlight[];
  emptyLabel: string;
}) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
        {trades.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-xs text-text-muted">
            {emptyLabel}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated">
                <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                  Symbol
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                  Side
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                  PnL (% equity)
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr
                  key={i}
                  className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated"
                >
                  <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-text-primary">
                    {t.symbol}
                  </td>
                  <td className="px-4 py-2 text-[11px] uppercase tracking-[0.5px] text-text-muted">
                    {t.side}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right font-[family-name:var(--font-mono)]",
                      getPnlColor(t.closedPnlPct)
                    )}
                  >
                    {t.closedPnlPct >= 0 ? "+" : ""}
                    {formatNumber(t.closedPnlPct, 3)}%
                  </td>
                  <td className="px-4 py-2 text-right font-[family-name:var(--font-mono)] text-xs text-text-muted">
                    {t.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Monthly Returns heatmap (live data)
   ═══════════════════════════════════════════════════════════════ */

function MonthlyReturnsHeatmap({
  data,
}: {
  data: { year: number; month: number; return: number }[];
}) {
  if (data.length === 0) return null;

  const years = [...new Set(data.map((d) => d.year))].sort();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function getColor(v: number): string {
    if (v >= 8) return "bg-pnl-positive/60 text-bg-primary";
    if (v >= 3) return "bg-pnl-positive/35 text-text-primary";
    if (v > 0) return "bg-pnl-positive/15 text-text-secondary";
    if (v === 0) return "bg-bg-elevated text-text-muted";
    if (v > -3) return "bg-pnl-negative/15 text-text-secondary";
    if (v > -8) return "bg-pnl-negative/35 text-text-primary";
    return "bg-pnl-negative/60 text-text-primary";
  }

  const lookup: Record<string, number> = {};
  for (const d of data) {
    lookup[`${d.year}-${d.month}`] = d.return;
  }

  const yearTotals: Record<number, number> = {};
  for (const y of years) {
    const yearData = data.filter((d) => d.year === y);
    if (yearData.length > 0) {
      yearTotals[y] = yearData.reduce((acc, d) => {
        return (1 + acc / 100) * (1 + d.return / 100) * 100 - 100;
      }, 0);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-14 px-2 py-2 text-left text-[10px] font-normal uppercase tracking-[1px] text-text-secondary">
              Year
            </th>
            {MONTHS.map((m) => (
              <th
                key={m}
                className="px-0.5 py-2 text-center text-[10px] font-normal uppercase tracking-[0.5px] text-text-muted"
              >
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-right text-[10px] font-normal uppercase tracking-[1px] text-text-secondary">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                {year}
              </td>
              {MONTHS.map((_, mi) => {
                const val = lookup[`${year}-${mi + 1}`];
                if (val === undefined) {
                  return (
                    <td key={mi} className="px-0.5 py-0.5">
                      <div className="flex h-7 items-center justify-center rounded-sm bg-bg-primary text-text-muted">
                        &mdash;
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={mi} className="px-0.5 py-0.5">
                    <div
                      className={cn(
                        "flex h-7 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[10px]",
                        getColor(val)
                      )}
                    >
                      {val >= 0 ? "+" : ""}
                      {val.toFixed(1)}
                    </div>
                  </td>
                );
              })}
              <td className="px-2 py-0.5 text-right">
                {yearTotals[year] !== undefined ? (
                  <span
                    className={cn(
                      "font-[family-name:var(--font-mono)] text-[11px] font-medium",
                      yearTotals[year] >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                    )}
                  >
                    {yearTotals[year] >= 0 ? "+" : ""}
                    {yearTotals[year].toFixed(1)}%
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Report content
   ═══════════════════════════════════════════════════════════════ */

interface ReportContentProps {
  data: ReportSummary;
  period: DateRange;
}

function ReportContent({ data, period }: ReportContentProps) {
  const alphaLabel =
    data.sharpeRatio > 0 ? `Sharpe ${data.sharpeRatio.toFixed(2)}` : "N/A";

  return (
    <div id="report-content" className="space-y-8 print:space-y-6">
      {/* Print header */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b border-black pb-4">
          <span className="font-[family-name:var(--font-heading)] text-2xl font-light tracking-[2px] text-black">
            ROOTSTONE
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-[1px]">
            Strategy Performance Report
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Period: {period.start} — {period.end}
        </p>
      </div>

      {/* A. Executive Summary */}
      <div>
        <SectionLabel>Executive Summary</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-3 print:gap-2">
          <MetricCard
            label="Total Return"
            value={formatPnlPercent(data.totalReturn / 100)}
            valueClass={getPnlColor(data.totalReturn)}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={formatNumber(data.sharpeRatio, 2)}
            valueClass={data.sharpeRatio >= 1 ? "text-pnl-positive" : "text-text-primary"}
          />
          <MetricCard
            label="Max Drawdown"
            value={`${data.maxDrawdown.toFixed(2)}%`}
            valueClass={data.maxDrawdown < 0 ? "text-pnl-negative" : "text-pnl-positive"}
          />
          <MetricCard
            label="Total Trades"
            value={String(data.totalTrades)}
          />
          <MetricCard
            label="Win Rate"
            value={`${data.winRate.toFixed(1)}%`}
            valueClass={data.winRate >= 50 ? "text-pnl-positive" : "text-pnl-negative"}
          />
          <MetricCard
            label="Alpha"
            value={alphaLabel}
            sub="Annualized vs benchmark"
          />
        </div>
      </div>

      {/* B. Equity Curve */}
      <div>
        <SectionLabel>Equity Curve</SectionLabel>
        <p className="mt-1 text-xs text-text-muted print:text-gray-500">
          Cumulative return from period start (normalized to %)
        </p>
        <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4 print:border-gray-300 print:bg-white">
          <EquityCurveChart data={data.equityCurve} />
          <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted print:text-gray-500">
            <span className="inline-block h-0.5 w-4 bg-gold" />
            <span>Rebeta Strategy</span>
          </div>
        </div>
      </div>

      {/* Monthly Returns Heatmap */}
      {data.monthlyReturns.length > 0 && (
        <div>
          <SectionLabel>Monthly Returns (%)</SectionLabel>
          <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4 print:border-gray-300 print:bg-white">
            <MonthlyReturnsHeatmap data={data.monthlyReturns} />
          </div>
        </div>
      )}

      {/* C. Trade Highlights */}
      <div className="space-y-4">
        <SectionLabel>Trade Highlights</SectionLabel>
        <div className="mt-1 grid gap-4 lg:grid-cols-2 print:grid-cols-2">
          <TradeTable
            title="Top 5 Wins"
            trades={data.topWins}
            emptyLabel="No winning trades in period"
          />
          <TradeTable
            title="Top 5 Losses"
            trades={data.topLosses}
            emptyLabel="No losing trades in period"
          />
        </div>
      </div>

      {/* D. Risk Summary */}
      <div>
        <SectionLabel>Risk Summary</SectionLabel>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          <div className="rounded-sm border border-border-subtle bg-bg-card p-4 print:border-gray-300 print:bg-white">
            <div className="text-[10px] uppercase tracking-[1px] text-text-muted print:text-gray-500">
              Max Drawdown
            </div>
            <div
              className={cn(
                "mt-2 font-[family-name:var(--font-mono)] text-xl font-semibold",
                data.maxDrawdown < 0 ? "text-pnl-negative" : "text-pnl-positive"
              )}
            >
              {data.maxDrawdown.toFixed(2)}%
            </div>
            <div className="mt-0.5 text-[10px] text-text-muted print:text-gray-500">
              Peak-to-trough decline
            </div>
          </div>

          <div className="rounded-sm border border-border-subtle bg-bg-card p-4 print:border-gray-300 print:bg-white">
            <div className="text-[10px] uppercase tracking-[1px] text-text-muted print:text-gray-500">
              Avg Gross Exposure
            </div>
            <div className="mt-2 font-[family-name:var(--font-mono)] text-xl font-semibold text-text-primary">
              {data.avgGrossExposure > 0
                ? `${formatNumber(data.avgGrossExposure, 1)}%`
                : "N/A"}
            </div>
            <div className="mt-0.5 text-[10px] text-text-muted print:text-gray-500">
              Avg deployed capital
            </div>
          </div>

          <div className="rounded-sm border border-border-subtle bg-bg-card p-4 print:border-gray-300 print:bg-white">
            <div className="text-[10px] uppercase tracking-[1px] text-text-muted print:text-gray-500">
              1-Day VaR (95%)
            </div>
            <div
              className={cn(
                "mt-2 font-[family-name:var(--font-mono)] text-xl font-semibold",
                data.var95 < 0 ? "text-pnl-negative" : "text-text-primary"
              )}
            >
              {data.var95 !== 0 ? `${data.var95.toFixed(2)}%` : "N/A"}
            </div>
            <div className="mt-0.5 text-[10px] text-text-muted print:text-gray-500">
              Historical simulation
            </div>
          </div>
        </div>
      </div>

      {/* Print footer */}
      <div className="hidden print:block">
        <div className="mt-8 border-t border-black pt-4 text-center">
          <p className="text-[10px] uppercase tracking-[2px] text-gray-500">
            ROOTSTONE &mdash; Confidential
          </p>
          <p className="mt-0.5 text-[9px] text-gray-400">
            This report is for internal use only and may not be distributed without authorization.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("last-month");
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const r = getPresetRange("last-month");
    return r;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [generatedPeriod, setGeneratedPeriod] = useState<DateRange | null>(null);

  const effectiveRange: DateRange =
    preset === "custom" ? customRange : getPresetRange(preset);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const params = new URLSearchParams({
        start: effectiveRange.start,
        end: effectiveRange.end,
      });
      const res = await fetch(`/api/reports/summary?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: ReportSummary = await res.json();
      setReport(data);
      setGeneratedPeriod(effectiveRange);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [effectiveRange]);

  const handlePrint = () => {
    window.print();
  };

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "last-month", label: "Last Month" },
    { key: "last-quarter", label: "Last Quarter" },
    { key: "last-year", label: "Last Year" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          [data-sidebar], nav, header, #report-controls { display: none !important; }
          #report-content { max-width: 800px; margin: 0 auto; }
          .text-text-primary, .text-text-secondary, .text-text-muted { color: #333 !important; }
          .text-pnl-positive { color: #2a7a2a !important; }
          .text-pnl-negative { color: #c0392b !important; }
          .text-bronze { color: #7a5c3a !important; }
          .border-border-subtle { border-color: #ddd !important; }
          .bg-bg-card, .bg-bg-elevated { background: #fff !important; }
          .bg-bg-primary { background: #f5f5f5 !important; }
          .bg-pnl-positive\\/60, .bg-pnl-positive\\/35, .bg-pnl-positive\\/15 { background-color: rgba(60,180,60,0.25) !important; }
          .bg-pnl-negative\\/60, .bg-pnl-negative\\/35, .bg-pnl-negative\\/15 { background-color: rgba(200,60,60,0.25) !important; }
        }
      `}</style>

      <div className="print:hidden">
        <Header title="Reports" />
      </div>

      <div className="p-6">
        {/* Period selector */}
        <div id="report-controls" className="print:hidden">
          <SectionLabel>Report Period</SectionLabel>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {/* Preset buttons */}
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] uppercase tracking-[1px] transition-colors rounded-sm",
                    preset === p.key
                      ? "bg-bronze text-bg-primary"
                      : "border border-border-subtle text-text-muted hover:text-text-secondary hover:border-bronze/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            {preset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) =>
                    setCustomRange((r) => ({ ...r, start: e.target.value }))
                  }
                  className="rounded-sm border border-border-subtle bg-bg-card px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-xs text-text-primary focus:border-bronze focus:outline-none"
                />
                <span className="text-text-muted text-xs">to</span>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) =>
                    setCustomRange((r) => ({ ...r, end: e.target.value }))
                  }
                  className="rounded-sm border border-border-subtle bg-bg-card px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-xs text-text-primary focus:border-bronze focus:outline-none"
                />
              </div>
            )}

            {/* Active period display for presets */}
            {preset !== "custom" && (
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
                {effectiveRange.start} — {effectiveRange.end}
              </span>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={cn(
                "relative px-5 py-1.5 text-[11px] uppercase tracking-[2px] transition-colors rounded-sm",
                "border border-bronze text-bronze hover:bg-bronze hover:text-bg-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>

            {/* Print button */}
            {report && (
              <button
                onClick={handlePrint}
                className="px-4 py-1.5 text-[11px] uppercase tracking-[2px] border border-border-subtle text-text-muted hover:border-bronze/50 hover:text-text-secondary transition-colors rounded-sm"
              >
                Print / PDF
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-sm border border-pnl-negative/30 bg-pnl-negative/10 px-4 py-3 text-sm text-pnl-negative print:hidden">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-8 space-y-4 print:hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-sm border border-border-subtle bg-bg-card"
              />
            ))}
          </div>
        )}

        {/* Report content */}
        {report && generatedPeriod && !loading && (
          <div className="mt-8">
            <ReportContent data={report} period={generatedPeriod} />
          </div>
        )}

        {/* Empty state */}
        {!report && !loading && !error && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center print:hidden">
            <div className="text-[11px] uppercase tracking-[2px] text-text-muted">
              Select a period and generate a report
            </div>
            <p className="max-w-xs text-xs text-text-muted/60">
              The report will calculate returns, risk metrics, and trade highlights
              for the selected date range.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
