import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance, getPositions } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { gte, asc } from "drizzle-orm";

const MAX_POSITIONS = 4;
const MAX_GROSS_EXPOSURE = 3; // x multiplier
const MAX_MONTHLY_DRAWDOWN = -0.10; // -10%
const MAX_HOLDING_HOURS = 24;

export interface RiskMetrics {
  grossExposure: number;       // Σ|positionValue| / totalEquity (multiplier)
  netExposure: number;         // (Σ longValue - Σ shortValue) / totalEquity
  positionCount: number;
  maxPositions: number;
  avgLeverage: number;         // weighted average by positionValue
  monthlyDrawdown: number;     // fraction, negative (e.g. -0.05 = -5%)
  longestHoldingHours: number; // max holding time among open positions
  concentrations: { symbol: string; weight: number }[]; // weight = |posValue|/grossValue
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [balanceResult, positionsResult] = await Promise.all([
      getWalletBalance(),
      getPositions(),
    ]);

    const account = balanceResult.list?.[0];
    if (!account) {
      return NextResponse.json({ error: "No account data" }, { status: 404 });
    }

    const totalEquity = parseFloat(account.totalEquity);

    // Filter only positions with non-zero size
    const openPositions = positionsResult.list.filter(
      (p) => parseFloat(p.size) > 0
    );

    // Exposure calculations
    let sumAbsPositionValue = 0;
    let sumLongValue = 0;
    let sumShortValue = 0;
    let weightedLeverageSum = 0;
    let longestHoldingHours = 0;

    for (const pos of openPositions) {
      const absValue = Math.abs(parseFloat(pos.positionValue));
      const leverage = parseFloat(pos.leverage);

      sumAbsPositionValue += absValue;

      if (pos.side === "Buy") {
        sumLongValue += absValue;
      } else {
        sumShortValue += absValue;
      }

      weightedLeverageSum += absValue * leverage;

      if (pos.createdTime) {
        const holdingHours =
          (Date.now() - parseInt(pos.createdTime)) / (1000 * 60 * 60);
        if (holdingHours > longestHoldingHours) {
          longestHoldingHours = holdingHours;
        }
      }
    }

    const grossExposure =
      totalEquity > 0 ? sumAbsPositionValue / totalEquity : 0;
    const netExposure =
      totalEquity > 0 ? (sumLongValue - sumShortValue) / totalEquity : 0;
    const avgLeverage =
      sumAbsPositionValue > 0
        ? weightedLeverageSum / sumAbsPositionValue
        : 0;

    // Per-symbol concentration (weight relative to total gross value)
    const concentrations: { symbol: string; weight: number }[] = openPositions
      .map((pos) => ({
        symbol: pos.symbol.replace("USDT", ""),
        weight:
          sumAbsPositionValue > 0
            ? Math.abs(parseFloat(pos.positionValue)) / sumAbsPositionValue
            : 0,
      }))
      .sort((a, b) => b.weight - a.weight);

    // Monthly drawdown: first snapshot of current calendar month vs current equity
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthlyDrawdown = 0;
    try {
      const db = getDb();
      const monthRows = await db
        .select({
          totalEquity: balanceSnapshots.totalEquity,
          snapshotAt: balanceSnapshots.snapshotAt,
        })
        .from(balanceSnapshots)
        .where(gte(balanceSnapshots.snapshotAt, monthStart))
        .orderBy(asc(balanceSnapshots.snapshotAt))
        .limit(1);

      const monthStartSnapshot = monthRows[0];
      if (monthStartSnapshot && monthStartSnapshot.totalEquity > 0) {
        monthlyDrawdown =
          (totalEquity - monthStartSnapshot.totalEquity) /
          monthStartSnapshot.totalEquity;
      }
    } catch {
      // DB query failure — monthly drawdown stays 0
    }

    const metrics: RiskMetrics = {
      grossExposure: parseFloat(grossExposure.toFixed(4)),
      netExposure: parseFloat(netExposure.toFixed(4)),
      positionCount: openPositions.length,
      maxPositions: MAX_POSITIONS,
      avgLeverage: parseFloat(avgLeverage.toFixed(2)),
      monthlyDrawdown: parseFloat(monthlyDrawdown.toFixed(4)),
      longestHoldingHours: parseFloat(longestHoldingHours.toFixed(1)),
      concentrations,
    };

    return NextResponse.json({
      ...metrics,
      // Risk parameter limits (for client-side status evaluation)
      limits: {
        maxGrossExposure: MAX_GROSS_EXPOSURE,
        maxMonthlyDrawdown: MAX_MONTHLY_DRAWDOWN,
        maxHoldingHours: MAX_HOLDING_HOURS,
      },
    });
  } catch (error) {
    console.error("Risk metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate risk metrics" },
      { status: 500 }
    );
  }
}
