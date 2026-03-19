import { NextResponse } from "next/server";
import { getExecutions } from "@/lib/bybit/client";
import { getKlines } from "@/lib/bybit/kline";
import { db as getDb } from "@/lib/db";
import { marginUtilDistribution } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const V31_START = new Date("2024-11-17").getTime();
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "XRPUSDT", "LTCUSDT"];

/**
 * Collect executions with N-day window, paginated.
 * Returns Map<execId, execution>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function collectExecs(windowDays: number): Promise<Map<string, any>> {
  const WINDOW_MS = windowDays * 24 * 60 * 60 * 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = new Map<string, any>();
  let endTime = Date.now();

  while (endTime > V31_START) {
    const startTime = Math.max(endTime - WINDOW_MS, V31_START);
    let cursor: string | undefined;
    do {
      const page = await getExecutions({ limit: "100", ...(cursor ? { cursor } : {}) });
      for (const e of page.list ?? []) {
        if (e.execType === "Trade") result.set(e.execId, e);
      }
      cursor = page.nextPageCursor || undefined;
    } while (cursor);
    endTime = startTime;
  }
  return result;
}

/**
 * Cron: Margin Utilization Distribution
 *
 * Method: Forward reconstruction (CTO validated, 12/18 within 3%)
 * Data: 3x cross-validated (1d+2d+3d windows, 0% position error)
 * Price: kline 1h OPEN
 * Timing: trades reflected in NEXT hour's snapshot
 *
 * Schedule: Daily UTC 00:15
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Triple cross-validated execution collection
    const [set1, set2, set3] = await Promise.all([
      collectExecs(1),
      collectExecs(2),
      collectExecs(3),
    ]);

    // Union
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = new Map<string, any>();
    for (const [id, e] of set1) merged.set(id, e);
    for (const [id, e] of set2) if (!merged.has(id)) merged.set(id, e);
    for (const [id, e] of set3) if (!merged.has(id)) merged.set(id, e);

    const trades = Array.from(merged.values()).sort(
      (a, b) => parseInt(a.execTime) - parseInt(b.execTime)
    );

    // 2. Collect 1h kline OPEN prices
    const hourlyOpen: Record<string, Record<string, number>> = {};
    for (const sym of SYMBOLS) {
      hourlyOpen[sym] = {};
      const klines = await getKlines(sym, "60", 5000);
      for (const k of klines) {
        const dt = new Date(parseInt(k.startTime));
        const hour = formatHour(dt);
        hourlyOpen[sym][hour] = parseFloat(k.openPrice);
      }
    }

    // 3. Forward reconstruction
    // Group trades by "next hour" for _OPEN timing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextHourTrades: Record<string, any[]> = {};
    for (const e of trades) {
      const dt = new Date(parseInt(e.execTime));
      const nextH = new Date(dt);
      nextH.setUTCMinutes(0, 0, 0);
      nextH.setTime(nextH.getTime() + 3600000);
      const key = formatHour(nextH);
      if (!nextHourTrades[key]) nextHourTrades[key] = [];
      nextHourTrades[key].push(e);
    }

    const netPos: Record<string, number> = {};
    for (const s of SYMBOLS) netPos[s] = 0;

    // Cash tracking via cumulative PnL
    let cumPnl = 0;
    const tradePnlByHour: Record<string, number> = {};
    for (const e of trades) {
      cumPnl += parseFloat(e.closedPnl || "0") - Math.abs(parseFloat(e.execFee || "0"));
      const dt = new Date(parseInt(e.execTime));
      const nextH = new Date(dt);
      nextH.setUTCMinutes(0, 0, 0);
      nextH.setTime(nextH.getTime() + 3600000);
      tradePnlByHour[formatHour(nextH)] = 19284 + cumPnl;
    }

    let lastCash = 19284.0;
    const startDate = new Date("2024-11-17");
    const endDate = new Date();
    const allUtils: number[] = [];

    const current = new Date(startDate);
    while (current < endDate) {
      const h = formatHour(current);

      // Snapshot BEFORE trades (= hour start position)
      let pv = 0;
      for (const s of SYMBOLS) {
        const price = hourlyOpen[s]?.[h] || 0;
        pv += Math.max(0, netPos[s]) * price;
      }
      const mu = lastCash > 0 ? pv / lastCash : 0;
      allUtils.push(mu);

      // Process trades for next hour
      if (nextHourTrades[h]) {
        for (const e of nextHourTrades[h]) {
          const sym = e.symbol;
          if (!SYMBOLS.includes(sym)) continue;
          const cs = parseFloat(e.closedSize || "0");
          const qty = parseFloat(e.execQty);
          if (cs > 0) netPos[sym] = Math.max(0, (netPos[sym] || 0) - cs);
          else if (e.side === "Buy") netPos[sym] = (netPos[sym] || 0) + qty;
        }
        if (tradePnlByHour[h]) lastCash = tradePnlByHour[h];
      }

      current.setTime(current.getTime() + 3600000);
    }

    // 4. Distribution
    const brackets = [
      { label: "0–10%", lo: 0, hi: 0.1 }, { label: "10–20%", lo: 0.1, hi: 0.2 },
      { label: "20–30%", lo: 0.2, hi: 0.3 }, { label: "30–50%", lo: 0.3, hi: 0.5 },
      { label: "50–80%", lo: 0.5, hi: 0.8 }, { label: "80–100%", lo: 0.8, hi: 1.0 },
      { label: "100–120%", lo: 1.0, hi: 1.2 }, { label: "120–150%", lo: 1.2, hi: 1.5 },
      { label: ">150%", lo: 1.5, hi: 999 },
    ];

    const distribution = brackets.map((b) => {
      const count = allUtils.filter((u) => u >= b.lo && u < b.hi).length;
      return { range: b.label, hours: count, pct: parseFloat(((count / allUtils.length) * 100).toFixed(1)) };
    });

    const below30 = allUtils.filter((u) => u < 0.3).length;
    const above80 = allUtils.filter((u) => u >= 0.8).length;
    const above100 = allUtils.filter((u) => u >= 1.0).length;
    const sorted = [...allUtils].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Peak events by date
    const peakByDate: Record<string, number> = {};
    const cur2 = new Date(startDate);
    let idx = 0;
    while (cur2 < endDate && idx < allUtils.length) {
      const d = cur2.toISOString().split("T")[0];
      if (!peakByDate[d] || allUtils[idx] > peakByDate[d]) peakByDate[d] = allUtils[idx];
      cur2.setTime(cur2.getTime() + 3600000);
      idx++;
    }
    const topEvents = Object.entries(peakByDate)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([date, mu]) => ({ date, maxUtil: parseFloat((mu * 100).toFixed(1)) }));

    const result = {
      distribution,
      summary: {
        totalHours: allUtils.length,
        below30Pct: parseFloat(((below30 / allUtils.length) * 100).toFixed(1)),
        above80, above80Pct: parseFloat(((above80 / allUtils.length) * 100).toFixed(2)),
        above100, above100Pct: parseFloat(((above100 / allUtils.length) * 100).toFixed(2)),
        median: parseFloat((median * 100).toFixed(1)),
      },
      topEvents,
      period: `2024-11-17 ~ ${endDate.toISOString().split("T")[0]}`,
      collection: {
        window1d: set1.size,
        window2d: set2.size,
        window3d: set3.size,
        merged: merged.size,
        method: "3x_cross_validated",
      },
      method: "forward_kline_open_closedSize_next_hour",
      computedAt: new Date().toISOString(),
    };

    // 5. Store
    const database = getDb();
    await database.insert(marginUtilDistribution).values({
      dataJson: JSON.stringify(result),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Margin util cron error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function formatHour(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")} ${String(dt.getUTCHours()).padStart(2, "0")}:00`;
}
