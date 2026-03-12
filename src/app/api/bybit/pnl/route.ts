import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClosedPnl } from "@/lib/bybit/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || undefined;
  const limit = searchParams.get("limit") || "50";

  try {
    const result = await getClosedPnl({ symbol, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Bybit PnL error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PnL" },
      { status: 500 }
    );
  }
}
