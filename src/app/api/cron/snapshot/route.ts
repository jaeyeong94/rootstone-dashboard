import { NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron 인증
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getWalletBalance();
    const account = result.list?.[0];

    if (!account) {
      return NextResponse.json({ error: "No account data" }, { status: 404 });
    }

    const currentEquity = parseFloat(account.totalEquity);
    const totalWalletBalance = parseFloat(account.totalWalletBalance);
    const totalUnrealisedPnl = parseFloat(account.totalPerpUPL);

    // 마지막 스냅샷 확인 (중복 방지: 30분 이내면 skip)
    const db = getDb();
    const lastRows = await db
      .select()
      .from(balanceSnapshots)
      .orderBy(desc(balanceSnapshots.snapshotAt))
      .limit(1);
    const lastSnapshot = lastRows[0];

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (lastSnapshot && lastSnapshot.snapshotAt > thirtyMinAgo) {
      return NextResponse.json({
        skipped: true,
        reason: "Recent snapshot exists",
        lastSnapshotAt: lastSnapshot.snapshotAt,
      });
    }

    await db.insert(balanceSnapshots).values({
      totalEquity: currentEquity,
      totalWalletBalance,
      totalUnrealisedPnl,
    });

    return NextResponse.json({
      ok: true,
      snapshotAt: new Date().toISOString(),
      totalEquity: currentEquity,
    });
  } catch (error) {
    console.error("Cron snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to take snapshot" },
      { status: 500 }
    );
  }
}
