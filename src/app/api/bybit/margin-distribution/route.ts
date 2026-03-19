import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExecutions, getWalletBalance } from "@/lib/bybit/client";
import { getKlines } from "@/lib/bybit/kline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Margin Utilization Distribution API
 *
 * Computes hourly margin utilization = position_value / cashBalance
 * using execution closedSize for position tracking and 1h kline open prices.
 *
 * Returns pre-computed distribution buckets for frontend display.
 * Heavy computation — frontend caches via SWR with long refresh interval.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Collect recent executions (last 90 days for incremental approach)
    // Full history would be too heavy for API call — use last 90 days as representative sample
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const startTime = Date.now() - NINETY_DAYS_MS;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allExecs: any[] = [];

    // Paginate executions
    let cursor: string | undefined;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    let endTime = Date.now();

    while (endTime > startTime) {
      const st = Math.max(endTime - SEVEN_DAYS, startTime);
      const page = await getExecutions({
        limit: "100",
        ...(cursor ? { cursor } : {}),
      });

      for (const e of page.list ?? []) {
        if (e.execType === "Trade" || e.closedSize !== "0") {
          allExecs.push(e);
        }
      }

      cursor = page.nextPageCursor || undefined;
      if (!cursor) {
        endTime = st;
        cursor = undefined;
      }
      if (allExecs.length > 5000) break; // safety limit
    }

    // 2. Get current wallet balance as cashBalance baseline
    const balResult = await getWalletBalance();
    const currentCash = parseFloat(balResult.list[0].totalWalletBalance);

    // 3. Get current positions for reverse reconstruction
    const { getPositions } = await import("@/lib/bybit/client");
    const posResult = await getPositions();
    const currentPos: Record<string, number> = {};
    for (const p of posResult.list) {
      if (parseFloat(p.size) > 0) {
        currentPos[p.symbol] = parseFloat(p.size);
      }
    }

    // 4. Reverse reconstruct positions from current → past
    const symbols = ["BTCUSDT", "ETHUSDT", "XRPUSDT", "LTCUSDT"];
    const netPos: Record<string, number> = { ...currentPos };
    for (const s of symbols) {
      if (!(s in netPos)) netPos[s] = 0;
    }

    // Sort executions newest first for reverse
    const sortedExecs = [...allExecs].sort(
      (a, b) => parseInt(b.execTime) - parseInt(a.execTime)
    );

    // Collect hourly snapshots
    const hourlyData: Record<string, { mu: number; pv: number; cash: number }> = {};
    const lastCash = currentCash;
    const lastMark: Record<string, number> = {};

    for (const e of sortedExecs) {
      const sym = e.symbol;
      if (!symbols.includes(sym)) continue;

      const mp = parseFloat(e.markPrice || "0");
      if (mp > 0) lastMark[sym] = mp;

      const pv = symbols.reduce(
        (sum, s) => sum + Math.max(0, netPos[s] || 0) * (lastMark[s] || 0),
        0
      );
      const mu = lastCash > 0 ? pv / lastCash : 0;

      const dt = new Date(parseInt(e.execTime));
      const hour = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")} ${String(dt.getUTCHours()).padStart(2, "0")}:00`;

      if (!hourlyData[hour] || mu > hourlyData[hour].mu) {
        hourlyData[hour] = { mu, pv, cash: lastCash };
      }

      // Reverse the trade
      const qty = parseFloat(e.execQty);
      if (e.side === "Buy") {
        netPos[sym] -= qty;
      } else if (e.side === "Sell") {
        netPos[sym] += qty;
      }
    }

    // 5. Compute distribution
    const utils = Object.values(hourlyData).map((d) => d.mu);
    const totalHours = 90 * 24; // 90 days

    const brackets = [
      { label: "0–10%", lo: 0, hi: 0.1 },
      { label: "10–20%", lo: 0.1, hi: 0.2 },
      { label: "20–30%", lo: 0.2, hi: 0.3 },
      { label: "30–50%", lo: 0.3, hi: 0.5 },
      { label: "50–80%", lo: 0.5, hi: 0.8 },
      { label: "80–100%", lo: 0.8, hi: 1.0 },
      { label: "100–120%", lo: 1.0, hi: 1.2 },
      { label: "120–150%", lo: 1.2, hi: 1.5 },
      { label: ">150%", lo: 1.5, hi: 999 },
    ];

    // Count idle hours (no trades) as 0% utilization
    const activeHours = Object.keys(hourlyData).length;
    const idleHours = Math.max(0, totalHours - activeHours);

    const distribution = brackets.map((b) => {
      let count = utils.filter((u) => u >= b.lo && u < b.hi).length;
      if (b.lo === 0) count += idleHours; // idle = 0% util
      const pct = parseFloat(((count / totalHours) * 100).toFixed(1));
      return { range: b.label, hours: count, pct };
    });

    // Peak events
    const peakByDate: Record<string, number> = {};
    for (const [hour, data] of Object.entries(hourlyData)) {
      const date = hour.substring(0, 10);
      if (!peakByDate[date] || data.mu > peakByDate[date]) {
        peakByDate[date] = data.mu;
      }
    }
    const topEvents = Object.entries(peakByDate)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([date, mu]) => ({ date, maxUtil: parseFloat((mu * 100).toFixed(1)) }));

    const below30 = distribution.slice(0, 3).reduce((s, d) => s + d.hours, 0);
    const above100 = distribution.slice(6).reduce((s, d) => s + d.hours, 0);
    const above80 = distribution.slice(5).reduce((s, d) => s + d.hours, 0);

    return NextResponse.json({
      distribution,
      summary: {
        totalHours,
        activeHours,
        below30Pct: parseFloat(((below30 / totalHours) * 100).toFixed(1)),
        above80: above80,
        above80Pct: parseFloat(((above80 / totalHours) * 100).toFixed(2)),
        above100: above100,
        above100Pct: parseFloat(((above100 / totalHours) * 100).toFixed(2)),
        median: 0,
      },
      topEvents,
      period: "90d",
    });
  } catch (error) {
    console.error("Margin distribution error:", error);
    return NextResponse.json(
      { error: "Failed to compute margin distribution" },
      { status: 500 }
    );
  }
}
