"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface RiskMetrics {
  grossExposure: number;
  netExposure: number;
  maxGrossLimit: number;
  positionCount: number;
  maxPositions: number;
  avgLeverage: number;
  monthlyDrawdown: number;
  monthlyDrawdownLimit: number;
  longestHoldingHours: number;
  maxHoldingHours: number;
  concentrations: {
    symbol: string;
    weight: number;
    side: "Buy" | "Sell";
    exposure: number;
  }[];
}

type RiskStatus = "SAFE" | "WARNING" | "BREACH";

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

function StatusBadge({ status }: { status: RiskStatus }) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-[1px] rounded-sm",
        status === "SAFE" && "bg-pnl-positive/10 text-pnl-positive",
        status === "WARNING" && "bg-gold/10 text-gold",
        status === "BREACH" && "bg-pnl-negative/10 text-pnl-negative"
      )}
    >
      {status}
    </span>
  );
}

function getGrossExposureStatus(value: number): RiskStatus {
  if (value < 1) return "SAFE";
  if (value <= 2) return "WARNING";
  return "BREACH";
}

function getDrawdownStatus(value: number): RiskStatus {
  if (value > -3) return "SAFE";
  if (value >= -7) return "WARNING";
  return "BREACH";
}

function getHoldingStatus(hours: number): RiskStatus {
  if (hours < 12) return "SAFE";
  if (hours <= 20) return "WARNING";
  return "BREACH";
}

function getPositionCountStatus(count: number): RiskStatus {
  if (count < 3) return "SAFE";
  if (count === 3) return "WARNING";
  return "BREACH";
}

function getGaugeColor(status: RiskStatus): string {
  if (status === "SAFE") return "#4ade80"; // green
  if (status === "WARNING") return "#C5A049"; // gold
  return "#f87171"; // red
}

/* ═══════════════════════════════════════════════════════════════
   Arc Gauge (CSS semicircle)
   ═══════════════════════════════════════════════════════════════ */

function ArcGauge({
  value,
  max,
  label,
  unit = "x",
  status,
}: {
  value: number;
  max: number;
  label: string;
  unit?: string;
  status: RiskStatus;
}) {
  // Map value to rotation angle: 0 = -90deg (left), max = +90deg (right)
  const ratio = Math.min(value / max, 1);
  // -90deg to +90deg span = 180deg total; start at -90
  const angle = -90 + ratio * 180;
  const gaugeColor = getGaugeColor(status);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-40 h-20 overflow-hidden">
        {/* Background track */}
        <div className="absolute inset-0 rounded-t-full border-4 border-border-subtle" />
        {/* Filled arc */}
        <div
          className="absolute inset-0 rounded-t-full border-4 border-transparent"
          style={{
            borderTopColor: gaugeColor,
            borderLeftColor: gaugeColor,
            borderRightColor: gaugeColor,
            transform: `rotate(${angle}deg)`,
            clipPath: "inset(0 0 50% 0)",
            transition: "transform 0.6s ease",
          }}
        />
        {/* Value display */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span
            className="font-[family-name:var(--font-mono)] text-2xl font-semibold"
            style={{ color: gaugeColor }}
          >
            {value.toFixed(2)}{unit}
          </span>
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-[2px] text-text-secondary">
        {label}
      </span>
      <StatusBadge status={status} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════════════════════════════ */

function StatCard({
  label,
  value,
  subValue,
  status,
}: {
  label: string;
  value: string;
  subValue?: string;
  status: RiskStatus;
}) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4 flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-end justify-between">
        <span
          className="font-[family-name:var(--font-mono)] text-3xl font-semibold"
          style={{ color: getGaugeColor(status) }}
        >
          {value}
        </span>
        {subValue && (
          <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted mb-1">
            {subValue}
          </span>
        )}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Drawdown Bar
   ═══════════════════════════════════════════════════════════════ */

function DrawdownBar({ value, limit }: { value: number; limit: number }) {
  // value is negative (e.g. -4.2), limit is negative (e.g. -10)
  const status = getDrawdownStatus(value);
  const fillPct = Math.min(Math.abs(value) / Math.abs(limit), 1) * 100;
  const barColor = getGaugeColor(status);

  // Zone markers at -3% and -7% relative to -10% limit
  const zone1 = (3 / 10) * 100; // 30%
  const zone2 = (7 / 10) * 100; // 70%

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Monthly Drawdown</SectionLabel>
        <div className="flex items-center gap-3">
          <span
            className="font-[family-name:var(--font-mono)] text-xl font-semibold"
            style={{ color: barColor }}
          >
            {value >= 0 ? "+" : ""}{value.toFixed(2)}%
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 w-full rounded-sm bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-700"
          style={{ width: `${fillPct}%`, backgroundColor: barColor }}
        />
        {/* Zone markers */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gold/50"
          style={{ left: `${zone1}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-pnl-negative/50"
          style={{ left: `${zone2}%` }}
        />
      </div>

      {/* Zone labels */}
      <div className="relative flex text-[10px] text-text-muted">
        <span className="absolute" style={{ left: `${zone1}%`, transform: "translateX(-50%)" }}>
          -3%
        </span>
        <span className="absolute" style={{ left: `${zone2}%`, transform: "translateX(-50%)" }}>
          -7%
        </span>
        <span className="absolute right-0">Limit {limit}%</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Concentration Bars
   ═══════════════════════════════════════════════════════════════ */

function ConcentrationBars({
  concentrations,
}: {
  concentrations: RiskMetrics["concentrations"];
}) {
  if (concentrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-text-muted text-sm">
        No open positions
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {concentrations.map((c) => {
        const isLong = c.side === "Buy";
        const barColor = isLong ? "#C5A049" : "#997B66";
        return (
          <div key={c.symbol} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-text-primary">
                  {c.symbol}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[1px]",
                    isLong ? "text-pnl-positive" : "text-pnl-negative"
                  )}
                >
                  {isLong ? "Long" : "Short"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-mono)] text-text-secondary">
                  {(c.exposure * 100).toFixed(1)}% equity
                </span>
                <span className="font-[family-name:var(--font-mono)] text-text-muted">
                  {(c.weight * 100).toFixed(1)}% portfolio
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-sm bg-bg-elevated overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-700"
                style={{
                  width: `${Math.min(c.weight * 100, 100)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Risk Parameters Table
   ═══════════════════════════════════════════════════════════════ */

interface RiskParamRow {
  label: string;
  limit: string;
  current: string;
  status: RiskStatus;
}

function RiskParamsTable({ rows }: { rows: RiskParamRow[] }) {
  return (
    <div className="overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-elevated">
            <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
              Parameter
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
              Limit
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
              Current
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated"
            >
              <td className="px-4 py-3 text-text-secondary">{row.label}</td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-text-muted">
                {row.limit}
              </td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-text-primary">
                {row.current}
              </td>
              <td className="px-4 py-3 text-right">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function RiskPage() {
  const [data, setData] = useState<RiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/bybit/risk-metrics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Derive statuses
  const grossStatus = data ? getGrossExposureStatus(data.grossExposure) : "SAFE";
  const netStatus = data ? getGrossExposureStatus(Math.abs(data.netExposure)) : "SAFE";
  const drawdownStatus = data ? getDrawdownStatus(data.monthlyDrawdown) : "SAFE";
  const holdingStatus = data ? getHoldingStatus(data.longestHoldingHours) : "SAFE";
  const posCountStatus = data ? getPositionCountStatus(data.positionCount) : "SAFE";

  const riskParamRows: RiskParamRow[] = data
    ? [
        {
          label: "Max Gross Exposure",
          limit: `×${data.maxGrossLimit.toFixed(1)}`,
          current: `×${data.grossExposure.toFixed(2)}`,
          status: grossStatus,
        },
        {
          label: "Monthly Drawdown",
          limit: `${data.monthlyDrawdownLimit}%`,
          current: `${data.monthlyDrawdown >= 0 ? "+" : ""}${data.monthlyDrawdown.toFixed(2)}%`,
          status: drawdownStatus,
        },
        {
          label: "Max Holding Period",
          limit: `${data.maxHoldingHours}h`,
          current: `${data.longestHoldingHours.toFixed(1)}h`,
          status: holdingStatus,
        },
        {
          label: "Position Count",
          limit: `${data.maxPositions}`,
          current: `${data.positionCount}`,
          status: posCountStatus,
        },
      ]
    : [];

  return (
    <div>
      <Header title="Risk Monitor" />
      <div className="p-6 space-y-10">

        {loading && (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Calculating risk metrics...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-48 text-pnl-negative text-sm">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* ── A. Exposure Dashboard ── */}
            <section>
              <SectionLabel>Exposure Dashboard</SectionLabel>
              <p className="mt-1 text-xs text-text-muted">
                Portfolio leverage relative to equity — limit ×{data.maxGrossLimit.toFixed(1)}
              </p>
              <div className="mt-4 rounded-sm border border-border-subtle bg-bg-card p-6">
                <div className="flex flex-wrap items-center justify-center gap-12">
                  <ArcGauge
                    value={data.grossExposure}
                    max={data.maxGrossLimit}
                    label="Gross Exposure"
                    unit="x"
                    status={grossStatus}
                  />
                  <ArcGauge
                    value={Math.abs(data.netExposure)}
                    max={data.maxGrossLimit}
                    label="Net Exposure"
                    unit="x"
                    status={netStatus}
                  />
                </div>
                {/* Net direction note */}
                <div className="mt-4 flex items-center justify-center gap-1 text-xs text-text-muted">
                  <span>Net direction:</span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-mono)] font-medium",
                      data.netExposure >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                    )}
                  >
                    {data.netExposure >= 0 ? "Long" : "Short"}{" "}
                    {(Math.abs(data.netExposure) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>

            {/* ── B. Position Count + Avg Leverage ── */}
            <section>
              <SectionLabel>Position Metrics</SectionLabel>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <StatCard
                  label="Position Count"
                  value={`${data.positionCount} / ${data.maxPositions}`}
                  status={posCountStatus}
                />
                <StatCard
                  label="Avg Leverage"
                  value={`×${data.avgLeverage.toFixed(2)}`}
                  subValue="weighted"
                  status={
                    data.avgLeverage < 5
                      ? "SAFE"
                      : data.avgLeverage < 8
                      ? "WARNING"
                      : "BREACH"
                  }
                />
              </div>
            </section>

            {/* ── C. Monthly Drawdown Tracker ── */}
            <section>
              <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
                <DrawdownBar
                  value={data.monthlyDrawdown}
                  limit={data.monthlyDrawdownLimit}
                />
                <p className="mt-4 text-xs text-text-muted">
                  MTD performance vs. month-open equity snapshot.
                  Strategy halt threshold at {data.monthlyDrawdownLimit}%.
                </p>
              </div>
            </section>

            {/* ── D. Position Concentration ── */}
            <section>
              <SectionLabel>Position Concentration</SectionLabel>
              <p className="mt-1 text-xs text-text-muted">
                Weight within gross portfolio and equity exposure per symbol
              </p>
              <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
                <ConcentrationBars concentrations={data.concentrations} />
              </div>
            </section>

            {/* ── E. Risk Parameters Status ── */}
            <section>
              <SectionLabel>Risk Parameters Status</SectionLabel>
              <div className="mt-3">
                <RiskParamsTable rows={riskParamRows} />
              </div>

              {/* Overall status banner */}
              {(() => {
                const statuses = riskParamRows.map((r) => r.status);
                const hasBreach = statuses.includes("BREACH");
                const hasWarning = statuses.includes("WARNING");
                const overall: RiskStatus = hasBreach
                  ? "BREACH"
                  : hasWarning
                  ? "WARNING"
                  : "SAFE";
                const messages: Record<RiskStatus, string> = {
                  SAFE: "All risk parameters within acceptable bounds.",
                  WARNING: "One or more parameters approaching limit — monitor closely.",
                  BREACH: "Risk limit breached — review and reduce exposure immediately.",
                };
                const borderColors: Record<RiskStatus, string> = {
                  SAFE: "border-pnl-positive",
                  WARNING: "border-gold",
                  BREACH: "border-pnl-negative",
                };
                return (
                  <div
                    className={cn(
                      "mt-3 rounded-sm border-l-2 bg-bg-elevated px-5 py-4",
                      borderColors[overall]
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={overall} />
                      <p className="text-xs text-text-secondary">{messages[overall]}</p>
                    </div>
                  </div>
                );
              })()}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
