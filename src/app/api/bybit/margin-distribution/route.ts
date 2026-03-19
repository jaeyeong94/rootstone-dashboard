import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { marginUtilDistribution } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Margin Utilization Distribution — DB read-only.
 * Data is computed by /api/cron/margin-util and stored in DB.
 * This endpoint just serves the latest pre-computed result.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const database = getDb();
    const rows = await database
      .select()
      .from(marginUtilDistribution)
      .orderBy(desc(marginUtilDistribution.updatedAt))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data yet — run /api/cron/margin-util first" }, { status: 404 });
    }

    const data = JSON.parse(rows[0].dataJson);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Margin distribution read error:", error);
    return NextResponse.json({ error: "Failed to read margin distribution" }, { status: 500 });
  }
}
