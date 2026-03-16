import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLatestDailyReturn } from "@/lib/daily-returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the latest daily return from daily_returns table.
 * This is the kline-open-based daily return (Factsheet methodology),
 * consistent with how cumulative returns and monthly returns are calculated.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const latest = await getLatestDailyReturn();

    if (!latest) {
      return NextResponse.json({ error: "No daily return data" }, { status: 404 });
    }

    return NextResponse.json({
      date: latest.date,
      dailyReturn: latest.dailyReturn,
      navIndex: latest.navIndex,
    });
  } catch (error) {
    console.error("Latest NAV error:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest NAV" },
      { status: 500 }
    );
  }
}
