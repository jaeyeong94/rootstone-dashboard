import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import type { EquityCurvePoint } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get balance snapshots from DB
    const snapshots = getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt))
      .all();

    if (snapshots.length === 0) {
      return NextResponse.json({ curve: [] });
    }

    // Deduplicate: keep last snapshot per day
    const byDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      byDay.set(day, s.totalEquity);
    }

    const firstEquity = snapshots[0].totalEquity;
    const curve: EquityCurvePoint[] = Array.from(byDay.entries()).map(
      ([day, equity]) => ({
        time: day,
        value: ((equity - firstEquity) / firstEquity) * 100,
      })
    );

    return NextResponse.json({ curve });
  } catch (error) {
    console.error("Equity curve error:", error);
    return NextResponse.json(
      { error: "Failed to calculate equity curve" },
      { status: 500 }
    );
  }
}
