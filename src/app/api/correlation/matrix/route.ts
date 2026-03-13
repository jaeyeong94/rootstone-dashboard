import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { getDailyClosePrices } from "@/lib/bybit/kline";
import {
  correlationMatrix,
  rollingCorrelation,
  pricesToReturns,
} from "@/lib/math/correlation";

const ROLLING_WINDOW = 21; // ~1 trading month

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = Math.min(
    Math.max(parseInt(searchParams.get("period") ?? "90", 10), 30),
    365
  );

  try {
    // Fetch BTC and ETH daily close prices + DB snapshots in parallel
    const [btcData, ethData, snapshots] = await Promise.all([
      getDailyClosePrices("BTCUSDT", period + 5),
      getDailyClosePrices("ETHUSDT", period + 5),
      getDb()
        .select({
          snapshotAt: balanceSnapshots.snapshotAt,
          totalEquity: balanceSnapshots.totalEquity,
        })
        .from(balanceSnapshots)
        .orderBy(asc(balanceSnapshots.snapshotAt)),
    ]);

    // Build daily equity map from DB snapshots (last snapshot per day)
    const equityByDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = new Date(s.snapshotAt).toISOString().split("T")[0];
      equityByDay.set(day, s.totalEquity);
    }

    // Align all three assets on common dates
    const btcByDate = new Map(btcData.map((d) => [d.time, d.close]));
    const ethByDate = new Map(ethData.map((d) => [d.time, d.close]));

    // Build set of dates where all three data sources have values
    // For Rebeta we need consecutive days to compute returns
    const equityDays = Array.from(equityByDay.keys()).sort();

    // Collect dates that exist in all three sources, limited to last `period` days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const commonDates: string[] = [];
    const btcPrices: number[] = [];
    const ethPrices: number[] = [];
    const rebetaEquity: number[] = [];

    for (const day of equityDays) {
      if (day < cutoff) continue;
      const btcClose = btcByDate.get(day);
      const ethClose = ethByDate.get(day);
      const equity = equityByDay.get(day);
      if (btcClose !== undefined && ethClose !== undefined && equity !== undefined) {
        commonDates.push(day);
        btcPrices.push(btcClose);
        ethPrices.push(ethClose);
        rebetaEquity.push(equity);
      }
    }

    // Convert to daily returns
    const btcReturns = pricesToReturns(btcPrices);
    const ethReturns = pricesToReturns(ethPrices);
    const rebetaReturns = pricesToReturns(rebetaEquity);
    const returnDates = commonDates.slice(1);

    // Full-period correlation matrix: [Rebeta, BTC, ETH]
    const matrix = correlationMatrix([rebetaReturns, btcReturns, ethReturns]);

    // Rolling correlation (21-day window)
    const window = Math.min(ROLLING_WINDOW, Math.floor(returnDates.length / 2));
    const rollingBtc = rollingCorrelation(rebetaReturns, btcReturns, returnDates, window);
    const rollingEth = rollingCorrelation(rebetaReturns, ethReturns, returnDates, window);

    // Merge rolling results by time
    const rollingByTime = new Map(rollingBtc.map((p) => [p.time, { rebetaBtc: p.value }]));
    for (const p of rollingEth) {
      const entry = rollingByTime.get(p.time);
      if (entry) {
        (entry as { rebetaBtc: number; rebetaEth?: number }).rebetaEth = p.value;
      }
    }

    const rollingCorrelationData = Array.from(rollingByTime.entries())
      .filter(([, v]) => (v as { rebetaBtc: number; rebetaEth?: number }).rebetaEth !== undefined)
      .map(([time, v]) => {
        const val = v as { rebetaBtc: number; rebetaEth: number };
        return {
          time,
          rebetaBtc: Math.round(val.rebetaBtc * 10000) / 10000,
          rebetaEth: Math.round(val.rebetaEth * 10000) / 10000,
        };
      });

    // Round matrix values
    const roundedMatrix = matrix.map((row) =>
      row.map((v) => Math.round(v * 10000) / 10000)
    );

    return NextResponse.json({
      period: `${period}d`,
      assets: ["Rebeta", "BTC", "ETH"],
      matrix: roundedMatrix,
      rollingCorrelation: rollingCorrelationData,
    });
  } catch (error) {
    console.error("Correlation matrix error:", error);
    return NextResponse.json(
      { error: "Failed to calculate correlation matrix" },
      { status: 500 }
    );
  }
}
