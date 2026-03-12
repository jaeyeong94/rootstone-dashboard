import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { desc, and, gte } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "24h";

  try {
    const result = await getWalletBalance();
    const account = result.list?.[0];

    if (!account) {
      return NextResponse.json(
        { error: "No account data" },
        { status: 404 }
      );
    }

    const currentEquity = parseFloat(account.totalEquity);
    const unrealisedPnl = parseFloat(account.totalPerpUPL);

    // Auto-snapshot: insert if last snapshot is > 1 hour old
    const db = getDb();
    const lastRows = await db
      .select()
      .from(balanceSnapshots)
      .orderBy(desc(balanceSnapshots.snapshotAt))
      .limit(1);
    const lastSnapshot = lastRows[0];

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!lastSnapshot || lastSnapshot.snapshotAt < oneHourAgo) {
      await db.insert(balanceSnapshots)
        .values({
          totalEquity: currentEquity,
          totalWalletBalance: parseFloat(account.totalWalletBalance),
          totalUnrealisedPnl: unrealisedPnl,
        });
    }

    // Calculate change % from snapshots
    const periodMs: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const cutoff = new Date(Date.now() - (periodMs[period] || periodMs["24h"]));
    const oldRows = await db
      .select()
      .from(balanceSnapshots)
      .where(gte(balanceSnapshots.snapshotAt, cutoff))
      .orderBy(balanceSnapshots.snapshotAt)
      .limit(1);
    const oldSnapshot = oldRows[0];

    let changePercent = 0;
    if (oldSnapshot && oldSnapshot.totalEquity > 0) {
      changePercent =
        (currentEquity - oldSnapshot.totalEquity) / oldSnapshot.totalEquity;
    }

    // Return ONLY percentages — no absolute amounts
    return NextResponse.json({
      changePercent,
      unrealisedPnlPercent: currentEquity > 0 ? unrealisedPnl / currentEquity : 0,
      period,
      hasHistory: !!oldSnapshot,
    });
  } catch (error) {
    console.error("Bybit balance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
