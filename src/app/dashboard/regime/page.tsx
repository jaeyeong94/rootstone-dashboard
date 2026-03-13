"use client";

import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type RegimeType = "core" | "crisis" | "challenging";

interface RegimeIndicators {
  btcVolatility30d: number;
  btcEthCorrelation: number;
  momentumScore: number;
  btcReturn7d: number;
}

interface TimelineDay {
  date: string;
  regime: string;
  dailyReturn: number;
}

interface RegimeStat {
  regime: string;
  avgDailyReturn: number;
  totalDays: number;
  totalReturn: number;
}

interface RegimeData {
  currentRegime: RegimeType;
  confidence: number;
  indicators: RegimeIndicators;
  timeline: TimelineDay[];
  regimeStats: RegimeStat[];
  updatedAt: string;
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

function getRegimeDisplay(regime: RegimeType) {
  const displays = {
    core: {
      label: "CORE",
      description: "Normal trending markets — Full signal deployment",
      color: "text-gold",
      bgColor: "bg-gold/10",
      borderColor: "border-gold/30",
      barColor: "bg-gold",
      icon: "○",
    },
    crisis: {
      label: "CRISIS",
      description: "Extreme volatility — Defensive positioning",
      color: "text-pnl-negative",
      bgColor: "bg-pnl-negative/10",
      borderColor: "border-pnl-negative/30",
      barColor: "bg-pnl-negative",
      icon: "⚠",
    },
    challenging: {
      label: "CHALLENGING",
      description: "Choppy environment — Reduced position sizes",
      color: "text-status-warn",
      bgColor: "bg-status-warn/10",
      borderColor: "border-status-warn/30",
      barColor: "bg-status-warn",
      icon: "✱",
    },
  };
  return displays[regime];
}

function formatPct(v: number, sign = true): string {
  const prefix = sign && v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(2)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ═══════════════════════════════════════════════════════════════
   Skeleton
   ═══════════════════════════════════════════════════════════════ */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm bg-bg-elevated",
        className
      )}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-8">
      {/* Hero skeleton */}
      <SkeletonBlock className="h-48 w-full" />
      {/* Indicators skeleton */}
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      {/* Timeline skeleton */}
      <SkeletonBlock className="h-20 w-full" />
      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   A. Current Regime Hero
   ═══════════════════════════════════════════════════════════════ */

function RegimeHero({
  regime,
  confidence,
  updatedAt,
}: {
  regime: RegimeType;
  confidence: number;
  updatedAt: string;
}) {
  const display = getRegimeDisplay(regime);

  return (
    <div
      className={cn(
        "rounded-sm border p-8",
        display.bgColor,
        display.borderColor
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          {/* Regime label */}
          <div className="flex items-center gap-3">
            <span className={cn("text-2xl leading-none", display.color)}>
              {display.icon}
            </span>
            <h2
              className={cn(
                "font-[family-name:var(--font-heading)] text-5xl font-light tracking-[4px] uppercase",
                display.color
              )}
            >
              {display.label}
            </h2>
          </div>

          {/* Description */}
          <p className="text-sm text-text-secondary">{display.description}</p>

          {/* Confidence bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[1px] text-text-muted">
                Confidence
              </span>
              <span
                className={cn(
                  "font-[family-name:var(--font-mono)] text-sm",
                  display.color
                )}
              >
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-64 overflow-hidden rounded-full bg-bg-primary/40">
              <div
                className={cn("h-full rounded-full transition-all", display.barColor)}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Updated at */}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
            Last updated
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
            {formatDate(updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   B. Regime Indicators
   ═══════════════════════════════════════════════════════════════ */

interface IndicatorLevel {
  label: string;
  color: string;
}

function getVolLevel(vol: number): IndicatorLevel {
  if (vol > 80) return { label: "EXTREME", color: "text-pnl-negative" };
  if (vol > 50) return { label: "ELEVATED", color: "text-status-warn" };
  return { label: "NORMAL", color: "text-pnl-positive" };
}

function getCorrLevel(corr: number): IndicatorLevel {
  if (corr < 0.4) return { label: "BREAKDOWN", color: "text-pnl-negative" };
  if (corr < 0.65) return { label: "WEAKENING", color: "text-status-warn" };
  return { label: "NORMAL", color: "text-pnl-positive" };
}

function getMomentumLevel(score: number): IndicatorLevel {
  if (score > 3) return { label: "POSITIVE", color: "text-pnl-positive" };
  if (score < -3) return { label: "NEGATIVE", color: "text-pnl-negative" };
  return { label: "NEUTRAL", color: "text-text-secondary" };
}

function IndicatorCard({
  label,
  value,
  level,
  description,
}: {
  label: string;
  value: string;
  level: IndicatorLevel;
  description: string;
}) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4 space-y-3">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-end justify-between">
        <span className="font-[family-name:var(--font-mono)] text-2xl text-text-primary">
          {value}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[1px]",
            level.color
          )}
        >
          {level.label}
        </span>
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function RegimeIndicators({ indicators }: { indicators: RegimeIndicators }) {
  const volLevel = getVolLevel(indicators.btcVolatility30d);
  const corrLevel = getCorrLevel(indicators.btcEthCorrelation);
  const momentumLevel = getMomentumLevel(indicators.momentumScore);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <IndicatorCard
        label="Volatility Index"
        value={`${indicators.btcVolatility30d.toFixed(1)}%`}
        level={volLevel}
        description="BTC 30-day realized volatility (annualized). Normal <50%, Elevated 50-80%, Extreme >80%."
      />
      <IndicatorCard
        label="Correlation Score"
        value={
          (indicators.btcEthCorrelation >= 0 ? "+" : "") +
          indicators.btcEthCorrelation.toFixed(3)
        }
        level={corrLevel}
        description="BTC-ETH 30-day rolling correlation. Normal >0.65, Weakening 0.4-0.65, Breakdown <0.4."
      />
      <IndicatorCard
        label="Momentum Score"
        value={formatPct(indicators.momentumScore)}
        level={momentumLevel}
        description="4-asset (BTC/ETH/XRP/LTC) average 7-day return. Positive >+3%, Negative <-3%."
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   C. Regime Timeline
   ═══════════════════════════════════════════════════════════════ */

const REGIME_BAR_COLORS: Record<string, string> = {
  core: "bg-gold",
  crisis: "bg-pnl-negative",
  challenging: "bg-status-warn",
};

const REGIME_HOVER_COLORS: Record<string, string> = {
  core: "bg-gold/80",
  crisis: "bg-pnl-negative/80",
  challenging: "bg-status-warn/80",
};

function RegimeTimeline({ timeline }: { timeline: TimelineDay[] }) {
  const [hovered, setHovered] = useState<TimelineDay | null>(null);

  if (timeline.length === 0) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
        <div className="flex h-16 items-center justify-center text-sm text-text-muted">
          Insufficient timeline data
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4 space-y-3">
      {/* Timeline bar */}
      <div className="flex h-8 w-full gap-px overflow-hidden rounded-sm">
        {timeline.map((day, i) => {
          const barColor =
            hovered === day
              ? (REGIME_HOVER_COLORS[day.regime] ?? "bg-bg-elevated")
              : (REGIME_BAR_COLORS[day.regime] ?? "bg-bg-elevated");
          return (
            <div
              key={i}
              className={cn("flex-1 cursor-pointer transition-colors", barColor)}
              onMouseEnter={() => setHovered(day)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      {/* Hover tooltip */}
      <div className="min-h-[36px]">
        {hovered ? (
          <div className="flex items-center gap-4 text-xs">
            <span className="font-[family-name:var(--font-mono)] text-text-muted">
              {hovered.date}
            </span>
            <span
              className={cn(
                "uppercase tracking-[1px] font-medium text-[11px]",
                hovered.regime === "core"
                  ? "text-gold"
                  : hovered.regime === "crisis"
                    ? "text-pnl-negative"
                    : "text-status-warn"
              )}
            >
              {hovered.regime}
            </span>
            {hovered.dailyReturn !== 0 && (
              <span
                className={cn(
                  "font-[family-name:var(--font-mono)]",
                  hovered.dailyReturn >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                )}
              >
                {formatPct(hovered.dailyReturn)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">
            Hover over a day to see details &mdash; {timeline.length} days
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-[10px] text-text-muted border-t border-border-subtle pt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold" />
          Core
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-status-warn" />
          Challenging
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-pnl-negative" />
          Crisis
        </span>
        <span className="ml-auto font-[family-name:var(--font-mono)]">
          {timeline[0]?.date} — {timeline[timeline.length - 1]?.date}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   D. Regime Performance Stats
   ═══════════════════════════════════════════════════════════════ */

const REGIME_ORDER: RegimeType[] = ["core", "challenging", "crisis"];

function RegimeStatCard({ stat }: { stat: RegimeStat }) {
  const regime = stat.regime as RegimeType;
  const display = getRegimeDisplay(regime);

  return (
    <div
      className={cn(
        "rounded-sm border p-5 space-y-4",
        display.bgColor,
        display.borderColor
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[2px]",
            display.color
          )}
        >
          {display.label}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
          {stat.totalDays}d
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Avg Daily Return</span>
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-sm font-medium",
              stat.avgDailyReturn >= 0 ? "text-pnl-positive" : "text-pnl-negative"
            )}
          >
            {formatPct(stat.avgDailyReturn)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Total Return</span>
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-sm",
              stat.totalReturn >= 0 ? "text-pnl-positive" : "text-pnl-negative"
            )}
          >
            {formatPct(stat.totalReturn)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Days in Regime</span>
          <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
            {stat.totalDays}
          </span>
        </div>
      </div>
    </div>
  );
}

function RegimePerformanceStats({ regimeStats }: { regimeStats: RegimeStat[] }) {
  const sorted = REGIME_ORDER.map(
    (r) => regimeStats.find((s) => s.regime === r) ?? { regime: r, avgDailyReturn: 0, totalDays: 0, totalReturn: 0 }
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {sorted.map((stat) => (
        <RegimeStatCard key={stat.regime} stat={stat} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function RegimePage() {
  const [data, setData] = useState<RegimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/bybit/regime")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json as RegimeData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <Header title="Market Regime" />

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="p-6">
          <div className="rounded-sm border border-pnl-negative/30 bg-pnl-negative/10 px-5 py-4">
            <p className="text-sm text-pnl-negative">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 text-[11px] uppercase tracking-[1px] text-text-secondary hover:text-text-primary transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : data ? (
        <div className="p-6 space-y-8">

          {/* ── A. Current Regime Hero ── */}
          <section>
            <RegimeHero
              regime={data.currentRegime}
              confidence={data.confidence}
              updatedAt={data.updatedAt}
            />
          </section>

          {/* ── B. Regime Indicators ── */}
          <section>
            <SectionLabel>Regime Indicators</SectionLabel>
            <p className="mt-1 text-xs text-text-muted">
              Proxy signals used to classify the current market environment
            </p>
            <div className="mt-3">
              <RegimeIndicators indicators={data.indicators} />
            </div>
          </section>

          {/* ── C. Regime Timeline ── */}
          <section>
            <SectionLabel>90-Day Regime Timeline</SectionLabel>
            <p className="mt-1 text-xs text-text-muted">
              Historical regime classification — each segment represents one trading day
            </p>
            <div className="mt-3">
              <RegimeTimeline timeline={data.timeline} />
            </div>
          </section>

          {/* ── D. Regime Performance Stats ── */}
          <section>
            <SectionLabel>Performance by Regime</SectionLabel>
            <p className="mt-1 text-xs text-text-muted">
              Strategy daily returns segmented by market regime (from available equity snapshots)
            </p>
            <div className="mt-3">
              <RegimePerformanceStats regimeStats={data.regimeStats} />
            </div>
          </section>

        </div>
      ) : null}
    </div>
  );
}
