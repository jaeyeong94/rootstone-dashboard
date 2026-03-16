import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { navAlerts } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get unresolved NAV alerts for dashboard warning display.
 * Returns only unresolved alerts (resolved=null).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const database = getDb();
    const alerts = await database
      .select()
      .from(navAlerts)
      .where(isNull(navAlerts.resolved))
      .orderBy(desc(navAlerts.createdAt))
      .limit(20);

    return NextResponse.json({
      alerts,
      hasUnresolved: alerts.length > 0,
    });
  } catch (error) {
    console.error("Nav alerts error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
