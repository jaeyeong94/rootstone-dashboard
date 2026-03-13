import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance, getPositions } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [walletData, positionData] = await Promise.all([
      getWalletBalance(),
      getPositions(),
    ]);

    const account = walletData.list[0];
    const totalEquity = parseFloat(account?.totalEquity || "0");
    const positions = positionData.list.filter(
      (p) => parseFloat(p.size) > 0
    );

    // Calculate Gross Exposure = Σ |positionValue| / totalEquity
    let grossLong = 0;
    let grossShort = 0;
    const concentrations: {
      symbol: string;
      weight: number;
      side: "Buy" | "Sell";
      exposure: number;
    }[] = [];

    for (const pos of positions) {
      const value = Math.abs(parseFloat(pos.positionValue));
      if (pos.side === "Buy") {
        grossLong += value;
      } else {
        grossShort += value;
      }
      concentrations.push({
        symbol: pos.symbol.replace("USDT", ""),
        weight: 0, // will recalculate after
        side: pos.side,
        exposure: totalEquity > 0 ? value / totalEquity : 0,
      });
    }

    const grossTotal = grossLong + grossShort;
    const grossExposure = totalEquity > 0 ? grossTotal / totalEquity : 0;
    const netExposure = totalEquity > 0 ? (grossLong - grossShort) / totalEquity : 0;

    // Recalculate weights now that we have grossTotal
    for (const c of concentrations) {
      c.weight = grossTotal > 0 ? (c.exposure * totalEquity) / grossTotal : 0;
    }

    // Average leverage (weighted by position value)
    let avgLeverage = 0;
    if (grossTotal > 0) {
      for (const pos of positions) {
        const value = Math.abs(parseFloat(pos.positionValue));
        avgLeverage += parseFloat(pos.leverage) * (value / grossTotal);
      }
    }

    // Longest holding: find oldest position
    let longestHoldingHours = 0;
    const now = Date.now();
    for (const pos of positions) {
      const created = parseInt(pos.createdTime);
      const hours = (now - created) / (1000 * 60 * 60);
      if (hours > longestHoldingHours) longestHoldingHours = hours;
    }

    // Monthly Drawdown: get first snapshot of current month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const snapshots = await getDb()
      .select({ totalEquity: balanceSnapshots.totalEquity, snapshotAt: balanceSnapshots.snapshotAt })
      .from(balanceSnapshots)
      .orderBy(desc(balanceSnapshots.snapshotAt))
      .limit(200);

    // Find month-start equity
    let monthStartEquity = totalEquity;
    for (const snap of snapshots) {
      if (new Date(snap.snapshotAt) >= monthStart) {
        monthStartEquity = snap.totalEquity;
      }
    }

    const monthlyDrawdown = monthStartEquity > 0
      ? ((totalEquity - monthStartEquity) / monthStartEquity) * 100
      : 0;

    return NextResponse.json({
      grossExposure: Math.round(grossExposure * 1000) / 1000,
      netExposure: Math.round(netExposure * 1000) / 1000,
      maxGrossLimit: 3.0,
      positionCount: positions.length,
      maxPositions: 4,
      avgLeverage: Math.round(avgLeverage * 100) / 100,
      monthlyDrawdown: Math.round(monthlyDrawdown * 100) / 100,
      monthlyDrawdownLimit: -10,
      longestHoldingHours: Math.round(longestHoldingHours * 10) / 10,
      maxHoldingHours: 24,
      concentrations,
    });
  } catch (error) {
    console.error("Risk metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate risk metrics" },
      { status: 500 }
    );
  }
}
