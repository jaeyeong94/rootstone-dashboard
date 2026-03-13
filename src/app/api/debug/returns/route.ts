import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshots = await getDb()
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt));

    if (snapshots.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    // Deduplicate: keep last snapshot per day
    const byDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      byDay.set(day, s.totalEquity);
    }

    const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
    const firstEquity = days[0][1];

    const rows = days.map(([date, equity], i) => {
      // Simple cumulative: (equity - first) / first * 100
      const simpleCumulative = ((equity - firstEquity) / firstEquity) * 100;

      // Daily return: (equity_t / equity_{t-1}) - 1
      const prevEquity = i > 0 ? days[i - 1][1] : equity;
      const dailyReturn = i > 0 ? ((equity / prevEquity) - 1) * 100 : 0;

      return {
        date,
        equity: Math.round(equity * 100) / 100,
        dailyReturn: Math.round(dailyReturn * 10000) / 10000,
        simpleCumulative: Math.round(simpleCumulative * 10000) / 10000,
      };
    });

    // Compound cumulative from daily returns: product of (1 + r_i)
    let compoundMultiplier = 1;
    for (const row of rows) {
      compoundMultiplier *= (1 + row.dailyReturn / 100);
      (row as Record<string, number | string>).compoundCumulative =
        Math.round((compoundMultiplier - 1) * 100 * 10000) / 10000;
    }

    return NextResponse.json({
      rows,
      firstEquity: Math.round(firstEquity * 100) / 100,
      totalDays: rows.length,
    });
  } catch (error) {
    console.error("Debug returns error:", error);
    return NextResponse.json(
      { error: "Failed to compute returns" },
      { status: 500 }
    );
  }
}
