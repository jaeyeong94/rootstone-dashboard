import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc, gte } from "drizzle-orm";
import { calcDrawdownSeries } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v3.1 운용 시작일 — 이전 데이터는 포지션 정리로 인해 왜곡됨
const V31_START = new Date("2024-11-17");

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshots = await getDb()
      .select()
      .from(balanceSnapshots)
      .where(gte(balanceSnapshots.snapshotAt, V31_START))
      .orderBy(asc(balanceSnapshots.snapshotAt));

    if (snapshots.length === 0) {
      return NextResponse.json({ series: [] });
    }

    // Deduplicate: keep last snapshot per day
    const byDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      byDay.set(day, s.totalEquity);
    }
    const equitySeries = Array.from(byDay.entries()).map(([day, equity]) => ({
      time: day,
      equity,
    }));

    const series = calcDrawdownSeries(equitySeries);

    return NextResponse.json({ series });
  } catch (error) {
    console.error("Drawdown error:", error);
    return NextResponse.json(
      { error: "Failed to calculate drawdown" },
      { status: 500 }
    );
  }
}
