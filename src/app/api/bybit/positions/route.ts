import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPositions, getWalletBalance, getExecutions, getClosedPnl } from "@/lib/bybit/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [result, walletResult] = await Promise.all([
      getPositions(),
      getWalletBalance(),
    ]);

    // Filter out zero-size positions
    const openPositions = result.list.filter(
      (p) => parseFloat(p.size) > 0
    );

    const totalEquity = parseFloat(walletResult.list?.[0]?.totalEquity ?? "0");

    // Find actual entry time for each open position's current accumulation cycle.
    // Rebeta v3.1: enters every hour, force-closes after 24.5h.
    // Strategy: find the last full close (via Closed PnL), then the earliest
    // entry execution AFTER that close = current cycle start.
    const entryTimeMap = new Map<string, string>();
    if (openPositions.length > 0) {
      try {
        await Promise.all(openPositions.map(async (pos) => {
          const [pnlResult, execResult] = await Promise.all([
            getClosedPnl({ symbol: pos.symbol, limit: "1" }),
            getExecutions({ symbol: pos.symbol, limit: "50" }),
          ]);
          const lastCloseTime = parseInt(pnlResult.list?.[0]?.updatedTime || "0");
          const entries = (execResult.list || [])
            .filter((e) => e.side === pos.side && parseInt(e.execTime) > lastCloseTime)
            .map((e) => parseInt(e.execTime))
            .filter((t) => !isNaN(t));
          if (entries.length > 0) {
            entryTimeMap.set(pos.symbol, String(Math.min(...entries)));
          }
        }));
      } catch {
        // Fallback: entryTimeMap stays empty, frontend will use createdTime
      }
    }

    return NextResponse.json({
      positions: openPositions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.avgPrice,
        markPrice: p.markPrice,
        leverage: p.leverage,
        unrealisedPnl: p.unrealisedPnl,
        cumRealisedPnl: p.cumRealisedPnl,
        liqPrice: p.liqPrice,
        createdTime: p.createdTime,
        updatedTime: p.updatedTime,
        entryTime: entryTimeMap.get(p.symbol) || p.createdTime,
      })),
      count: openPositions.length,
      totalEquity,
    });
  } catch (error) {
    console.error("Bybit positions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
