"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { cn, formatNumber, formatPnlPercent, getPnlColor } from "@/lib/utils";
import type { CalendarMonthlyResponse, CalendarDay } from "@/app/api/calendar/monthly/route";
import type { DayDetailResponse } from "@/app/api/calendar/day-detail/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

function formatDayReturn(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatTotalReturn(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

/**
 * Returns the day-of-week (0=Mon … 6=Sun) for the 1st of a given month.
 * Uses ISO standard: Monday = 0.
 */
function getMonthStartDayISO(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0=Sun…6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0
}

function getCellColor(dailyReturn: number): string {
  if (dailyReturn >= 3) return "bg-pnl-positive/40";
  if (dailyReturn >= 1) return "bg-pnl-positive/20";
  if (dailyReturn > 0) return "bg-pnl-positive/10";
  if (dailyReturn === 0) return "bg-bg-elevated";
  if (dailyReturn > -1) return "bg-pnl-negative/10";
  if (dailyReturn > -3) return "bg-pnl-negative/20";
  return "bg-pnl-negative/40";
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card px-4 py-3">
      <div className="mb-1">
        <SectionLabel>{label}</SectionLabel>
      </div>
      <div
        className={cn(
          "font-[family-name:var(--font-mono)] text-lg font-medium",
          valueClass ?? "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded bg-bg-elevated" />
      ))}
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarGridProps {
  year: number;
  month: number;
  days: CalendarDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

function CalendarGrid({ year, month, days, selectedDate, onSelectDate }: CalendarGridProps) {
  const today = getTodayString();
  const startDayOffset = getMonthStartDayISO(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build grid cells: leading blanks + day cells
  const cells: Array<{ blank: true } | { date: string; day: number; data: CalendarDay | null }> = [];

  for (let i = 0; i < startDayOffset; i++) {
    cells.push({ blank: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const data = days.find((x) => x.date === date) ?? null;
    cells.push({ date, day: d, data });
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="py-2 text-center text-[11px] font-medium uppercase tracking-[2px] text-text-muted"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if ("blank" in cell) {
            return (
              <div
                key={`blank-${idx}`}
                className="aspect-square border-b border-r border-border-subtle bg-bg-primary"
              />
            );
          }

          const { date, day, data } = cell;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const dailyReturn = data?.dailyReturn ?? 0;
          const hasData = data !== null && (data.tradeCount > 0 || data.dailyReturn !== 0);

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={cn(
                "relative flex aspect-square flex-col items-start justify-start p-2",
                "border-b border-r border-border-subtle",
                "transition-all duration-150",
                hasData ? getCellColor(dailyReturn) : "bg-bg-primary",
                isSelected && "ring-1 ring-inset ring-bronze",
                isToday && !isSelected && "ring-1 ring-inset ring-bronze/40",
                hasData && "cursor-pointer hover:opacity-80",
                !hasData && "cursor-default"
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "text-xs font-medium",
                  isToday ? "text-bronze" : "text-text-secondary"
                )}
              >
                {day}
              </span>

              {/* Daily return */}
              {hasData && (
                <span
                  className={cn(
                    "mt-auto font-[family-name:var(--font-mono)] text-[10px] leading-none",
                    getPnlColor(dailyReturn)
                  )}
                >
                  {formatDayReturn(dailyReturn)}
                </span>
              )}

              {/* Trade count badge */}
              {data && data.tradeCount > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-bronze/20 px-1 py-0.5 text-[9px] font-medium text-bronze">
                  {data.tradeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

interface DayDetailPanelProps {
  date: string;
  data: DayDetailResponse | null;
  isLoading: boolean;
  error: string | null;
  dailyReturn?: number;
}

function DayDetailPanel({ date, data, isLoading, error, dailyReturn }: DayDetailPanelProps) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <SectionLabel>{formatDate(date)}</SectionLabel>
        {data && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">
              {data.tradeCount} trade{data.tradeCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-text-muted">
              {data.winCount}W / {data.lossCount}L
            </span>
            <span
              className={cn(
                "font-[family-name:var(--font-mono)] text-sm font-medium",
                getPnlColor(data.totalPnl)
              )}
            >
              {dailyReturn !== undefined
                ? formatPnlPercent(dailyReturn / 100)
                : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="flex h-32 items-center justify-center text-sm text-pnl-negative">
          {error}
        </div>
      ) : !data || data.trades.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-text-muted">
          No trades on this day
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-2 border-b border-border-subtle px-4 py-2 text-[11px] uppercase tracking-[1px] text-text-secondary">
            <span>Time</span>
            <span>Symbol</span>
            <span>Side</span>
            <span className="text-right">Entry</span>
            <span className="text-right">Exit</span>
            <span className="text-right">Qty</span>
            <span className="text-right">PnL</span>
          </div>

          {/* Table rows */}
          {data.trades.map((trade, idx) => (
            <div
              key={idx}
              className="grid grid-cols-7 gap-2 border-b border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-bg-elevated last:border-0"
            >
              <span className="text-xs text-text-muted">
                {formatTime(trade.closedAt)}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-text-primary">
                {trade.symbol}
              </span>
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[1px]",
                  trade.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
                )}
              >
                {trade.side}
              </span>
              <span className="text-right font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                {formatNumber(trade.entryPrice)}
              </span>
              <span className="text-right font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                {formatNumber(trade.exitPrice)}
              </span>
              <span className="text-right font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                {formatNumber(trade.qty, 4)}
              </span>
              <span
                className={cn(
                  "text-right font-[family-name:var(--font-mono)] text-xs",
                  getPnlColor(trade.closedPnl)
                )}
              >
                {formatPnlPercent(trade.closedPnlPct / 100)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

interface MonthlySummaryProps {
  summary: CalendarMonthlyResponse["summary"];
}

function MonthlySummary({ summary }: MonthlySummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Total Return"
        value={formatTotalReturn(summary.totalReturn)}
        valueClass={getPnlColor(summary.totalReturn)}
      />
      <StatCard
        label="Trading Days"
        value={summary.tradingDays}
      />
      <StatCard
        label="Win Rate"
        value={`${summary.winRate.toFixed(1)}%`}
        valueClass={summary.winRate >= 50 ? "text-pnl-positive" : "text-pnl-negative"}
      />
      <StatCard
        label="Best Day"
        value={
          summary.bestDay.date ? (
            <span className="text-pnl-positive">
              {formatTotalReturn(summary.bestDay.return)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )
        }
      />
      <StatCard
        label="Worst Day"
        value={
          summary.worstDay.date ? (
            <span className="text-pnl-negative">
              {formatTotalReturn(summary.worstDay.return)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )
        }
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Monthly data state
  const [monthlyData, setMonthlyData] = useState<CalendarMonthlyResponse | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string>("");

  // Day detail state
  const [dayDetail, setDayDetail] = useState<DayDetailResponse | null>(null);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);
  const [dayDetailError, setDayDetailError] = useState<string | null>(null);
  const [loadedDayDate, setLoadedDayDate] = useState<string | null>(null);

  const fetchMonthly = useCallback(async (y: number, m: number) => {
    const key = `${y}-${m}`;
    if (loadedKey === key && monthlyData) return;

    setMonthlyLoading(true);
    setMonthlyError(null);
    setMonthlyData(null);
    setSelectedDate(null);
    setDayDetail(null);

    try {
      const res = await fetch(`/api/calendar/monthly?year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setMonthlyError(data.error ?? "Failed to load calendar data");
      } else {
        setMonthlyData(data);
        setLoadedKey(key);
      }
    } catch {
      setMonthlyError("Network error");
    } finally {
      setMonthlyLoading(false);
    }
  }, [loadedKey, monthlyData]);

  // Fetch on mount and when month changes
  const currentKey = `${year}-${month}`;
  if (loadedKey !== currentKey && !monthlyLoading) {
    fetchMonthly(year, month);
  }

  const fetchDayDetail = useCallback(async (date: string) => {
    if (loadedDayDate === date && dayDetail) return;

    setDayDetailLoading(true);
    setDayDetailError(null);
    setDayDetail(null);

    try {
      const res = await fetch(`/api/calendar/day-detail?date=${date}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setDayDetailError(data.error ?? "Failed to load day detail");
      } else {
        setDayDetail(data);
        setLoadedDayDate(date);
      }
    } catch {
      setDayDetailError("Network error");
    } finally {
      setDayDetailLoading(false);
    }
  }, [loadedDayDate, dayDetail]);

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      fetchDayDetail(date);
    },
    [fetchDayDetail]
  );

  const goPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDate(null);
    setDayDetail(null);
    setLoadedDayDate(null);
  };

  const goNext = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDate(null);
    setDayDetail(null);
    setLoadedDayDate(null);
  };

  return (
    <div>
      <Header title="Calendar" />

      <div className="space-y-4 p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <SectionLabel>Trading Calendar</SectionLabel>
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-subtle text-text-secondary transition-colors hover:border-bronze hover:text-bronze"
            >
              ←
            </button>
            <span className="min-w-[140px] text-center font-[family-name:var(--font-heading)] text-sm font-light text-text-primary">
              {formatMonthLabel(year, month)}
            </span>
            <button
              onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-subtle text-text-secondary transition-colors hover:border-bronze hover:text-bronze"
            >
              →
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        {monthlyLoading ? (
          <div className="rounded-sm border border-border-subtle bg-bg-card">
            <LoadingSkeleton />
          </div>
        ) : monthlyError ? (
          <div className="flex h-64 items-center justify-center rounded-sm border border-border-subtle bg-bg-card text-sm text-pnl-negative">
            {monthlyError}
          </div>
        ) : monthlyData ? (
          <CalendarGrid
            year={year}
            month={month}
            days={monthlyData.days}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        ) : null}

        {/* Day detail panel */}
        {selectedDate && (
          <DayDetailPanel
            date={selectedDate}
            data={dayDetail}
            isLoading={dayDetailLoading}
            error={dayDetailError}
            dailyReturn={monthlyData?.days.find((d) => d.date === selectedDate)?.dailyReturn}
          />
        )}

        {/* Monthly summary */}
        {monthlyData && !monthlyLoading && (
          <div className="space-y-2">
            <SectionLabel>Monthly Summary</SectionLabel>
            <MonthlySummary summary={monthlyData.summary} />
          </div>
        )}
      </div>
    </div>
  );
}
