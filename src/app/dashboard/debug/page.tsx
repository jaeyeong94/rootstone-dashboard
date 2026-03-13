"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import staticCurve from "@/data/cumulative-returns.json";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DebugRow {
  date: string;
  equity: number;
  dailyReturn: number;
  simpleCumulative: number;
  compoundCumulative: number;
}

interface DebugResponse {
  rows: DebugRow[];
  firstEquity: number;
  totalDays: number;
}

type Tab = "rebase" | "live" | "static";

export default function DebugReturnsPage() {
  const [tab, setTab] = useState<Tab>("rebase");
  const { data, isLoading, error } = useSWR<DebugResponse>(
    "/api/debug/returns",
    fetcher
  );

  const staticData = useMemo(
    () => staticCurve as { time: string; value: number }[],
    []
  );

  // Build merged comparison: static vs live vs rebased
  const merged = useMemo(() => {
    if (!data?.rows) return [];

    const staticMap = new Map(staticData.map((p) => [p.time, p.value]));
    const liveMap = new Map(data.rows.map((r) => [r.date, r]));

    const allDates = new Set([
      ...staticData.map((p) => p.time),
      ...data.rows.map((r) => r.date),
    ]);

    const staticEndDate =
      staticData.length > 0 ? staticData[staticData.length - 1].time : "";
    const staticEndValue =
      staticData.length > 0 ? staticData[staticData.length - 1].value : 0;
    const staticEndMultiplier = 1 + staticEndValue / 100;

    const liveAtStaticEnd = data.rows.find((r) => r.date >= staticEndDate);
    const liveBaseline = liveAtStaticEnd?.simpleCumulative ?? 0;
    const liveBaselineMultiplier = 1 + liveBaseline / 100;

    return Array.from(allDates)
      .sort()
      .map((date) => {
        const staticVal = staticMap.get(date) ?? null;
        const live = liveMap.get(date) ?? null;

        let rebased: number | null = null;
        if (staticVal != null) {
          rebased = staticVal;
        } else if (live && date > staticEndDate) {
          rebased =
            (staticEndMultiplier *
              ((1 + live.simpleCumulative / 100) / liveBaselineMultiplier) -
              1) *
            100;
        }

        const delta =
          rebased != null && live
            ? rebased - live.simpleCumulative
            : null;

        return {
          date,
          staticVal,
          equity: live?.equity ?? null,
          dailyReturn: live?.dailyReturn ?? null,
          simpleCumulative: live?.simpleCumulative ?? null,
          compoundCumulative: live?.compoundCumulative ?? null,
          rebased,
          delta,
          isOverlap: staticVal != null && live != null,
          isLiveOnly: staticVal == null && live != null,
          isStaticOnly: staticVal != null && live == null,
        };
      });
  }, [data, staticData]);

  const summary = useMemo(() => {
    if (!data?.rows || merged.length === 0) return null;

    const overlapRows = merged.filter((r) => r.isOverlap);
    const liveOnlyRows = merged.filter((r) => r.isLiveOnly);
    const staticOnlyRows = merged.filter((r) => r.isStaticOnly);
    const lastRebased = merged.filter((r) => r.rebased != null).pop();
    const lastLive = data.rows[data.rows.length - 1];
    const lastStatic = staticData[staticData.length - 1];

    const compoundVsSimple = lastLive
      ? (lastLive as DebugRow).compoundCumulative - lastLive.simpleCumulative
      : 0;

    return {
      totalDates: merged.length,
      staticOnly: staticOnlyRows.length,
      overlap: overlapRows.length,
      liveOnly: liveOnlyRows.length,
      lastStatic: lastStatic
        ? { date: lastStatic.time, value: lastStatic.value }
        : null,
      lastLive: lastLive
        ? {
            date: lastLive.date,
            simple: lastLive.simpleCumulative,
            compound: (lastLive as DebugRow).compoundCumulative,
          }
        : null,
      lastRebased: lastRebased
        ? { date: lastRebased.date, value: lastRebased.rebased }
        : null,
      compoundVsSimple,
      firstEquity: data.firstEquity,
    };
  }, [data, merged, staticData]);

  if (isLoading) {
    return (
      <div className="p-8 text-text-muted">Loading debug data...</div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-pnl-negative">Error: {error.message}</div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary p-6 font-[family-name:var(--font-mono)] text-xs">
      <h1 className="mb-1 text-lg font-medium text-text-primary">
        Returns Calculation Debug
      </h1>
      <p className="mb-6 text-text-muted">
        Daily returns vs compound cumulative returns verification
      </p>

      {/* ── Guide: Summary Cards ── */}
      <InfoBlock title="How to Read the Summary Cards">
        {`Each card shows a key metric at the end of its respective data source.
Use these to quickly check whether the final rebased number is consistent
with the underlying data.

  First Equity    The USD equity value of the very first DB snapshot.
                  All "simple" returns are measured from this anchor.

  Static End      The last cumulative return from the QuantStats tearsheet
                  (static JSON). This is the authoritative historical value.

  Live Simple     (equity_now - first_equity) / first_equity * 100.
                  Measured only within the live DB snapshot window.

  Live Compound   Product of daily returns: ∏(1 + r_i) - 1.
                  Should be very close to Live Simple (difference < 0.01%).
                  A large gap would indicate data quality issues.

  Rebased Final   The number shown on the dashboard. Chains the static
                  tearsheet with live data using compound rebase math.`}
      </InfoBlock>

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <SummaryCard
            label="First Equity"
            value={`$${summary.firstEquity.toLocaleString()}`}
            sub="Anchor for live returns"
          />
          <SummaryCard
            label="Static End"
            value={summary.lastStatic ? `${summary.lastStatic.value.toFixed(2)}%` : "--"}
            sub={summary.lastStatic?.date}
          />
          <SummaryCard
            label="Live Simple"
            value={
              summary.lastLive ? `${summary.lastLive.simple.toFixed(2)}%` : "--"
            }
            sub={summary.lastLive?.date}
          />
          <SummaryCard
            label="Live Compound"
            value={
              summary.lastLive
                ? `${summary.lastLive.compound.toFixed(2)}%`
                : "--"
            }
            sub={`vs simple: ${summary.compoundVsSimple >= 0 ? "+" : ""}${summary.compoundVsSimple.toFixed(4)}%`}
          />
          <SummaryCard
            label="Rebased Final"
            value={
              summary.lastRebased
                ? `${summary.lastRebased.value!.toFixed(2)}%`
                : "--"
            }
            sub={summary.lastRebased?.date}
            highlight
          />
        </div>
      )}

      {/* ── Guide: Data Coverage ── */}
      <InfoBlock title="Data Coverage">
        {`The bar below visualizes how the two data sources overlap in time.

  Bronze (Static only)  Dates that exist only in the tearsheet JSON.
                        These are historical dates before the live DB started.

  Gold (Overlap)        Dates present in BOTH static and live data.
                        Use these rows to compare the two sources directly.
                        Differences here reveal accounting discrepancies
                        between the tearsheet and DB snapshots.

  Green (Live only)     Dates after the static data ends. These are
                        extended using the compound rebase formula.
                        The "Rebased %" column shows the final chained value.`}
      </InfoBlock>

      {/* Data overlap visualization */}
      {summary && (
        <div className="mb-6 rounded-sm border border-border-subtle bg-bg-card p-4">
          <p className="mb-2 text-[10px] uppercase tracking-[1px] text-text-muted">
            Data Coverage
          </p>
          <div className="flex h-6 overflow-hidden rounded-sm">
            <div
              className="bg-bronze/40"
              style={{
                width: `${(summary.staticOnly / summary.totalDates) * 100}%`,
              }}
              title={`Static only: ${summary.staticOnly} days`}
            />
            <div
              className="bg-gold/60"
              style={{
                width: `${(summary.overlap / summary.totalDates) * 100}%`,
              }}
              title={`Overlap: ${summary.overlap} days`}
            />
            <div
              className="bg-green-500/40"
              style={{
                width: `${(summary.liveOnly / summary.totalDates) * 100}%`,
              }}
              title={`Live only: ${summary.liveOnly} days`}
            />
          </div>
          <div className="mt-2 flex gap-4 text-[10px] text-text-muted">
            <span>
              <span className="mr-1 inline-block h-2 w-2 bg-bronze/40" />
              Static only: {summary.staticOnly}
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 bg-gold/60" />
              Overlap: {summary.overlap}
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 bg-green-500/40" />
              Live only: {summary.liveOnly}
            </span>
          </div>
        </div>
      )}

      {/* ── Guide: Formula ── */}
      <InfoBlock title="Compound Rebase Formula Explained">
        {`The dashboard chains two independent data sources into one continuous
cumulative return curve. The formula below ensures correct compounding
at the junction point.

  PROBLEM:  Static tearsheet ends at 872.17% (Feb 16).
            Live DB starts at 0% (Nov 15, 2024).
            We need to seamlessly continue from 872.17% using live data.

  WRONG:    Simply adding the live delta (e.g., 872.17 + 3.16 = 875.33%)
            treats live returns as if applied to the original capital.

  CORRECT:  Compute the actual growth RATIO in the live window,
            then multiply it by the static end multiplier.

  Step-by-step:
    1. S_mul = 1 + 872.17/100 = 9.7217  (static end multiplier)
    2. L_mul = 1 + 62.01/100  = 1.6201  (live baseline multiplier)
    3. C_mul = 1 + 65.17/100  = 1.6517  (live current multiplier)
    4. Growth ratio = C_mul / L_mul = 1.0195 (+1.95% real growth)
    5. Rebased = S_mul * Growth - 1 = 9.7217 * 1.0195 - 1 = 8.911
    6. As percent: 891.10%

  WHY RATIO?
    The live API returns (equity - first) / first * 100.
    This is a simple return from the first snapshot, NOT a daily return.
    To extract the true growth between two dates, you must divide their
    multipliers: (1 + end%) / (1 + start%), not subtract percentages.`}
      </InfoBlock>

      {/* Formula Card */}
      <div className="mb-6 rounded-sm border border-border-subtle bg-bg-card p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[1px] text-text-muted">
          Compound Rebase Formula
        </p>
        <pre className="text-text-secondary">
{`R_t = S_mul x (C_mul / L_mul) - 1

S_mul = 1 + staticEnd/100     (static end multiplier)
L_mul = 1 + liveBaseline/100  (live baseline multiplier at static end date)
C_mul = 1 + liveCurrent/100   (live current multiplier)

Simple:   (equity - first) / first x 100
Compound: product of (1 + r_i) - 1  (chained daily returns)`}
        </pre>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border-subtle">
        {(
          [
            { key: "rebase", label: "Rebase Comparison" },
            { key: "live", label: "Live Daily Returns" },
            { key: "static", label: "Static Data" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-[11px] uppercase tracking-[1px] transition-colors",
              tab === t.key
                ? "border-b-2 border-gold text-gold"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab-specific guides */}
      {tab === "rebase" && (
        <InfoBlock title="How to Read the Rebase Comparison Table">
          {`This table merges static tearsheet data with live DB snapshots
and shows the rebased (chained) cumulative return for each date.

COLUMNS:
  Date              Calendar date (YYYY-MM-DD).
  Equity            Account equity from the DB snapshot for that day.
                    Shown as "-" for dates with static data only.
  Daily %           Day-over-day return: (equity_t / equity_{t-1} - 1) * 100.
  Static %          Cumulative return from the QuantStats tearsheet.
                    This is the "ground truth" for the historical period.
  Live Simple %     (equity - firstEquity) / firstEquity * 100.
                    Simple return from the first DB snapshot.
  Live Compound %   Product of all daily returns since the first snapshot.
                    Should be nearly identical to Live Simple.
  Rebased %         THE FINAL CHAINED VALUE shown on the dashboard.
                    = Static % for dates in the tearsheet range.
                    = Compound rebase formula for dates after static ends.
  Delta             Rebased % minus Live Simple %. Expected to be large
                    (~800+) because it includes the full v1+v3.1 history.

ROW COLORS:
  Gold background   Overlap period: both static and live data exist.
                    Compare Static % vs Live Simple % to gauge discrepancy.
  Green background  Live-only period: static data has ended.
                    Rebased % is computed via the compound rebase formula.

VERIFICATION CHECKLIST:
  1. In overlap rows, Static % and Live Simple % will NOT match exactly
     because they use different baselines (tearsheet vs DB first snapshot).
  2. Live Compound % and Live Simple % should differ by < 0.01%.
     A larger gap means daily snapshot data may have quality issues.
  3. The last Rebased % should match the dashboard hero number.
  4. Delta should grow slowly over time (not jump erratically).`}
        </InfoBlock>
      )}

      {tab === "live" && (
        <InfoBlock title="How to Read the Live Daily Returns Table">
          {`This table shows raw daily returns computed from DB equity snapshots.

COLUMNS:
  Date              Calendar date.
  Equity ($)        Last equity snapshot for the day.
  Daily Return %    (equity_today / equity_yesterday - 1) * 100.
                    Positive = gold, Negative = red.
  Simple Cum. %     (equity - first_equity) / first_equity * 100.
                    This is what the equity-curve API returns directly.
  Compound Cum. %   Product of (1 + daily_return) for all days.
                    Mathematically equivalent to Simple if no rounding.
  Compound - Simple The difference between the two cumulative methods.
                    Should be very close to 0 (< 0.01%).
                    A non-zero value arises from floating-point rounding.

VERIFICATION:
  - If Compound - Simple grows over time, it indicates rounding drift.
  - If Daily Return shows 0.0000% for consecutive days, it means
    the equity didn't change (e.g., weekends or no trading activity).
  - The last Simple Cum. % should match the "Live Simple" summary card.`}
        </InfoBlock>
      )}

      {tab === "static" && (
        <InfoBlock title="How to Read the Static Data Table">
          {`This table shows the QuantStats tearsheet cumulative returns,
extracted from the strategy backtest/live HTML report.

COLUMNS:
  #                 Row index (1-based).
  Date              Calendar date from the tearsheet.
  Cumulative %      The cumulative return since inception (Mar 2021).
                    This is already correctly compounded in the tearsheet.
  Daily Change %    Derived from cumulative: (M_today / M_yesterday - 1) * 100
                    where M = 1 + cumulative/100 (the multiplier).

KEY PROPERTIES:
  - This data spans v1 (2021-03 to 2024-11) and v3.1 (2024-11 to 2026-02).
  - The transition from v1 to v3.1 happens around 2024-11-17.
  - The last value (872.17%) is the static anchor for the rebase formula.
  - Negative Daily Change % is normal during drawdown periods.

VERIFICATION:
  - You can verify compounding: if Day N = 100% and Day N+1 = 102%,
    then daily return = (1+1.02)/(1+1.00) - 1 = 0.99%, NOT 2%.
  - The first row should start at 0% (inception).
  - The last row date should match the "Static End" summary card.`}
        </InfoBlock>
      )}

      {/* Tables */}
      {tab === "rebase" && <RebaseTable rows={merged} />}
      {tab === "live" && <LiveTable rows={data?.rows ?? []} />}
      {tab === "static" && <StaticTable rows={staticData} />}
    </div>
  );
}

/* ── Reusable Components ── */

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded-sm border border-bronze/20 bg-bronze/[0.03]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[11px] font-medium uppercase tracking-[1px] text-bronze">
          {open ? "[-]" : "[+]"} {title}
        </span>
      </button>
      {open && (
        <pre className="whitespace-pre-wrap border-t border-bronze/10 px-4 py-3 text-[11px] leading-relaxed text-text-secondary">
          {children}
        </pre>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border p-3",
        highlight
          ? "border-gold/30 bg-gold/5"
          : "border-border-subtle bg-bg-card"
      )}
    >
      <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base font-medium",
          highlight ? "text-gold" : "text-text-primary"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-text-dim">{sub}</p>}
    </div>
  );
}

/* ── Table Components ── */

function RebaseTable({
  rows,
}: {
  rows: {
    date: string;
    staticVal: number | null;
    equity: number | null;
    dailyReturn: number | null;
    simpleCumulative: number | null;
    compoundCumulative: number | null;
    rebased: number | null;
    delta: number | null;
    isOverlap: boolean;
    isLiveOnly: boolean;
    isStaticOnly: boolean;
  }[];
}) {
  const [showAll, setShowAll] = useState(false);
  const filtered = showAll
    ? rows
    : rows.filter((r) => r.isOverlap || r.isLiveOnly);

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="accent-gold"
          />
          Include static-only rows ({rows.filter((r) => r.isStaticOnly).length})
        </label>
        <span className="text-[10px] text-text-dim">
          Showing {filtered.length} / {rows.length} rows
        </span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-sm border border-border-subtle">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-bg-elevated">
            <tr className="text-left text-[10px] uppercase tracking-[1px] text-text-muted">
              <th className="border-b border-border-subtle px-3 py-2">Date</th>
              <th className="border-b border-border-subtle px-3 py-2 text-right">
                Equity
              </th>
              <th className="border-b border-border-subtle px-3 py-2 text-right">
                Daily %
              </th>
              <th className="border-b border-border-subtle px-3 py-2 text-right">
                Static %
              </th>
              <th className="border-b border-border-subtle px-3 py-2 text-right">
                Live Simple %
              </th>
              <th className="border-b border-border-subtle px-3 py-2 text-right">
                Live Compound %
              </th>
              <th className="border-b border-border-subtle px-3 py-2 text-right text-pnl-positive">
                Rebased %
              </th>
              <th className="border-b border-border-subtle px-3 py-2 text-right">
                Delta
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.date}
                className={cn(
                  "border-b border-border-subtle/50 hover:bg-white/[0.02]",
                  row.isOverlap && "bg-gold/[0.03]",
                  row.isLiveOnly && "bg-green-500/[0.03]"
                )}
              >
                <td className="px-3 py-1.5 text-text-secondary">{row.date}</td>
                <td className="px-3 py-1.5 text-right text-text-muted">
                  {row.equity != null ? `$${row.equity.toLocaleString()}` : "-"}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right",
                    row.dailyReturn != null && row.dailyReturn > 0
                      ? "text-pnl-positive"
                      : row.dailyReturn != null && row.dailyReturn < 0
                        ? "text-pnl-negative"
                        : "text-text-muted"
                  )}
                >
                  {row.dailyReturn != null
                    ? `${row.dailyReturn >= 0 ? "+" : ""}${row.dailyReturn.toFixed(4)}%`
                    : "-"}
                </td>
                <td className="px-3 py-1.5 text-right text-bronze">
                  {row.staticVal != null ? `${row.staticVal.toFixed(2)}%` : "-"}
                </td>
                <td className="px-3 py-1.5 text-right text-text-muted">
                  {row.simpleCumulative != null
                    ? `${row.simpleCumulative.toFixed(2)}%`
                    : "-"}
                </td>
                <td className="px-3 py-1.5 text-right text-text-secondary">
                  {row.compoundCumulative != null
                    ? `${row.compoundCumulative.toFixed(2)}%`
                    : "-"}
                </td>
                <td className="px-3 py-1.5 text-right font-medium text-pnl-positive">
                  {row.rebased != null ? `${row.rebased.toFixed(2)}%` : "-"}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right",
                    row.delta != null && Math.abs(row.delta) > 1
                      ? "text-pnl-negative"
                      : "text-text-dim"
                  )}
                >
                  {row.delta != null
                    ? `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiveTable({ rows }: { rows: DebugRow[] }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-sm border border-border-subtle">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-bg-elevated">
          <tr className="text-left text-[10px] uppercase tracking-[1px] text-text-muted">
            <th className="border-b border-border-subtle px-3 py-2">Date</th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Equity ($)
            </th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Daily Return %
            </th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Simple Cumulative %
            </th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Compound Cumulative %
            </th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Compound - Simple
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const diff = row.compoundCumulative - row.simpleCumulative;
            return (
              <tr
                key={row.date}
                className="border-b border-border-subtle/50 hover:bg-white/[0.02]"
              >
                <td className="px-3 py-1.5 text-text-secondary">{row.date}</td>
                <td className="px-3 py-1.5 text-right text-text-muted">
                  ${row.equity.toLocaleString()}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right",
                    row.dailyReturn > 0
                      ? "text-pnl-positive"
                      : row.dailyReturn < 0
                        ? "text-pnl-negative"
                        : "text-text-muted"
                  )}
                >
                  {row.dailyReturn >= 0 ? "+" : ""}
                  {row.dailyReturn.toFixed(4)}%
                </td>
                <td className="px-3 py-1.5 text-right text-text-muted">
                  {row.simpleCumulative.toFixed(4)}%
                </td>
                <td className="px-3 py-1.5 text-right text-text-secondary">
                  {row.compoundCumulative.toFixed(4)}%
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right",
                    Math.abs(diff) > 0.01 ? "text-yellow-400" : "text-text-dim"
                  )}
                >
                  {diff >= 0 ? "+" : ""}
                  {diff.toFixed(4)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StaticTable({ rows }: { rows: { time: string; value: number }[] }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-sm border border-border-subtle">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-bg-elevated">
          <tr className="text-left text-[10px] uppercase tracking-[1px] text-text-muted">
            <th className="border-b border-border-subtle px-3 py-2">#</th>
            <th className="border-b border-border-subtle px-3 py-2">Date</th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Cumulative %
            </th>
            <th className="border-b border-border-subtle px-3 py-2 text-right">
              Daily Change %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prevVal = i > 0 ? rows[i - 1].value : 0;
            const prevMul = 1 + prevVal / 100;
            const curMul = 1 + row.value / 100;
            const daily = i > 0 ? (curMul / prevMul - 1) * 100 : 0;
            return (
              <tr
                key={row.time}
                className="border-b border-border-subtle/50 hover:bg-white/[0.02]"
              >
                <td className="px-3 py-1.5 text-text-dim">{i + 1}</td>
                <td className="px-3 py-1.5 text-text-secondary">{row.time}</td>
                <td className="px-3 py-1.5 text-right text-bronze">
                  {row.value.toFixed(2)}%
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right",
                    daily > 0
                      ? "text-pnl-positive"
                      : daily < 0
                        ? "text-pnl-negative"
                        : "text-text-muted"
                  )}
                >
                  {daily >= 0 ? "+" : ""}
                  {daily.toFixed(4)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
