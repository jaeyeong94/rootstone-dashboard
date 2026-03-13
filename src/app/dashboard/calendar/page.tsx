"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { cn, formatPnlPercent } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: string;
  dailyReturn: number;
  tradeCount: number;
  positionsOpened: number;
  positionsClosed: number;
  topTrade: { symbol: string; pnlPercent: number } | null;
}

interface MonthlySummary {
  totalReturn: number;
  tradingDays: number;
  winRate: number;
  bestDay: { date: string; return: number } | null;
  worstDay: { date: string; return: number } | null;
}

interface MonthlyData {
  year: number;
  month: number;
  days: CalendarDay[];
  summary: MonthlySummary;
}

interface DayTrade {
  symbol: string;
  side: "Buy" | "Sell";
  entryPrice: number;
  exitPrice: number;
  closedPnlPct: number;
  closedAt: string;
}

interface DayDetail {
  date: string;
  dailyReturn: number;
  trades: DayTrade[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getDayCellBg(ret: number): string {
  if (ret >= 3) return "bg-pnl-positive/30";
  if (ret >= 1) return "bg-pnl-positive/15";
  if (ret > 0) return "bg-pnl-positive/5";
  if (ret === 0) return "bg-bg-elevated";
  if (ret > -1) return "bg-pnl-negative/5";
  if (ret > -3) return "bg-pnl-negative/15";
  return "bg-pnl-negative/30";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

function ReturnBadge({ value, className }: { value: number; className?: string }) {
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-mono)] text-[11px]",
        isPos && "text-pnl-positive",
        isNeg && "text-pnl-negative",
        !isPos && !isNeg && "text-text-secondary",
        className
      )}
    >
      {value > 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

function DayDetailPanel({
  detail,
  loading,
  onClose,
}: {
  detail: DayDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!detail && !loading) return null;

  return (
    <div className="mt-1 rounded-sm border border-border-subtle bg-bg-card p-4 animate-in slide-in-from-top-2 duration-200">
      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <span className="text-[11px] uppercase tracking-[2px] text-text-secondary animate-pulse">
            Loading...
          </span>
        </div>
      ) : detail ? (
        <div className="space-y-4">
          {/* Panel header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SectionLabel>{detail.date}</SectionLabel>
              <ReturnBadge value={detail.dailyReturn} />
            </div>
            <button
              onClick={onClose}
              className="text-[11px] uppercase tracking-[2px] text-text-secondary hover:text-text-primary transition-colors"
            >
              Close
            </button>
          </div>

          {/* Trade list */}
          {detail.trades.length === 0 ? (
            <p className="text-[12px] text-text-secondary">No closed trades this day.</p>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_60px_80px_80px_80px] gap-2 pb-1 border-b border-border-subtle">
                {["SYMBOL", "SIDE", "ENTRY", "EXIT", "PNL %"].map((h) => (
                  <span key={h} className="text-[10px] uppercase tracking-[2px] text-text-secondary">
                    {h}
                  </span>
                ))}
              </div>

              {detail.trades.map((trade, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_60px_80px_80px_80px] gap-2 py-1.5 border-b border-border-subtle/50 last:border-0"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[12px] text-text-primary">
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
                  <span className="font-[family-name:var(--font-mono)] text-[12px] text-text-secondary">
                    {trade.entryPrice.toFixed(2)}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[12px] text-text-secondary">
                    {trade.exitPrice.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-mono)] text-[12px]",
                      trade.closedPnlPct > 0 && "text-pnl-positive",
                      trade.closedPnlPct < 0 && "text-pnl-negative",
                      trade.closedPnlPct === 0 && "text-text-secondary"
                    )}
                  >
                    {formatPnlPercent(trade.closedPnlPct / 100)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Monthly Summary Strip ────────────────────────────────────────────────────

function SummaryStrip({ summary }: { summary: MonthlySummary | null }) {
  if (!summary) return null;

  const items = [
    {
      label: "TOTAL RETURN",
      value: (
        <ReturnBadge value={summary.totalReturn} className="text-[14px]" />
      ),
    },
    {
      label: "TRADING DAYS",
      value: (
        <span className="font-[family-name:var(--font-mono)] text-[14px] text-text-primary">
          {summary.tradingDays}
        </span>
      ),
    },
    {
      label: "WIN RATE",
      value: (
        <span className="font-[family-name:var(--font-mono)] text-[14px] text-gold">
          {summary.winRate.toFixed(1)}%
        </span>
      ),
    },
    {
      label: "BEST DAY",
      value: summary.bestDay ? (
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-secondary font-[family-name:var(--font-mono)]">
            {formatDate(summary.bestDay.date)}
          </span>
          <ReturnBadge value={summary.bestDay.return} />
        </span>
      ) : (
        <span className="text-text-secondary text-[12px]">—</span>
      ),
    },
    {
      label: "WORST DAY",
      value: summary.worstDay ? (
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-secondary font-[family-name:var(--font-mono)]">
            {formatDate(summary.worstDay.date)}
          </span>
          <ReturnBadge value={summary.worstDay.return} />
        </span>
      ) : (
        <span className="text-text-secondary text-[12px]">—</span>
      ),
    },
  ];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card px-4 py-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <SectionLabel>{item.label}</SectionLabel>
            <div className="mt-0.5">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  days,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  days: CalendarDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const dayMap = new Map(days.map((d) => [d.date, d]));

  // First day of month weekday (0=Sun)
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build grid cells: leading blanks + actual days
  const cells: Array<{ type: "blank" } | { type: "day"; date: string; day: number; data: CalendarDay | null }> = [];

  for (let i = 0; i < firstDow; i++) {
    cells.push({ type: "blank" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    cells.push({ type: "day", date: dateStr, day: d, data: dayMap.get(dateStr) ?? null });
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {DAY_LABELS.map((lbl) => (
          <div key={lbl} className="py-2 text-center">
            <span className="text-[10px] uppercase tracking-[2px] text-text-secondary">
              {lbl}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (cell.type === "blank") {
            return (
              <div
                key={`blank-${idx}`}
                className="min-h-[80px] border-b border-r border-border-subtle/40 bg-bg-primary/30"
              />
            );
          }

          const { date, day, data } = cell;
          const isSelected = date === selectedDate;
          const isToday = date === new Date().toISOString().split("T")[0];
          const bgClass = data ? getDayCellBg(data.dailyReturn) : "bg-bg-elevated/20";

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={cn(
                "min-h-[80px] w-full border-b border-r border-border-subtle/40 p-2 text-left transition-all duration-150",
                "hover:border-bronze/40 hover:bg-bg-elevated",
                bgClass,
                isSelected && "ring-1 ring-inset ring-bronze",
                !data && "opacity-40 cursor-default"
              )}
              disabled={!data}
            >
              {/* Date number */}
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] text-[12px] leading-none",
                    isToday ? "text-gold font-semibold" : "text-text-secondary"
                  )}
                >
                  {day}
                </span>
                {data && data.tradeCount > 0 && (
                  <span className="rounded-full bg-bronze/20 px-1 py-0.5 text-[9px] font-medium text-bronze leading-none">
                    {data.tradeCount}
                  </span>
                )}
              </div>

              {/* Daily return */}
              {data && (
                <div className="mt-2 space-y-0.5">
                  <ReturnBadge value={data.dailyReturn} className="text-[12px] block" />
                  {data.topTrade && (
                    <span className="block truncate text-[10px] text-text-secondary">
                      {data.topTrade.symbol}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Fetch monthly data ──
  const fetchMonthly = useCallback(async (y: number, m: number) => {
    setLoadingMonthly(true);
    setMonthlyError(null);
    try {
      const res = await fetch(`/api/calendar/monthly?year=${y}&month=${m}`);
      if (!res.ok) throw new Error("Failed to load");
      const data: MonthlyData = await res.json();
      setMonthlyData(data);
    } catch {
      setMonthlyError("Failed to load data.");
    } finally {
      setLoadingMonthly(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthly(year, month);
    setSelectedDate(null);
    setDayDetail(null);
  }, [year, month, fetchMonthly]);

  // ── Fetch day detail ──
  const handleSelectDate = useCallback(async (date: string) => {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDayDetail(null);
      return;
    }
    setSelectedDate(date);
    setDayDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/calendar/day-detail?date=${date}`);
      if (!res.ok) throw new Error("Failed to load");
      const data: DayDetail = await res.json();
      setDayDetail(data);
    } catch {
      setDayDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedDate]);

  // ── Month navigation ──
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header title="Trading Calendar" />

      <div className="mx-auto max-w-5xl space-y-4 px-6 py-8">

        {/* ── Month Navigation ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center border border-border-subtle text-text-secondary hover:border-bronze hover:text-text-primary transition-colors"
              aria-label="Previous month"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-0.5">
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-light tracking-[2px] text-text-primary uppercase">
                {MONTH_NAMES[month - 1]}
              </h2>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                {year}
              </span>
            </div>

            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center border border-border-subtle text-text-secondary hover:border-bronze hover:text-text-primary transition-colors"
              aria-label="Next month"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="border border-border-subtle px-3 py-1.5 text-[11px] uppercase tracking-[1px] text-text-secondary hover:border-bronze hover:text-text-primary transition-colors"
            >
              Today
            </button>
          )}
        </div>

        {/* ── Loading / Error State ── */}
        {loadingMonthly && (
          <div className="flex h-64 items-center justify-center rounded-sm border border-border-subtle bg-bg-card">
            <span className="text-[11px] uppercase tracking-[2px] text-text-secondary animate-pulse">
              Loading...
            </span>
          </div>
        )}

        {monthlyError && !loadingMonthly && (
          <div className="flex h-32 items-center justify-center rounded-sm border border-border-subtle bg-bg-card">
            <span className="text-[12px] text-pnl-negative">{monthlyError}</span>
          </div>
        )}

        {/* ── Calendar Grid ── */}
        {!loadingMonthly && !monthlyError && (
          <>
            <CalendarGrid
              year={year}
              month={month}
              days={monthlyData?.days ?? []}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />

            {/* ── Day Detail Panel ── */}
            {(selectedDate || loadingDetail) && (
              <DayDetailPanel
                detail={dayDetail}
                loading={loadingDetail}
                onClose={() => {
                  setSelectedDate(null);
                  setDayDetail(null);
                }}
              />
            )}

            {/* ── Monthly Summary Strip ── */}
            <SummaryStrip summary={monthlyData?.summary ?? null} />
          </>
        )}

      </div>
    </div>
  );
}
