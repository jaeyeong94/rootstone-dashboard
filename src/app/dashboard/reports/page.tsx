"use client";

import { Header } from "@/components/layout/Header";
import { cn, formatPnlPercent } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface CurvePoint {
  time: string;
  value: number;
}

interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
}

interface TradeHighlight {
  symbol: string;
  side: "Buy" | "Sell";
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  holdingHours: number;
  closedAt: string;
}

interface ReportSummary {
  period: { start: string; end: string };
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
  btcReturn: number;
  alpha: number;
  equityCurve: CurvePoint[];
  btcCurve: CurvePoint[];
  monthlyReturns: MonthlyReturn[];
  topWins: TradeHighlight[];
  topLosses: TradeHighlight[];
  var95: number;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div
        className={cn(
          "font-[family-name:var(--font-mono)] text-2xl font-semibold",
          colorClass ?? "text-text-primary"
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[1px] text-text-secondary">
        {label}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthReturnColor(v: number): string {
  if (v >= 8) return "text-pnl-positive bg-pnl-positive/40";
  if (v >= 3) return "text-pnl-positive bg-pnl-positive/20";
  if (v > 0) return "text-pnl-positive/80 bg-pnl-positive/10";
  if (v === 0) return "text-text-muted bg-bg-elevated";
  if (v > -3) return "text-pnl-negative/80 bg-pnl-negative/10";
  if (v > -8) return "text-pnl-negative bg-pnl-negative/20";
  return "text-pnl-negative bg-pnl-negative/40";
}

/* ═══════════════════════════════════════════════════════════════
   Preset date helpers
   ═══════════════════════════════════════════════════════════════ */

function getPresetDates(preset: "month" | "quarter" | "year"): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: Date;

  if (preset === "month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (preset === "quarter") {
    start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  } else {
    start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }

  return { start: start.toISOString().split("T")[0], end };
}

/* ═══════════════════════════════════════════════════════════════
   Merged chart data
   ═══════════════════════════════════════════════════════════════ */

function mergeChartData(
  equityCurve: CurvePoint[],
  btcCurve: CurvePoint[]
): { time: string; rebeta: number | null; btc: number | null }[] {
  const btcMap = new Map(btcCurve.map((p) => [p.time, p.value]));
  return equityCurve.map((p) => ({
    time: p.time,
    rebeta: p.value,
    btc: btcMap.get(p.time) ?? null,
  }));
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const defaultDates = getPresetDates("month");
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [activePreset, setActivePreset] = useState<"month" | "quarter" | "year" | null>("month");
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/summary?start=${start}&end=${end}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch report");
      }
      const data: ReportSummary = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    fetchReport(startDate, endDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset: "month" | "quarter" | "year") {
    const dates = getPresetDates(preset);
    setStartDate(dates.start);
    setEndDate(dates.end);
    setActivePreset(preset);
  }

  function handleGenerate() {
    setActivePreset(null);
    fetchReport(startDate, endDate);
  }

  const chartData = report ? mergeChartData(report.equityCurve, report.btcCurve) : [];

  // Group monthly returns by year
  const monthlyByYear = report
    ? report.monthlyReturns.reduce<Record<number, Record<number, number>>>((acc, m) => {
        if (!acc[m.year]) acc[m.year] = {};
        acc[m.year][m.month] = m.return;
        return acc;
      }, {})
    : {};
  const years = Object.keys(monthlyByYear).map(Number).sort((a, b) => a - b);

  return (
    <div className="print:bg-white">
      <Header title="Reports" />
      <div className="p-6 print:p-4">

        {/* ── Period Selector ── */}
        <div className="rounded-sm border border-border-subtle bg-bg-card p-4 print:hidden">
          <SectionLabel>Report Period</SectionLabel>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {/* Preset buttons */}
            <div className="flex gap-2">
              {(["month", "quarter", "year"] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "relative px-3 py-1.5 text-[11px] uppercase tracking-[1px] transition-colors",
                    "before:absolute before:left-0 before:top-0 before:h-1.5 before:w-1.5 before:border-l before:border-t",
                    "after:absolute after:bottom-0 after:right-0 after:h-1.5 after:w-1.5 after:border-b after:border-r",
                    activePreset === preset
                      ? "text-bronze before:border-bronze after:border-bronze"
                      : "text-text-muted before:border-border-subtle after:border-border-subtle hover:text-text-secondary hover:before:border-text-secondary hover:after:border-text-secondary"
                  )}
                >
                  {preset === "month" ? "Last Month" : preset === "quarter" ? "Last Quarter" : "Last Year"}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }}
                className="rounded-sm border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs text-text-primary focus:border-bronze focus:outline-none font-[family-name:var(--font-mono)]"
              />
              <span className="text-text-muted text-xs">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }}
                className="rounded-sm border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs text-text-primary focus:border-bronze focus:outline-none font-[family-name:var(--font-mono)]"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={cn(
                "relative px-4 py-1.5 text-[11px] uppercase tracking-[1px] transition-colors",
                "before:absolute before:left-0 before:top-0 before:h-1.5 before:w-1.5 before:border-l before:border-t before:border-bronze",
                "after:absolute after:bottom-0 after:right-0 after:h-1.5 after:w-1.5 after:border-b after:border-r after:border-bronze",
                loading
                  ? "cursor-not-allowed text-text-muted"
                  : "text-bronze hover:bg-bronze/5"
              )}
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>

            {/* Print button */}
            {report && (
              <button
                onClick={() => window.print()}
                className={cn(
                  "relative ml-auto px-4 py-1.5 text-[11px] uppercase tracking-[1px] transition-colors",
                  "before:absolute before:left-0 before:top-0 before:h-1.5 before:w-1.5 before:border-l before:border-t before:border-border-subtle",
                  "after:absolute after:bottom-0 after:right-0 after:h-1.5 after:w-1.5 after:border-b after:border-r after:border-border-subtle",
                  "text-text-secondary hover:text-text-primary hover:before:border-text-secondary hover:after:border-text-secondary"
                )}
              >
                Print Report
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 rounded-sm border border-pnl-negative/30 bg-pnl-negative/5 px-4 py-3 text-sm text-pnl-negative">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !report && (
          <div className="mt-6 space-y-4">
            {[120, 80, 240].map((h) => (
              <div
                key={h}
                className="animate-pulse rounded-sm border border-border-subtle bg-bg-card"
                style={{ height: h }}
              />
            ))}
          </div>
        )}

        {/* Report content */}
        {report && (
          <div className="mt-6 space-y-8">

            {/* Print header (only visible on print) */}
            <div className="hidden print:block">
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
                Rootstone — Performance Report
              </h1>
              <p className="mt-1 text-xs text-text-secondary font-[family-name:var(--font-mono)]">
                {report.period.start} — {report.period.end}
              </p>
            </div>

            {/* ── A. Executive Summary ── */}
            <div>
              <SectionLabel>Executive Summary</SectionLabel>
              <p className="mt-1 text-xs text-text-muted font-[family-name:var(--font-mono)]">
                {report.period.start} — {report.period.end}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <MetricCard
                  label="Period Return"
                  value={`${report.totalReturn >= 0 ? "+" : ""}${report.totalReturn.toFixed(2)}%`}
                  colorClass={report.totalReturn >= 0 ? "text-pnl-positive" : "text-pnl-negative"}
                />
                <MetricCard
                  label="Sharpe Ratio"
                  value={report.sharpeRatio.toFixed(2)}
                  colorClass={report.sharpeRatio >= 1 ? "text-pnl-positive" : "text-text-primary"}
                />
                <MetricCard
                  label="Max Drawdown"
                  value={`${report.maxDrawdown.toFixed(2)}%`}
                  colorClass="text-pnl-negative"
                />
                <MetricCard
                  label="Total Trades"
                  value={String(report.totalTrades)}
                />
                <MetricCard
                  label="Win Rate"
                  value={`${report.winRate.toFixed(2)}%`}
                  colorClass={report.winRate >= 50 ? "text-pnl-positive" : "text-pnl-negative"}
                />
                <MetricCard
                  label="Alpha vs BTC"
                  value={`${report.alpha >= 0 ? "+" : ""}${report.alpha.toFixed(2)}%`}
                  sub={`BTC: ${report.btcReturn >= 0 ? "+" : ""}${report.btcReturn.toFixed(2)}%`}
                  colorClass={report.alpha >= 0 ? "text-pnl-positive" : "text-pnl-negative"}
                />
              </div>
            </div>

            {/* ── B. Equity Curve ── */}
            <div>
              <SectionLabel>Equity Curve</SectionLabel>
              <p className="mt-1 text-xs text-text-muted">Cumulative return (%) vs BTC benchmark</p>
              <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "#666" }}
                      tickFormatter={(v: string) => v.slice(5)}
                      tickLine={false}
                      axisLine={{ stroke: "#1a1a1a" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#666", fontFamily: "var(--font-mono)" }}
                      tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#141414",
                        border: "1px solid #222",
                        borderRadius: 2,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#888", fontSize: 10, marginBottom: 4 }}
                      formatter={(value: unknown) => {
                        return [`${Number(value).toFixed(2)}%`, ""];
                      }}
                    />
                    <Legend
                      iconType="plainline"
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rebeta"
                      name="Rebeta"
                      stroke="#C5A049"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="btc"
                      name="BTC"
                      stroke="#777777"
                      strokeWidth={1}
                      dot={false}
                      connectNulls
                      strokeDasharray="4 2"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── C. Monthly Returns Grid ── */}
            {years.length > 0 && (
              <div>
                <SectionLabel>Monthly Returns (%)</SectionLabel>
                <div className="mt-3 overflow-x-auto rounded-sm border border-border-subtle bg-bg-card p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-2 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal w-14">
                          Year
                        </th>
                        {MONTH_NAMES.map((m) => (
                          <th
                            key={m}
                            className="px-1 py-2 text-center text-[10px] uppercase tracking-[0.5px] text-text-muted font-normal"
                          >
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {years.map((year) => (
                        <tr key={year}>
                          <td className="px-2 py-1 font-[family-name:var(--font-mono)] text-text-primary font-medium">
                            {year}
                          </td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                            const val = monthlyByYear[year]?.[month];
                            if (val === undefined) {
                              return (
                                <td key={month} className="px-0.5 py-0.5">
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
                                    "flex h-8 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[11px]",
                                    monthReturnColor(val)
                                  )}
                                >
                                  {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── D. Trade Highlights ── */}
            {(report.topWins.length > 0 || report.topLosses.length > 0) && (
              <div>
                <SectionLabel>Trade Highlights</SectionLabel>
                <div className="mt-3 grid gap-4 xl:grid-cols-2">
                  {/* Top Wins */}
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[1px] text-pnl-positive">
                      Top Wins
                    </div>
                    <div className="overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
                      {report.topWins.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-text-muted">No trades</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border-subtle bg-bg-elevated">
                              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">Symbol</th>
                              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">Side</th>
                              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">PnL %</th>
                              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">Hold (h)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.topWins.map((t, i) => (
                              <tr key={i} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                                <td className="px-3 py-2 font-[family-name:var(--font-mono)] font-medium text-text-primary">
                                  {t.symbol}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={cn(
                                    "text-[10px] uppercase tracking-[0.5px]",
                                    t.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
                                  )}>
                                    {t.side}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] text-pnl-positive">
                                  {formatPnlPercent(t.pnlPercent / 100)}
                                </td>
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] text-text-secondary">
                                  {t.holdingHours}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Top Losses */}
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[1px] text-pnl-negative">
                      Top Losses
                    </div>
                    <div className="overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
                      {report.topLosses.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-text-muted">No trades</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border-subtle bg-bg-elevated">
                              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">Symbol</th>
                              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">Side</th>
                              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">PnL %</th>
                              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.5px] text-text-secondary font-normal">Hold (h)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.topLosses.map((t, i) => (
                              <tr key={i} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                                <td className="px-3 py-2 font-[family-name:var(--font-mono)] font-medium text-text-primary">
                                  {t.symbol}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={cn(
                                    "text-[10px] uppercase tracking-[0.5px]",
                                    t.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
                                  )}>
                                    {t.side}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] text-pnl-negative">
                                  {formatPnlPercent(t.pnlPercent / 100)}
                                </td>
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] text-text-secondary">
                                  {t.holdingHours}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Additional Metrics ── */}
            <div>
              <SectionLabel>Risk Metrics</SectionLabel>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                  label="Sortino Ratio"
                  value={report.sortinoRatio.toFixed(2)}
                  colorClass={report.sortinoRatio >= 1 ? "text-pnl-positive" : "text-text-primary"}
                />
                <MetricCard
                  label="Daily VaR (95%)"
                  value={`${report.var95.toFixed(2)}%`}
                  colorClass="text-pnl-negative"
                />
                <MetricCard
                  label="BTC Return"
                  value={`${report.btcReturn >= 0 ? "+" : ""}${report.btcReturn.toFixed(2)}%`}
                  colorClass={report.btcReturn >= 0 ? "text-pnl-positive" : "text-pnl-negative"}
                />
                <MetricCard
                  label="Total Trades"
                  value={String(report.totalTrades)}
                  sub={`Win rate: ${report.winRate.toFixed(1)}%`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border-subtle pt-4 text-center print:block">
              <p className="text-[10px] text-text-muted">
                Rootstone Dashboard &middot; Period: {report.period.start} ~ {report.period.end} &middot; Benchmark: BTC
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!report && !loading && !error && (
          <div className="mt-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-[11px] uppercase tracking-[2px] text-text-muted">No Report Generated</div>
            <p className="text-xs text-text-muted">Select a period and click Generate Report.</p>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, header { display: none !important; }
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
