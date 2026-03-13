import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExecutions } from "@/lib/bybit/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || undefined;
  const limit = searchParams.get("limit") || "50";
  const cursor = searchParams.get("cursor") || undefined;

  try {
    const result = await getExecutions({ symbol, limit, cursor });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Bybit executions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
