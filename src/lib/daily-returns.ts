import { db as getDb } from "@/lib/db";
import { dailyReturns } from "@/lib/db/schema";
import { asc, gte, lte, and, desc } from "drizzle-orm";

export interface DailyReturnRow {
  date: string;
  navIndex: number;
  dailyReturn: number;
}

/**
 * Get daily returns for a date range.
 */
export async function getDailyReturns(opts?: {
  from?: string;
  to?: string;
}): Promise<DailyReturnRow[]> {
  const database = getDb();
  const conditions = [];

  if (opts?.from) conditions.push(gte(dailyReturns.date, opts.from));
  if (opts?.to) conditions.push(lte(dailyReturns.date, opts.to));

  const rows = await database
    .select({
      date: dailyReturns.date,
      navIndex: dailyReturns.navIndex,
      dailyReturn: dailyReturns.dailyReturn,
    })
    .from(dailyReturns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(dailyReturns.date));

  return rows;
}

/** v3.1 전략 시작일 */
const V31_START = "2024-11-17";

/**
 * Get daily returns since v3.1 strategy start.
 */
export async function getDailyReturnsSinceV31(): Promise<DailyReturnRow[]> {
  return getDailyReturns({ from: V31_START });
}

/**
 * Get cumulative return curve (rebased to period start = 0%).
 */
export async function getCumulativeCurve(opts?: {
  from?: string;
  to?: string;
}): Promise<{ date: string; value: number }[]> {
  const rows = await getDailyReturns(opts);
  if (rows.length === 0) return [];

  const baseNav = rows[0].navIndex;
  return rows.map((r) => ({
    date: r.date,
    value: ((r.navIndex / baseNav) - 1) * 100,
  }));
}

/**
 * Get monthly returns aggregated from daily returns.
 */
export async function getMonthlyReturns(opts?: {
  from?: string;
  to?: string;
}): Promise<{ year: number; month: number; returnPct: number }[]> {
  const rows = await getDailyReturns(opts);
  if (rows.length === 0) return [];

  const byMonth = new Map<string, DailyReturnRow[]>();

  for (const row of rows) {
    const key = row.date.substring(0, 7); // YYYY-MM
    const arr = byMonth.get(key) || [];
    arr.push(row);
    byMonth.set(key, arr);
  }

  const result: { year: number; month: number; returnPct: number }[] = [];

  for (const [key, monthRows] of Array.from(byMonth.entries()).sort()) {
    const first = monthRows[0];
    const last = monthRows[monthRows.length - 1];
    const returnPct = ((last.navIndex / first.navIndex) - 1) * 100;
    const [year, month] = key.split("-").map(Number);
    result.push({ year, month, returnPct });
  }

  return result;
}

/**
 * Get the latest daily return entry.
 */
export async function getLatestDailyReturn(): Promise<DailyReturnRow | null> {
  const database = getDb();
  const rows = await database
    .select({
      date: dailyReturns.date,
      navIndex: dailyReturns.navIndex,
      dailyReturn: dailyReturns.dailyReturn,
    })
    .from(dailyReturns)
    .orderBy(desc(dailyReturns.date))
    .limit(1);

  return rows[0] || null;
}
