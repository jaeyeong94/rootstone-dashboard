import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClosedPnl } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc, and, gte, lte } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  try {
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const [pnlData, snapshots] = await Promise.all([
      getClosedPnl({
        startTime: String(dayStart.getTime()),
        endTime: String(dayEnd.getTime()),
        limit: "50",
      }),
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .where(and(
          gte(balanceSnapshots.snapshotAt, new Date(dayStart.getTime() - 86400000)),
          lte(balanceSnapshots.snapshotAt, dayEnd)
        ))
        .orderBy(asc(balanceSnapshots.snapshotAt)),
    ]);

    // Calculate daily return from snapshots
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }
    const prevDay = new Date(dayStart.getTime() - 86400000).toISOString().split("T")[0];
    const todayEquity = equityByDay.get(dateStr);
    const prevEquity = equityByDay.get(prevDay);
    const dailyReturn =
      todayEquity && prevEquity && prevEquity > 0
        ? ((todayEquity - prevEquity) / prevEquity) * 100
        : 0;

    // Format trades - ONLY showing percentages, no absolute amounts
    const trades = pnlData.list.map((t) => {
      const entry = parseFloat(t.entryPrice);
      const exit = parseFloat(t.exitPrice);
      const closedPnlPct =
        entry > 0 ? ((exit - entry) / entry) * (t.side === "Buy" ? 1 : -1) * 100 : 0;
      return {
        symbol: t.symbol.replace("USDT", ""),
        side: t.side,
        entryPrice: entry,
        exitPrice: exit,
        closedPnlPct: Math.round(closedPnlPct * 100) / 100,
        closedAt: new Date(parseInt(t.updatedTime)).toISOString(),
      };
    });

    return NextResponse.json({
      date: dateStr,
      dailyReturn: Math.round(dailyReturn * 100) / 100,
      trades,
    });
  } catch (error) {
    console.error("Calendar day detail error:", error);
    return NextResponse.json(
      { error: "Failed to load day details" },
      { status: 500 }
    );
  }
}
