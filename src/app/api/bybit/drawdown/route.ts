import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { calcDrawdownSeries } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshots = await getDb()
      .select()
      .from(balanceSnapshots)
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
