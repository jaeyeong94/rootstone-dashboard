import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance, getExecutions } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { desc, gte, lte } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    // cutoff 이전의 가장 가까운 스냅샷 (정확한 기간 기준점)
    const oldRows = await db
      .select()
      .from(balanceSnapshots)
      .where(lte(balanceSnapshots.snapshotAt, cutoff))
      .orderBy(desc(balanceSnapshots.snapshotAt))
      .limit(1);
    // fallback: cutoff 이전 스냅샷이 없으면 cutoff 이후 가장 오래된 스냅샷
    const oldSnapshot = oldRows[0] ?? (await db
      .select()
      .from(balanceSnapshots)
      .where(gte(balanceSnapshots.snapshotAt, cutoff))
      .orderBy(balanceSnapshots.snapshotAt)
      .limit(1)
    )[0];

    let changePercent = 0;
    if (oldSnapshot && oldSnapshot.totalEquity > 0) {
      changePercent =
        (currentEquity - oldSnapshot.totalEquity) / oldSnapshot.totalEquity;
    }

    // Compute daily turnover: today's volume / equity (전체 체결 페이지네이션)
    let dailyTurnover = 0;
    try {
      const now = new Date();
      const todayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      let todayVolume = 0;
      let cursor: string | undefined;
      do {
        const page = await getExecutions({ limit: "200", ...(cursor ? { cursor } : {}) });
        const list = page.list ?? [];
        let allBeforeToday = true;
        for (const e of list) {
          if (Number(e.execTime) >= todayStartMs) {
            todayVolume += parseFloat(e.execPrice) * parseFloat(e.execQty);
            allBeforeToday = false;
          }
        }
        cursor = page.nextPageCursor || undefined;
        // 이전 날짜 체결만 나오면 더 이상 페이지네이션 불필요
        if (allBeforeToday) break;
      } while (cursor);
      if (currentEquity > 0) {
        dailyTurnover = todayVolume / currentEquity;
      }
    } catch {
      // non-critical, leave as 0
    }

    // Return ONLY percentages — no absolute amounts
    return NextResponse.json({
      changePercent,
      unrealisedPnlPercent: currentEquity > 0 ? unrealisedPnl / currentEquity : 0,
      dailyTurnover,
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
