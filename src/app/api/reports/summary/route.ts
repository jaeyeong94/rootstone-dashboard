import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { and, asc, gte, lte } from "drizzle-orm";
import { getClosedPnl } from "@/lib/bybit/client";
import {
  calcSharpeRatio,
  calcSortinoRatio,
  calcMaxDrawdown,
  calcDailyReturns,
} from "@/lib/utils";
import type { BybitClosedPnl } from "@/types";

export interface ReportSummary {
  totalReturn: number;       // % e.g. 12.34
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;       // % negative e.g. -5.12
  totalTrades: number;
  winRate: number;           // % e.g. 61.5
  equityCurve: { time: string; value: number }[];  // normalized % from start
  monthlyReturns: { year: number; month: number; return: number }[];
  topWins: TradeHighlight[];
  topLosses: TradeHighlight[];
  avgGrossExposure: number;  // % placeholder
  var95: number;             // 1-day VaR 95% as negative %
}

export interface TradeHighlight {
  symbol: string;
  closedPnlPct: number;   // % relative to period start equity (no abs dollar)
  side: string;
  time: string;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  // Default: last 30 days
  const endDate = endParam ? new Date(endParam + "T23:59:59Z") : new Date();
  const startDate = startParam
    ? new Date(startParam + "T00:00:00Z")
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // ── Balance snapshots for the period ──────────────────────────────────
    const snapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .where(
        startParam || endParam
          ? and(gte(balanceSnapshots.snapshotAt, startDate), lte(balanceSnapshots.snapshotAt, endDate))
          : lte(balanceSnapshots.snapshotAt, endDate)
      )
      .orderBy(asc(balanceSnapshots.snapshotAt));

    const equities = snapshots.map((s) => s.totalEquity);
    const startEquity = equities.length > 0 ? equities[0] : 1;

    // ── Core metrics from equity curve ───────────────────────────────────
    const dailyReturns = calcDailyReturns(equities);
    const sharpeRatio = calcSharpeRatio(dailyReturns);
    const sortinoRatio = calcSortinoRatio(dailyReturns);
    const maxDrawdownRaw = calcMaxDrawdown(equities);
    const totalReturn =
      equities.length >= 2
        ? ((equities[equities.length - 1] - equities[0]) / equities[0]) * 100
        : 0;

    // ── Equity curve: normalized to % from period start ───────────────────
    const equityCurve = snapshots.map((s) => ({
      time: s.snapshotAt.toISOString().slice(0, 10),
      value: parseFloat(
        (((s.totalEquity - startEquity) / startEquity) * 100).toFixed(4)
      ),
    }));

    // ── Monthly returns ───────────────────────────────────────────────────
    const monthlyMap = new Map<string, { start: number; end: number }>();
    for (const s of snapshots) {
      const y = s.snapshotAt.getUTCFullYear();
      const m = s.snapshotAt.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const existing = monthlyMap.get(key);
      if (!existing) {
        monthlyMap.set(key, { start: s.totalEquity, end: s.totalEquity });
      } else {
        existing.end = s.totalEquity;
      }
    }
    const monthlyReturns: { year: number; month: number; return: number }[] = [];
    for (const [key, { start, end }] of monthlyMap.entries()) {
      const [y, m] = key.split("-").map(Number);
      monthlyReturns.push({
        year: y,
        month: m,
        return: parseFloat((((end - start) / start) * 100).toFixed(2)),
      });
    }
    monthlyReturns.sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    // ── VaR 95% (historical simulation from daily returns) ────────────────
    let var95 = 0;
    if (dailyReturns.length >= 5) {
      const sorted = [...dailyReturns].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * 0.05);
      var95 = parseFloat((sorted[idx] * 100).toFixed(2));
    }

    // ── Closed PnL trades for the period ─────────────────────────────────
    let totalTrades = 0;
    let winRate = 0;
    const topWins: TradeHighlight[] = [];
    const topLosses: TradeHighlight[] = [];
    let avgGrossExposure = 0;

    try {
      const startTime = String(startDate.getTime());
      const endTime = String(endDate.getTime());

      const allFills: BybitClosedPnl[] = [];
      let cursor: string | undefined;
      do {
        const page = await getClosedPnl({
          limit: "200",
          startTime,
          endTime,
          ...(cursor ? { cursor } : {}),
        });
        allFills.push(...page.list);
        cursor = page.nextPageCursor || undefined;
      } while (cursor);

      // Aggregate fills into positions (same symbol + 1-min bucket)
      const posMap = new Map<
        string,
        { pnl: number; created: number; updated: number; symbol: string; side: string }
      >();
      for (const t of allFills) {
        const minuteBucket = Math.floor(parseInt(t.updatedTime) / 60000);
        const key = `${t.symbol}_${minuteBucket}`;
        const existing = posMap.get(key);
        if (existing) {
          existing.pnl += parseFloat(t.closedPnl);
          existing.updated = Math.max(existing.updated, parseInt(t.updatedTime));
        } else {
          posMap.set(key, {
            pnl: parseFloat(t.closedPnl),
            created: parseInt(t.createdTime),
            updated: parseInt(t.updatedTime),
            symbol: t.symbol,
            side: t.side,
          });
        }
      }

      const positions = Array.from(posMap.values());
      totalTrades = positions.length;

      if (totalTrades > 0) {
        const wins = positions.filter((p) => p.pnl > 0);
        winRate = parseFloat(((wins.length / totalTrades) * 100).toFixed(1));

        // Convert PnL to % relative to period start equity (no absolute amounts)
        const toPct = (pnl: number) =>
          startEquity > 0
            ? parseFloat(((pnl / startEquity) * 100).toFixed(4))
            : 0;

        const sorted = [...positions].sort((a, b) => b.pnl - a.pnl);

        topWins.push(
          ...sorted.slice(0, 5).map((p) => ({
            symbol: p.symbol,
            closedPnlPct: toPct(p.pnl),
            side: p.side,
            time: new Date(p.updated).toISOString().slice(0, 10),
          }))
        );

        topLosses.push(
          ...sorted
            .slice(-5)
            .reverse()
            .map((p) => ({
              symbol: p.symbol,
              closedPnlPct: toPct(p.pnl),
              side: p.side,
              time: new Date(p.updated).toISOString().slice(0, 10),
            }))
        );

        // Avg gross exposure: average of abs(positionValue) is unavailable from closed-pnl
        // Use a proxy: avg pnl magnitude as % of equity, annualized to exposure estimate
        // Since we have no position size data here, we set a flag value and let the UI
        // show "N/A" if 0. A real implementation would query /v5/position/list history.
        avgGrossExposure = 0;
      }
    } catch {
      // PnL API failure — return equity metrics only
    }

    const summary: ReportSummary = {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdownRaw * 100).toFixed(2)),
      totalTrades,
      winRate,
      equityCurve,
      monthlyReturns,
      topWins,
      topLosses,
      avgGrossExposure,
      var95,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Report summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
