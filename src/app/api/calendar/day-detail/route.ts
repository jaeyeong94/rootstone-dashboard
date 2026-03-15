import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClosedPnl } from "@/lib/bybit/client";
import { getDailyReturns } from "@/lib/daily-returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  try {
    const dayStart = new Date(dateStr + "T00:00:00Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    const [pnlData, rows] = await Promise.all([
      getClosedPnl({
        startTime: String(dayStart.getTime()),
        endTime: String(dayEnd.getTime()),
        limit: "50",
      }),
      getDailyReturns({ from: dateStr, to: dateStr }),
    ]);

    const dailyReturn = rows.length > 0
      ? Math.round(rows[0].dailyReturn * 10000) / 100 // decimal → %
      : 0;

    const trades = pnlData.list.map((t) => {
      const entry = parseFloat(t.avgEntryPrice);
      const exit = parseFloat(t.avgExitPrice);
      const closedPnlPct =
        entry > 0 ? ((exit - entry) / entry) * (t.side === "Buy" ? 1 : -1) * 100 : 0;
      return {
        symbol: t.symbol.replace("USDT", ""),
        side: t.side,
        entryPrice: entry,
        exitPrice: exit,
        closedPnlPct: Math.round(closedPnlPct * 100) / 100,
        closedAt: new Date(parseInt(t.updatedTime)).toISOString(),
      };
    });

    return NextResponse.json({
      date: dateStr,
      dailyReturn,
      trades,
    });
  } catch (error) {
    console.error("Calendar day detail error:", error);
    return NextResponse.json(
      { error: "Failed to load day details" },
      { status: 500 }
    );
  }
}
