import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { benchmarkPrices } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BENCHMARKS = [
  { ticker: "SPY", symbol: "SPY", name: "S&P 500" },
  { ticker: "QQQ", symbol: "QQQ", name: "Nasdaq 100" },
  { ticker: "GLD", symbol: "GLD", name: "Gold" },
  { ticker: "IEF", symbol: "IEF", name: "US 10Y Treasury" },
];

// Fetch from 2021-03-01 to cover full Rebeta operational period
const START_EPOCH = Math.floor(new Date("2021-02-28").getTime() / 1000);

interface YahooPrice {
  date: string;
  close: number;
}

async function fetchYahooPrices(ticker: string): Promise<YahooPrice[]> {
  const end = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${START_EPOCH}&period2=${end}&interval=1d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance ${ticker}: ${res.status}`);
  }

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result?.timestamp) {
    throw new Error(`Yahoo Finance ${ticker}: no data`);
  }

  const timestamps: number[] = result.timestamp;
  const closes: (number | null)[] = result.indicators.quote[0].close;
  const prices: YahooPrice[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const d = new Date(timestamps[i] * 1000);
    const date = d.toISOString().split("T")[0];
    prices.push({ date, close: Math.round(closes[i]! * 100) / 100 });
  }

  return prices;
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const results: Record<string, { fetched: number; upserted: number }> = {};

  for (const bm of BENCHMARKS) {
    try {
      const prices = await fetchYahooPrices(bm.ticker);

      // Upsert all prices (ON CONFLICT DO UPDATE)
      if (prices.length > 0) {
        // Batch insert in chunks of 500
        for (let i = 0; i < prices.length; i += 500) {
          const batch = prices.slice(i, i + 500);
          await db
            .insert(benchmarkPrices)
            .values(
              batch.map((p) => ({
                symbol: bm.symbol,
                date: p.date,
                close: p.close,
              }))
            )
            .onConflictDoUpdate({
              target: [benchmarkPrices.symbol, benchmarkPrices.date],
              set: { close: sql`excluded.close` },
            });
        }
      }

      results[bm.symbol] = { fetched: prices.length, upserted: prices.length };
    } catch (error) {
      console.error(`Benchmark update ${bm.symbol}:`, error);
      results[bm.symbol] = { fetched: 0, upserted: 0 };
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
