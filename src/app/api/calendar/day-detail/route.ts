import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClosedPnl } from "@/lib/bybit/client";
import type { BybitClosedPnl } from "@/types";

export interface DayTrade {
  symbol: string;
  side: "Buy" | "Sell";
  entryPrice: number;
  exitPrice: number;
  qty: number;
  closedPnl: number;
  closedPnlPct: number;
  closedAt: string; // ISO string
}

export interface DayDetailResponse {
  date: string; // YYYY-MM-DD
  tradeCount: number;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  trades: DayTrade[];
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD" }, { status: 400 });
  }

  const [yearStr, monthStr, dayStr] = dateParam.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0)); // exclusive

  const startTime = String(dayStart.getTime());
  const endTime = String(dayEnd.getTime() - 1);

  try {
    const allPnl: BybitClosedPnl[] = [];
    let cursor: string | undefined;
    do {
      const page = await getClosedPnl({
        limit: "200",
        startTime,
        endTime,
        ...(cursor ? { cursor } : {}),
      });
      allPnl.push(...page.list);
      cursor = page.nextPageCursor || undefined;
    } while (cursor);

    const trades: DayTrade[] = allPnl.map((record) => {
      const pnl = parseFloat(record.closedPnl);
      const entry = parseFloat(record.entryPrice);
      const exit = parseFloat(record.exitPrice);
      const qty = parseFloat(record.qty);
      const pnlPct = entry !== 0 ? (pnl / (entry * qty)) * 100 : 0;

      return {
        symbol: record.symbol.replace(/USDT$/, ""),
        side: record.side,
        entryPrice: entry,
        exitPrice: exit,
        qty,
        closedPnl: pnl,
        closedPnlPct: parseFloat(pnlPct.toFixed(2)),
        closedAt: new Date(parseInt(record.updatedTime)).toISOString(),
      };
    });

    // Sort by close time descending
    trades.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

    const totalPnl = trades.reduce((sum, t) => sum + t.closedPnl, 0);
    const winCount = trades.filter((t) => t.closedPnl > 0).length;
    const lossCount = trades.filter((t) => t.closedPnl < 0).length;

    const response: DayDetailResponse = {
      date: dateParam,
      tradeCount: trades.length,
      totalPnl: parseFloat(totalPnl.toFixed(4)),
      winCount,
      lossCount,
      trades,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Calendar day-detail error:", error);
    return NextResponse.json({ error: "Failed to load day detail" }, { status: 500 });
  }
}
