"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { getRegimeDisplay, RegimeType } from "@/lib/math/regime";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface RegimeIndicators {
  btcVolatility30d: number;
  btcEthCorrelation: number;
  momentumScore: number;
  btcReturn7d: number;
}

interface TimelineEntry {
  date: string;
  regime: RegimeType;
  dailyReturn: number | null;
}

interface RegimeStat {
  regime: RegimeType;
  avgDailyReturn: number;
  totalDays: number;
  totalReturn: number;
}

interface RegimeData {
  currentRegime: RegimeType;
  confidence: number;
  indicators: RegimeIndicators;
  timeline: TimelineEntry[];
  regimeStats: RegimeStat[];
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════
   Fetcher
   ═══════════════════════════════════════════════════════════════ */

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

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

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm border border-border-subtle bg-bg-card",
        className
      )}
    />
  );
}

/* ─── Confidence Progress Bar ─── */
function ConfidenceBar({
  value,
  colorClass,
}: {
  value: number;
  colorClass: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-muted">
          Confidence
        </span>
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-sm font-medium",
            colorClass
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={cn("h-full rounded-full transition-all duration-700", colorClass.replace("text-", "bg-"))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Threshold Marker ─── */
function ThresholdRow({
  label,
  status,
  statusColor,
}: {
  label: string;
  status: string;
  statusColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.5px]",
          statusColor
        )}
      >
        {status}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section A: Current Regime Hero
   ═══════════════════════════════════════════════════════════════ */

function RegimeHero({ data }: { data: RegimeData }) {
  const display = getRegimeDisplay(data.currentRegime);
  const updatedAt = new Date(data.updatedAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div
      className={cn(
        "rounded-sm border bg-bg-card p-8",
        display.borderColor
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: Icon + Regime name */}
        <div className="flex items-start gap-5">
          <div
            className={cn(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-sm text-3xl",
              display.bgColor
            )}
          >
            <span className={display.color}>{display.icon}</span>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[2px] text-text-muted">
              Current Market Regime
            </div>
            <div
              className={cn(
                "mt-1 font-[family-name:var(--font-heading)] text-4xl font-light tracking-wide",
                display.color
              )}
            >
              {display.label}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {display.description}
            </p>
          </div>
        </div>

        {/* Right: Confidence + Timestamp */}
        <div className="w-full shrink-0 space-y-3 sm:w-56">
          <ConfidenceBar
            value={data.confidence}
            colorClass={display.color}
          />
          <div className="text-right text-[10px] text-text-muted">
            Updated {updatedAt}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section B: Regime Indicators (3-column)
   ═══════════════════════════════════════════════════════════════ */

function VolatilityCard({ vol }: { vol: number }) {
  const status =
    vol > 80
      ? { label: "Extreme", color: "text-pnl-negative" }
      : vol > 50
        ? { label: "Elevated", color: "text-status-warn" }
        : { label: "Normal", color: "text-pnl-positive" };

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <SectionLabel>Volatility Index</SectionLabel>
      <div className="mt-4">
        <div className="font-[family-name:var(--font-mono)] text-3xl font-semibold text-text-primary">
          {vol.toFixed(1)}
          <span className="ml-1 text-base text-text-muted">%</span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-text-muted">
          BTC 30d Annualized
        </div>
      </div>
      <div className="mt-4 divide-y divide-border-subtle">
        <ThresholdRow label="Normal" status="< 50%" statusColor="text-pnl-positive" />
        <ThresholdRow label="Elevated" status="50–80%" statusColor="text-status-warn" />
        <ThresholdRow label="Extreme" status="> 80%" statusColor="text-pnl-negative" />
      </div>
      <div className="mt-4 pt-3 border-t border-border-subtle">
        <span className="text-[11px] text-text-muted">Current: </span>
        <span className={cn("text-[11px] font-semibold uppercase", status.color)}>
          {status.label}
        </span>
      </div>
    </div>
  );
}

function CorrelationCard({ corr }: { corr: number }) {
  const status =
    corr < 0.4
      ? { label: "Breakdown", color: "text-pnl-negative" }
      : corr < 0.6
        ? { label: "Weakening", color: "text-status-warn" }
        : { label: "Normal", color: "text-pnl-positive" };

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <SectionLabel>Correlation Score</SectionLabel>
      <div className="mt-4">
        <div className="font-[family-name:var(--font-mono)] text-3xl font-semibold text-text-primary">
          {corr.toFixed(3)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-text-muted">
          BTC-ETH 30d Pearson
        </div>
      </div>
      <div className="mt-4 divide-y divide-border-subtle">
        <ThresholdRow label="Normal" status="> 0.60" statusColor="text-pnl-positive" />
        <ThresholdRow label="Weakening" status="0.40–0.60" statusColor="text-status-warn" />
        <ThresholdRow label="Breakdown" status="< 0.40" statusColor="text-pnl-negative" />
      </div>
      <div className="mt-4 pt-3 border-t border-border-subtle">
        <span className="text-[11px] text-text-muted">Current: </span>
        <span className={cn("text-[11px] font-semibold uppercase", status.color)}>
          {status.label}
        </span>
      </div>
    </div>
  );
}

function MomentumCard({ score }: { score: number }) {
  const status =
    score > 2
      ? { label: "Positive", color: "text-pnl-positive" }
      : score < -2
        ? { label: "Negative", color: "text-pnl-negative" }
        : { label: "Neutral", color: "text-text-secondary" };

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <SectionLabel>Momentum Score</SectionLabel>
      <div className="mt-4">
        <div
          className={cn(
            "font-[family-name:var(--font-mono)] text-3xl font-semibold",
            score > 0 ? "text-pnl-positive" : score < 0 ? "text-pnl-negative" : "text-text-primary"
          )}
        >
          {score > 0 ? "+" : ""}
          {score.toFixed(2)}
          <span className="ml-1 text-base text-text-muted">%</span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-text-muted">
          Multi-Asset 7d Avg Return
        </div>
      </div>
      <div className="mt-4 divide-y divide-border-subtle">
        <ThresholdRow label="Positive" status="> +2%" statusColor="text-pnl-positive" />
        <ThresholdRow label="Neutral" status="-2% ~ +2%" statusColor="text-text-secondary" />
        <ThresholdRow label="Negative" status="< -2%" statusColor="text-pnl-negative" />
      </div>
      <div className="mt-4 pt-3 border-t border-border-subtle">
        <span className="text-[11px] text-text-muted">Current: </span>
        <span className={cn("text-[11px] font-semibold uppercase", status.color)}>
          {status.label}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section C: Regime Timeline
   ═══════════════════════════════════════════════════════════════ */

const REGIME_COLORS: Record<RegimeType, string> = {
  core: "bg-gold/70",
  challenging: "bg-status-warn/70",
  crisis: "bg-pnl-negative/70",
};

function RegimeTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) return null;

  return (
    <div>
      <SectionLabel>90-Day Regime Timeline</SectionLabel>
      <div className="mt-3 rounded-sm border border-border-subtle bg-bg-card p-5">
        {/* Bar */}
        <div className="flex h-8 overflow-hidden rounded-sm">
          {timeline.map((entry, i) => (
            <div
              key={i}
              className={cn("shrink-0 transition-opacity hover:opacity-80", REGIME_COLORS[entry.regime])}
              style={{ width: `${100 / timeline.length}%` }}
              title={`${entry.date}: ${entry.regime.toUpperCase()}${entry.dailyReturn !== null ? ` (${entry.dailyReturn > 0 ? "+" : ""}${entry.dailyReturn.toFixed(2)}%)` : ""}`}
            />
          ))}
        </div>

        {/* Date labels */}
        <div className="mt-2 flex justify-between text-[10px] text-text-muted font-[family-name:var(--font-mono)]">
          <span>{timeline[0]?.date}</span>
          <span>{timeline[Math.floor(timeline.length / 2)]?.date}</span>
          <span>{timeline[timeline.length - 1]?.date}</span>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px]">
          {(["core", "challenging", "crisis"] as RegimeType[]).map((r) => {
            const count = timeline.filter((t) => t.regime === r).length;
            const pct = ((count / timeline.length) * 100).toFixed(0);
            return (
              <div key={r} className="flex items-center gap-1.5">
                <div className={cn("h-3 w-3 rounded-sm", REGIME_COLORS[r])} />
                <span className="text-text-secondary capitalize">{r}</span>
                <span className="font-[family-name:var(--font-mono)] text-text-muted">
                  {count}d ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section D: Regime Performance Stats
   ═══════════════════════════════════════════════════════════════ */

function RegimeStatsCards({ stats }: { stats: RegimeStat[] }) {
  return (
    <div>
      <SectionLabel>Regime Performance Stats</SectionLabel>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const display = getRegimeDisplay(s.regime);
          return (
            <div
              key={s.regime}
              className={cn(
                "rounded-sm border bg-bg-card p-5",
                display.borderColor
              )}
            >
              <div className={cn("text-[11px] font-medium uppercase tracking-[2px]", display.color)}>
                {display.label}
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">
                    Avg Daily Return
                  </div>
                  <div
                    className={cn(
                      "mt-1 font-[family-name:var(--font-mono)] text-xl font-semibold",
                      s.avgDailyReturn > 0
                        ? "text-pnl-positive"
                        : s.avgDailyReturn < 0
                          ? "text-pnl-negative"
                          : "text-text-primary"
                    )}
                  >
                    {s.avgDailyReturn > 0 ? "+" : ""}
                    {s.avgDailyReturn.toFixed(3)}%
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">Days</div>
                    <div className="mt-0.5 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                      {s.totalDays}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">
                      Total Return
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 font-[family-name:var(--font-mono)] text-sm",
                        s.totalReturn > 0
                          ? "text-pnl-positive"
                          : s.totalReturn < 0
                            ? "text-pnl-negative"
                            : "text-text-muted"
                      )}
                    >
                      {s.totalReturn > 0 ? "+" : ""}
                      {s.totalReturn.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section E: Market Context Panel
   ═══════════════════════════════════════════════════════════════ */

function MarketContextPanel({ indicators }: { indicators: RegimeIndicators }) {
  const items = [
    {
      label: "BTC 30d Volatility",
      value: `${indicators.btcVolatility30d.toFixed(1)}%`,
      sub: "Annualized realized vol",
      color:
        indicators.btcVolatility30d > 80
          ? "text-pnl-negative"
          : indicators.btcVolatility30d > 50
            ? "text-status-warn"
            : "text-pnl-positive",
    },
    {
      label: "BTC-ETH Correlation",
      value: indicators.btcEthCorrelation.toFixed(3),
      sub: "30d Pearson coefficient",
      color:
        indicators.btcEthCorrelation < 0.4
          ? "text-pnl-negative"
          : indicators.btcEthCorrelation < 0.6
            ? "text-status-warn"
            : "text-pnl-positive",
    },
    {
      label: "Recent 7d Return",
      value: `${indicators.btcReturn7d > 0 ? "+" : ""}${indicators.btcReturn7d.toFixed(2)}%`,
      sub: "BTC price change",
      color:
        indicators.btcReturn7d > 0
          ? "text-pnl-positive"
          : indicators.btcReturn7d < 0
            ? "text-pnl-negative"
            : "text-text-primary",
    },
  ];

  return (
    <div>
      <SectionLabel>Market Context</SectionLabel>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-sm border border-border-subtle bg-bg-card p-4"
          >
            <div className="text-[10px] uppercase tracking-[1px] text-text-muted">
              {item.label}
            </div>
            <div
              className={cn(
                "mt-2 font-[family-name:var(--font-mono)] text-2xl font-semibold",
                item.color
              )}
            >
              {item.value}
            </div>
            <div className="mt-1 text-[10px] text-text-muted">{item.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function RegimePage() {
  const { data, error, isLoading } = useSWR<RegimeData>(
    "/api/bybit/regime",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 } // refresh every 5 minutes
  );

  return (
    <div>
      <Header title="Market Regime" />
      <div className="p-6 space-y-8">
        {/* Error state */}
        {error && (
          <div className="rounded-sm border border-pnl-negative/30 bg-pnl-negative/10 px-5 py-4 text-sm text-pnl-negative">
            Failed to load regime data. Please try again later.
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <>
            <SkeletonCard className="h-40" />
            <div className="grid gap-3 sm:grid-cols-3">
              <SkeletonCard className="h-56" />
              <SkeletonCard className="h-56" />
              <SkeletonCard className="h-56" />
            </div>
            <SkeletonCard className="h-24" />
            <div className="grid gap-3 sm:grid-cols-3">
              <SkeletonCard className="h-36" />
              <SkeletonCard className="h-36" />
              <SkeletonCard className="h-36" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
            </div>
          </>
        )}

        {/* Data loaded */}
        {data && !error && (
          <>
            {/* A. Current Regime Hero */}
            <RegimeHero data={data} />

            {/* B. Regime Indicators */}
            <div>
              <SectionLabel>Regime Indicators</SectionLabel>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <VolatilityCard vol={data.indicators.btcVolatility30d} />
                <CorrelationCard corr={data.indicators.btcEthCorrelation} />
                <MomentumCard score={data.indicators.momentumScore} />
              </div>
            </div>

            {/* C. Regime Timeline */}
            <RegimeTimeline timeline={data.timeline} />

            {/* D. Regime Performance Stats */}
            <RegimeStatsCards stats={data.regimeStats} />

            {/* E. Market Context Panel */}
            <MarketContextPanel indicators={data.indicators} />
          </>
        )}
      </div>
    </div>
  );
}
