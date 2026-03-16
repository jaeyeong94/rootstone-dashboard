import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { BenchmarkPoint } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYBIT_PUBLIC = "https://api.bybit.com";

/**
 * Fetch BTC benchmark cumulative returns.
 * Paginates Bybit kline API (max 1000 per request) to get full history.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const startDateParam = searchParams.get("startDate") || "2021-03-02";

  try {
    const startTs = new Date(startDateParam).getTime();
    const allKlines: string[][] = [];

    // Paginate: Bybit returns newest first, max 1000 per request
    let endTs = Date.now();
    for (let page = 0; page < 5; page++) {
      const url = `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=D&limit=1000&end=${endTs}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const data = await res.json();

      if (data.retCode !== 0) {
        throw new Error(`Bybit kline error: ${data.retMsg}`);
      }

      const klines: string[][] = data.result.list || [];
      if (klines.length === 0) break;

      allKlines.push(...klines);

      // klines are newest-first, last item is oldest
      const oldestTs = parseInt(klines[klines.length - 1][0]);
      if (oldestTs <= startTs) break; // Got enough data
      endTs = oldestTs; // Next page ends before this
    }

    if (allKlines.length === 0) {
      return NextResponse.json({ series: [] });
    }

    // Deduplicate and sort chronologically
    const seen = new Set<string>();
    const sorted = allKlines
      .filter((k) => {
        if (seen.has(k[0])) return false;
        seen.add(k[0]);
        return true;
      })
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .filter((k) => parseInt(k[0]) >= startTs);

    if (sorted.length === 0) {
      return NextResponse.json({ series: [] });
    }

    const baseClose = parseFloat(sorted[0][4]);

    const series: BenchmarkPoint[] = sorted.map((k) => ({
      time: new Date(parseInt(k[0])).toISOString().split("T")[0],
      value: ((parseFloat(k[4]) - baseClose) / baseClose) * 100,
    }));

    return NextResponse.json({ series, symbol });
  } catch (error) {
    console.error("Benchmark error:", error);
    return NextResponse.json(
      { error: "Failed to fetch benchmark data" },
      { status: 500 }
    );
  }
}
