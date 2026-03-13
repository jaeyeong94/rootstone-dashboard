import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BYBIT_PUBLIC = "https://api.bybit.com";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = searchParams.get("interval") || "60";
  const limit = searchParams.get("limit") || "48";

  try {
    const url = `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();

    if (data.retCode !== 0) {
      throw new Error(data.retMsg);
    }

    const klines: string[][] = data.result.list || [];
    const sorted = [...klines].reverse();

    const points = sorted.map((k) => ({
      time: parseInt(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
    }));

    return NextResponse.json({ symbol, points });
  } catch (error) {
    console.error("kline-spark error:", error);
    return NextResponse.json({ error: "Failed to fetch klines" }, { status: 500 });
  }
}
