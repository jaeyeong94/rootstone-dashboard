import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenOrders } from "@/lib/bybit/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? undefined;

  try {
    const result = await getOpenOrders(symbol);
    return NextResponse.json({
      orders: result.list.map((o) => ({
        orderId: o.orderId,
        symbol: o.symbol,
        side: o.side,
        price: o.price,
        qty: o.qty,
        orderType: o.orderType,
      })),
    });
  } catch (error) {
    console.error("orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
