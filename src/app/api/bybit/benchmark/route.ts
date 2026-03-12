import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { BenchmarkPoint } from "@/types";

const BYBIT_PUBLIC = "https://api.bybit.com";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = "D";
  const limit = searchParams.get("limit") || "365";

  try {
    const url = `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit kline error: ${data.retMsg}`);
    }

    const klines: string[][] = data.result.list || [];

    if (klines.length === 0) {
      return NextResponse.json({ series: [] });
    }

    const sorted = [...klines].reverse();
    const firstClose = parseFloat(sorted[0][4]);

    const series: BenchmarkPoint[] = sorted.map((k) => ({
      time: new Date(parseInt(k[0])).toISOString().split("T")[0],
      value: ((parseFloat(k[4]) - firstClose) / firstClose) * 100,
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
