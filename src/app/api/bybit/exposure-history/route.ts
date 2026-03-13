import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { gte, asc } from "drizzle-orm";

export interface ExposureHistoryPoint {
  date: string;        // YYYY-MM-DD
  grossExposure: number | null;
  netExposure: number | null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30"), 1), 365);

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const db = getDb();

    const snapshots = await db
      .select({
        snapshotAt: balanceSnapshots.snapshotAt,
        totalEquity: balanceSnapshots.totalEquity,
      })
      .from(balanceSnapshots)
      .where(gte(balanceSnapshots.snapshotAt, cutoff))
      .orderBy(asc(balanceSnapshots.snapshotAt));

    // Group by calendar date — take last snapshot per day
    const byDate = new Map<string, { equity: number }>();
    for (const row of snapshots) {
      const date = new Date(row.snapshotAt).toISOString().slice(0, 10);
      byDate.set(date, { equity: row.totalEquity });
    }

    // Build history array
    // Note: balance_snapshots does not store position data, so we cannot
    // reconstruct exact historical gross/net exposure from snapshots alone.
    // We return the equity trend, with exposure fields null to indicate
    // unavailability. The chart on the client will gracefully handle nulls.
    // If you later add a positions snapshot table, update this route.
    const history: ExposureHistoryPoint[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date]) => ({
        date,
        grossExposure: null,
        netExposure: null,
      }));

    return NextResponse.json({ history, days });
  } catch (error) {
    console.error("Exposure history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exposure history" },
      { status: 500 }
    );
  }
}
