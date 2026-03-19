import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import marginData from "@/data/margin-distribution.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Margin Utilization Distribution
 *
 * Serves pre-computed data from bundled JSON.
 * Method: Forward closedSize + kline open + snapshot-before-trades
 * Validated: 18/18 CTO reference points within 1%
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(marginData);
}
