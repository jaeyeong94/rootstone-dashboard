import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClosedPnl } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc, gte } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches closed PnL with time-windowed pagination.
 *
 * Bybit closed-pnl rules:
 *  - Without startTime/endTime → returns last 7 days only
 *  - endTime - startTime must be ≤ 7 days
 *  - Max 2 years of history available
 *
 * Query params:
 *  - cursor: Bybit cursor (within a 7-day window)
 *  - endTime: end of current 7-day window (ms). Defaults to now.
 *  - limit: per-request limit (max 100)
 *
 * Response:
 *  - list: closed PnL records
 *  - nextPageCursor: cursor for next page within same window
 *  - nextEndTime: when cursor exhausted, the endTime for the next window
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || undefined;
  const limit = searchParams.get("limit") || "100";
  const cursor = searchParams.get("cursor") || undefined;
  const endTimeParam = searchParams.get("endTime");

  const endTime = endTimeParam ? parseInt(endTimeParam) : Date.now();
  const startTime = endTime - SEVEN_DAYS_MS;

  try {
    const result = await getClosedPnl({
      symbol,
      limit,
      cursor,
      startTime: String(startTime),
      endTime: String(endTime),
    });

    const list = result.list ?? [];
    const nextCursor = result.nextPageCursor || "";

    // When cursor exhausted, always advance to next window if we haven't reached v3.1 start
    const V31_START_MS = new Date("2024-11-17").getTime();
    const nextEndTime =
      !nextCursor && startTime > V31_START_MS ? startTime : null;

    // Attach closest snapshot equity to each record for portfolio-based ROI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enrichedList: any[] = list;
    if (list.length > 0) {
      const db = getDb();
      const timestamps = list.map((r) => parseInt(r.updatedTime));
      const windowStart = new Date(Math.min(...timestamps) - 86400000);

      const snapshots = await db
        .select({ snapshotAt: balanceSnapshots.snapshotAt, totalEquity: balanceSnapshots.totalEquity })
        .from(balanceSnapshots)
        .where(gte(balanceSnapshots.snapshotAt, windowStart))
        .orderBy(asc(balanceSnapshots.snapshotAt));

      enrichedList = list.map((rec) => {
        const tradeTime = parseInt(rec.updatedTime);
        let closestEquity = 0;
        for (const snap of snapshots) {
          if (snap.snapshotAt.getTime() <= tradeTime) {
            closestEquity = snap.totalEquity;
          } else {
            break;
          }
        }
        if (closestEquity === 0 && snapshots.length > 0) {
          closestEquity = snapshots[0].totalEquity;
        }
        return { ...rec, totalEquityAtTime: closestEquity };
      });
    }

    return NextResponse.json({
      list: enrichedList,
      nextPageCursor: nextCursor,
      nextEndTime,
    });
  } catch (error) {
    console.error("Bybit PnL error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PnL" },
      { status: 500 }
    );
  }
}
