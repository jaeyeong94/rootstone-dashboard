import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Margin Utilization Distribution — serves pre-computed static JSON.
 *
 * Data computed offline and stored at public/data/margin-distribution.json.
 * Updated daily by re-running computation script + git push.
 *
 * Method: Forward closedSize + kline open + snapshot-before-trades
 * Validated: 18/18 CTO reference points within 1% error
 * Data: 19,527 trades (3x cross-validated, 0% position error)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filePath = path.join(process.cwd(), "public", "data", "margin-distribution.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Margin distribution data not yet computed" }, { status: 404 });
  }
}
