import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPositions, getWalletBalance } from "@/lib/bybit/client";

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
