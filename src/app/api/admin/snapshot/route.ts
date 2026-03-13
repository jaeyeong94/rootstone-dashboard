import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Admin routes are protected by session check only

  try {
    const result = await getWalletBalance();
    const account = result.list?.[0];
    if (!account) {
      return NextResponse.json({ error: "No account data" }, { status: 404 });
    }

    const db = getDb();
    await db.insert(balanceSnapshots).values({
      totalEquity: parseFloat(account.totalEquity),
      totalWalletBalance: parseFloat(account.totalWalletBalance),
      totalUnrealisedPnl: parseFloat(account.totalPerpUPL),
    });

    return NextResponse.json({
      ok: true,
      snapshotAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Manual snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
