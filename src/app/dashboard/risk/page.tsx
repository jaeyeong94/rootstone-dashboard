"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/* ════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════ */

interface RiskMetrics {
  grossExposure: number;
  netExposure: number;
  positionCount: number;
  maxPositions: number;
  avgLeverage: number;
  monthlyDrawdown: number;
  longestHoldingHours: number;
  concentrations: { symbol: string; weight: number }[];
  limits: {
    maxGrossExposure: number;
    maxMonthlyDrawdown: number;
    maxHoldingHours: number;
  };
}

interface ExposureHistoryPoint {
  date: string;
  grossExposure: number | null;
  netExposure: number | null;
}

interface ExposureHistoryResponse {
  history: ExposureHistoryPoint[];
  days: number;
}

/* ════════════════════════════════════════════════════════════════
   Fetcher
   ════════════════════════════════════════════════════════════════ */

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch error");
    return r.json();
  });

/* ════════════════════════════════════════════════════════════════
   Helper Components
   ════════════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm border border-border-subtle bg-bg-card p-5",
        className
      )}
    >
      <div className="h-3 w-20 rounded bg-bg-elevated" />
      <div className="mt-4 h-8 w-32 rounded bg-bg-elevated" />
      <div className="mt-2 h-2 w-16 rounded bg-bg-elevated" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Gauge — CSS arc using conic-gradient
   ════════════════════════════════════════════════════════════════ */

interface GaugeProps {
  value: number;   // current value
  max: number;     // max before breach
  label: string;
  unit?: string;
  decimals?: number;
}

function Gauge({ value, max, label, unit = "x", decimals = 2 }: GaugeProps) {
  // Arc goes 0 → 180deg (half circle). Fill proportion = value / max, capped at 1.
  const pct = Math.min(value / max, 1);
  // 0% → gray, <80% → bronze, 80-100% → gold, >100% → red
  const fillColor =
    value === 0
      ? "#333333"
      : pct >= 1
      ? "#EF4444"
      : pct >= 0.8
      ? "#C5A049"
      : "#997B66";

  // Gauge degrees: 0 = left (180deg css), fills clockwise to right (0deg)
  // We rotate the fill: the arc covers half of a donut (180 deg sweep).
  // Implementation: use two overlapping divs with border-radius + transform.
  const fillDeg = Math.round(pct * 180);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Arc container */}
      <div className="relative" style={{ width: 120, height: 66 }}>
        {/* Track (gray half-circle) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: "120px 120px 0 0" }}
        >
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: 120,
              borderRadius: "60px",
              background: "#222",
              border: "8px solid #333",
              borderBottom: "none",
            }}
          />
        </div>

        {/* Fill using conic-gradient on a circle, clipped to top half */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: "120px 120px 0 0" }}
        >
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: 120,
              borderRadius: "60px",
              background: `conic-gradient(from 180deg at 50% 100%, ${fillColor} ${fillDeg}deg, transparent ${fillDeg}deg)`,
            }}
          />
          {/* Inner mask to create donut */}
          <div
            className="absolute"
            style={{
              width: 88,
              height: 88,
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%)",
              borderRadius: "50%",
              background: "#161616",
            }}
          />
        </div>

        {/* Needle indicator dot at tip */}
        <div
          className="absolute"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: fillColor,
            bottom: 0,
            left: "50%",
            transformOrigin: "50% calc(100% + 56px)",
            transform: `translateX(-50%) rotate(${fillDeg - 90}deg)`,
            transition: "transform 0.6s ease",
          }}
        />

        {/* Center value */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span
            className="font-[family-name:var(--font-mono)] text-xl font-semibold leading-none"
            style={{ color: fillColor }}
          >
            {value.toFixed(decimals)}
            <span className="ml-0.5 text-sm font-normal">{unit}</span>
          </span>
        </div>
      </div>

      {/* Label */}
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        {label}
      </span>
      <span className="text-[10px] text-text-muted">
        Limit: {max.toFixed(decimals)}{unit}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Risk Status Badge
   ════════════════════════════════════════════════════════════════ */

type StatusLevel = "SAFE" | "WARNING" | "BREACH";

function StatusBadge({ status }: { status: StatusLevel }) {
  return (
    <span
      className={cn(
        "rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[1px]",
        status === "SAFE" && "bg-pnl-positive/10 text-pnl-positive",
        status === "WARNING" && "bg-gold/10 text-gold",
        status === "BREACH" && "bg-pnl-negative/10 text-pnl-negative"
      )}
    >
      {status}
    </span>
  );
}

function getRiskStatus(value: number, limit: number, lowerIsBetter: boolean): StatusLevel {
  if (lowerIsBetter) {
    const pct = value / Math.abs(limit);
    if (pct <= 0.7) return "SAFE";
    if (pct <= 1.0) return "WARNING";
    return "BREACH";
  } else {
    // higher is better (e.g. position count)
    const pct = value / limit;
    if (pct <= 0.5) return "SAFE";
    if (pct <= 0.75) return "WARNING";
    return "BREACH";
  }
}

/* ════════════════════════════════════════════════════════════════
   Exposure History Chart
   ════════════════════════════════════════════════════════════════ */

interface ExposureChartProps {
  data: ExposureHistoryPoint[];
  grossExposure: number;
  netExposure: number;
}

function ExposureChart({ data, grossExposure, netExposure }: ExposureChartProps) {
  // If no historical data with real values, show a placeholder with current point
  const hasRealData = data.some(
    (d) => d.grossExposure !== null || d.netExposure !== null
  );

  const today = new Date().toISOString().slice(0, 10);

  // Build chart data: use real history where available, fallback to synthetic
  const chartData = hasRealData
    ? data.map((d) => ({
        date: d.date.slice(5), // MM-DD
        gross: d.grossExposure,
        net: d.netExposure,
      }))
    : [
        { date: today.slice(5), gross: grossExposure, net: netExposure },
      ];

  const tooltipStyle = {
    backgroundColor: "#161616",
    border: "1px solid #333",
    borderRadius: 2,
    fontSize: 11,
    color: "#e0e0e0",
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#997B66" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#997B66" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C5A049" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#C5A049" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#555" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#555" }}
          axisLine={false}
          tickLine={false}
          width={32}
          tickFormatter={(v) => `${v.toFixed(1)}x`}
        />
        <ReferenceLine y={3} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.5} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => {
            const v = value as number | null | undefined;
            return v != null ? [`${v.toFixed(2)}x`] : ["—"];
          }}
        />
        <Area
          type="monotone"
          dataKey="gross"
          name="Gross"
          stroke="#997B66"
          strokeWidth={1.5}
          fill="url(#gradGross)"
          connectNulls
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="net"
          name="Net"
          stroke="#C5A049"
          strokeWidth={1.5}
          fill="url(#gradNet)"
          connectNulls
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════ */

export default function RiskPage() {
  const { data: metrics, error: metricsError, isLoading: metricsLoading } =
    useSWR<RiskMetrics & { limits: RiskMetrics["limits"] }>(
      "/api/bybit/risk-metrics",
      fetcher,
      { refreshInterval: 30_000 }
    );

  const { data: historyData, isLoading: historyLoading } =
    useSWR<ExposureHistoryResponse>(
      "/api/bybit/exposure-history?days=30",
      fetcher,
      { refreshInterval: 60_000 }
    );

  const isLoading = metricsLoading;

  if (metricsError) {
    return (
      <div>
        <Header title="Risk Monitor" />
        <div className="flex h-64 items-center justify-center text-sm text-pnl-negative">
          Failed to load risk data — check API connectivity
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Risk Monitor" />
      <div className="space-y-8 p-6">

        {/* ── A. Exposure Dashboard ── */}
        <section>
          <SectionLabel>Exposure Dashboard</SectionLabel>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : metrics ? (
              <>
                {/* Gross Exposure Gauge */}
                <div className="flex flex-col items-center rounded-sm border border-border-subtle bg-bg-card p-5">
                  <Gauge
                    value={metrics.grossExposure}
                    max={metrics.limits.maxGrossExposure}
                    label="Gross Exposure"
                    unit="x"
                    decimals={2}
                  />
                </div>

                {/* Net Exposure */}
                <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
                  <div className="text-[11px] uppercase tracking-[1px] text-text-muted">
                    Net Exposure
                  </div>
                  <div
                    className={cn(
                      "mt-3 font-[family-name:var(--font-mono)] text-3xl font-semibold",
                      metrics.netExposure > 0
                        ? "text-pnl-positive"
                        : metrics.netExposure < 0
                        ? "text-pnl-negative"
                        : "text-text-secondary"
                    )}
                  >
                    {metrics.netExposure >= 0 ? "+" : ""}
                    {(metrics.netExposure * 100).toFixed(1)}%
                  </div>
                  <div className="mt-1 text-[10px] text-text-muted">
                    Long vs Short imbalance
                  </div>
                </div>

                {/* Position Count */}
                <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
                  <div className="text-[11px] uppercase tracking-[1px] text-text-muted">
                    Position Count
                  </div>
                  <div className="mt-3 flex items-end gap-1">
                    <span
                      className={cn(
                        "font-[family-name:var(--font-mono)] text-3xl font-semibold",
                        metrics.positionCount >= metrics.maxPositions
                          ? "text-pnl-negative"
                          : "text-text-primary"
                      )}
                    >
                      {metrics.positionCount}
                    </span>
                    <span className="mb-1 font-[family-name:var(--font-mono)] text-base text-text-muted">
                      / {metrics.maxPositions}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        metrics.positionCount >= metrics.maxPositions
                          ? "bg-pnl-negative"
                          : "bg-bronze"
                      )}
                      style={{
                        width: `${(metrics.positionCount / metrics.maxPositions) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-text-muted">
                    Max {metrics.maxPositions} concurrent
                  </div>
                </div>

                {/* Avg Leverage */}
                <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
                  <div className="text-[11px] uppercase tracking-[1px] text-text-muted">
                    Avg Leverage
                  </div>
                  <div className="mt-3 font-[family-name:var(--font-mono)] text-3xl font-semibold text-text-primary">
                    {metrics.avgLeverage > 0
                      ? `${metrics.avgLeverage.toFixed(1)}x`
                      : "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-text-muted">
                    Weighted by position size
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* ── B. Monthly Drawdown Tracker ── */}
        <section>
          <SectionLabel>Monthly Drawdown Tracker</SectionLabel>
          <div className="mt-4 rounded-sm border border-border-subtle bg-bg-card p-5">
            {isLoading ? (
              <div className="h-16 animate-pulse rounded bg-bg-elevated" />
            ) : metrics ? (
              <MonthlyDrawdownTracker
                drawdown={metrics.monthlyDrawdown}
                limit={metrics.limits.maxMonthlyDrawdown}
              />
            ) : null}
          </div>
        </section>

        {/* ── Exposure History Chart ── */}
        <section>
          <div className="flex items-center justify-between">
            <SectionLabel>Exposure History (30d)</SectionLabel>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 bg-bronze" />
                Gross
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 bg-gold" />
                Net
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 border-t border-dashed border-pnl-negative" />
                x3 Limit
              </span>
            </div>
          </div>
          <div className="mt-4 rounded-sm border border-border-subtle bg-bg-card p-5">
            {historyLoading || isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-40 w-full animate-pulse rounded bg-bg-elevated" />
              </div>
            ) : metrics ? (
              <ExposureChart
                data={historyData?.history ?? []}
                grossExposure={metrics.grossExposure}
                netExposure={metrics.netExposure}
              />
            ) : null}
          </div>
        </section>

        {/* ── C. Position Concentration ── */}
        <section>
          <SectionLabel>Position Concentration</SectionLabel>
          <div className="mt-4 rounded-sm border border-border-subtle bg-bg-card p-5">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-bg-elevated" />
                ))}
              </div>
            ) : !metrics || metrics.concentrations.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-text-muted">
                No open positions
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.concentrations.map((c) => (
                  <ConcentrationBar key={c.symbol} symbol={c.symbol} weight={c.weight} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── D. Risk Parameters Status ── */}
        <section>
          <SectionLabel>Risk Parameters Status</SectionLabel>
          <div className="mt-4 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated">
                  <th className="px-4 py-3 text-left text-[11px] font-normal uppercase tracking-[1px] text-text-secondary">
                    Parameter
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-normal uppercase tracking-[1px] text-text-secondary">
                    Limit
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-normal uppercase tracking-[1px] text-text-secondary">
                    Current
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-normal uppercase tracking-[1px] text-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6">
                      <div className="h-24 animate-pulse rounded bg-bg-elevated" />
                    </td>
                  </tr>
                ) : metrics ? (
                  <>
                    {/* Max Gross Exposure */}
                    <RiskParamRow
                      name="Max Gross Exposure"
                      limit={`x${metrics.limits.maxGrossExposure.toFixed(1)}`}
                      current={`x${metrics.grossExposure.toFixed(2)}`}
                      status={getRiskStatus(
                        metrics.grossExposure,
                        metrics.limits.maxGrossExposure,
                        true
                      )}
                    />
                    {/* Monthly Drawdown */}
                    <RiskParamRow
                      name="Monthly Drawdown"
                      limit={`${(metrics.limits.maxMonthlyDrawdown * 100).toFixed(0)}%`}
                      current={`${(metrics.monthlyDrawdown * 100).toFixed(2)}%`}
                      status={
                        metrics.monthlyDrawdown <= metrics.limits.maxMonthlyDrawdown
                          ? "BREACH"
                          : metrics.monthlyDrawdown <= metrics.limits.maxMonthlyDrawdown * 0.7
                          ? "WARNING"
                          : "SAFE"
                      }
                    />
                    {/* Max Holding Time */}
                    <RiskParamRow
                      name="Longest Holding Time"
                      limit={`${metrics.limits.maxHoldingHours}h`}
                      current={
                        metrics.longestHoldingHours > 0
                          ? `${metrics.longestHoldingHours.toFixed(1)}h`
                          : "—"
                      }
                      status={
                        metrics.longestHoldingHours === 0
                          ? "SAFE"
                          : metrics.longestHoldingHours >= metrics.limits.maxHoldingHours
                          ? "BREACH"
                          : metrics.longestHoldingHours >= metrics.limits.maxHoldingHours * 0.75
                          ? "WARNING"
                          : "SAFE"
                      }
                      isLast
                    />
                  </>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════════════ */

function MonthlyDrawdownTracker({
  drawdown,
  limit,
}: {
  drawdown: number;
  limit: number; // negative number e.g. -0.10
}) {
  // drawdown is negative for loss; limit is negative threshold
  const dd = drawdown * 100; // as percentage
  const lim = limit * 100;   // as percentage, negative

  // pct filled = how far into the limit we are (0 to 1)
  // dd is 0 or negative; lim is negative
  const pct = dd <= 0 ? Math.min(Math.abs(dd) / Math.abs(lim), 1) : 0;

  const isBreached = drawdown <= limit;
  const isWarning = !isBreached && pct >= 0.7;

  const barColor = isBreached
    ? "bg-pnl-negative"
    : isWarning
    ? "bg-gold"
    : "bg-bronze";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-2xl font-semibold",
              isBreached
                ? "text-pnl-negative"
                : isWarning
                ? "text-gold"
                : dd < 0
                ? "text-text-primary"
                : "text-pnl-positive"
            )}
          >
            {dd >= 0 ? "+" : ""}{dd.toFixed(2)}%
          </span>
          <span className="ml-2 text-[11px] text-text-muted">this month</span>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-[1px] text-text-muted">
            Limit
          </span>
          <div className="font-[family-name:var(--font-mono)] text-sm text-text-secondary">
            {lim.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        {/* Tick marks at 25%, 50%, 75%, 100% */}
        <div className="pointer-events-none absolute inset-0 flex items-center">
          {[0.25, 0.5, 0.75].map((t) => (
            <div
              key={t}
              className="absolute h-3 w-px bg-bg-primary"
              style={{ left: `${t * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
        <span>0%</span>
        <span>{(lim / 2).toFixed(0)}%</span>
        <span>{lim.toFixed(0)}%</span>
      </div>

      {isBreached && (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-pnl-negative/30 bg-pnl-negative/5 px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-pnl-negative" />
          <span className="text-[11px] text-pnl-negative">
            Monthly drawdown limit breached — review strategy exposure
          </span>
        </div>
      )}
    </div>
  );
}

function ConcentrationBar({
  symbol,
  weight,
}: {
  symbol: string;
  weight: number;
}) {
  const pct = weight * 100;
  const isConcentrated = pct > 50;

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-xs font-medium text-text-primary">
        {symbol}
      </span>
      <div className="flex-1">
        <div className="h-5 overflow-hidden rounded-sm bg-bg-elevated">
          <div
            className={cn(
              "h-full rounded-sm transition-all duration-500",
              isConcentrated ? "bg-gold/60" : "bg-bronze/60"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "w-12 text-right font-[family-name:var(--font-mono)] text-xs",
          isConcentrated ? "text-gold" : "text-text-secondary"
        )}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function RiskParamRow({
  name,
  limit,
  current,
  status,
  isLast = false,
}: {
  name: string;
  limit: string;
  current: string;
  status: StatusLevel;
  isLast?: boolean;
}) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-bg-elevated",
        !isLast && "border-b border-border-subtle"
      )}
    >
      <td className="px-4 py-3 text-sm text-text-secondary">{name}</td>
      <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-sm text-text-muted">
        {limit}
      </td>
      <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-sm text-text-primary">
        {current}
      </td>
      <td className="px-4 py-3 text-right">
        <StatusBadge status={status} />
      </td>
    </tr>
  );
}
