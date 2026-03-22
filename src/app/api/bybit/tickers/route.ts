import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { TickerData } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://api.bybit.com";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "XRPUSDT", "LTCUSDT"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Bybit public endpoint — no auth required
    const res = await fetch(
      `${BASE_URL}/v5/market/tickers?category=linear`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) {
      throw new Error(`Bybit API error: ${res.status}`);
    }

    const data = await res.json();
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retCode} - ${data.retMsg}`);
    }

    const symbolSet = new Set(SYMBOLS);
    const tickers: TickerData[] = (data.result.list ?? [])
      .filter((t: TickerData) => symbolSet.has(t.symbol))
      .map((t: TickerData) => ({
        symbol: t.symbol,
        lastPrice: t.lastPrice,
        price24hPcnt: t.price24hPcnt,
        highPrice24h: t.highPrice24h,
        lowPrice24h: t.lowPrice24h,
        turnover24h: t.turnover24h,
        volume24h: t.volume24h,
        markPrice: t.markPrice,
      }));

    return NextResponse.json({ tickers, ts: Date.now() });
  } catch (error) {
    console.error("Bybit tickers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickers", tickers: [], ts: Date.now() },
      { status: 500 }
    );
  }
}
