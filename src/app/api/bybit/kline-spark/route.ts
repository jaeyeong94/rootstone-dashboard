import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BYBIT_PUBLIC = "https://api.bybit.com";

interface KlinePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function parseKlines(list: string[][]): KlinePoint[] {
  return list.map((k) => ({
    time: parseInt(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
}

async function fetchKlines(url: string): Promise<KlinePoint[]> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  const data = await res.json();
  if (data.retCode !== 0) {
    throw new Error(data.retMsg);
  }
  const klines: string[][] = data.result.list || [];
  return parseKlines(klines);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const intervalParam = searchParams.get("interval") || "60";
  const limit = searchParams.get("limit") || "48";
  const startTime = searchParams.get("startTime");

  try {
    let points: KlinePoint[] = [];

    if (startTime && intervalParam === "D") {
      const startMs = parseInt(startTime);
      const dayMs = 86400000;
      const totalDays = Math.ceil((Date.now() - startMs) / dayMs);

      if (totalDays <= 1000) {
        // 단일 요청
        const url = `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=D&start=${startMs}&limit=1000`;
        points = await fetchKlines(url);
      } else {
        // 두 요청으로 최대 2000개 커버
        const midMs = startMs + 1000 * dayMs;
        const [res1, res2] = await Promise.all([
          fetchKlines(
            `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=D&start=${startMs}&limit=1000`
          ),
          fetchKlines(
            `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=D&start=${midMs}&limit=1000`
          ),
        ]);

        // 병합 후 중복 제거 (time 기준 Map) + 시간순 오름차순 정렬
        const merged = new Map<number, KlinePoint>();
        for (const p of [...res1, ...res2]) {
          merged.set(p.time, p);
        }
        points = Array.from(merged.values()).sort((a, b) => a.time - b.time);
      }
    } else {
      // 기존 로직: startTime 없거나 D가 아닌 경우
      const url = `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=${intervalParam}&limit=${limit}`;
      const raw = await fetchKlines(url);
      // Bybit은 내림차순으로 반환 → 오름차순 정렬
      points = [...raw].reverse();
    }

    return NextResponse.json({ symbol, points });
  } catch (error) {
    console.error("kline-spark error:", error);
    return NextResponse.json({ error: "Failed to fetch klines" }, { status: 500 });
  }
}
