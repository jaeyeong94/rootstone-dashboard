import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPositions, getWalletBalance, getExecutions } from "@/lib/bybit/client";

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

    // Fetch recent executions to find actual entry time for each open position.
    // Bybit's position.createdTime is the slot creation time (account-level),
    // NOT the current trade's entry time. We look up the earliest execution
    // within the last 25h (Rebeta max hold = 24.5h) matching the position side.
    const entryTimeMap = new Map<string, string>();
    if (openPositions.length > 0) {
      try {
        const execResult = await getExecutions({ limit: "100" });
        const executions = execResult.list || [];
        for (const pos of openPositions) {
          // Find all executions for this symbol+side (entry side)
          const entries = executions
            .filter((e) => e.symbol === pos.symbol && e.side === pos.side)
            .map((e) => parseInt(e.execTime))
            .filter((t) => !isNaN(t));
          if (entries.length > 0) {
            // Earliest execution = position entry time
            entryTimeMap.set(pos.symbol, String(Math.min(...entries)));
          }
        }
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
