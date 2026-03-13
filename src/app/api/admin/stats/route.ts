import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { count, min, max, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    const [countResult] = await db
      .select({ total: count() })
      .from(balanceSnapshots);

    const [rangeResult] = await db
      .select({
        oldest: min(balanceSnapshots.snapshotAt),
        latest: max(balanceSnapshots.snapshotAt),
      })
      .from(balanceSnapshots);

    const lastRows = await db
      .select()
      .from(balanceSnapshots)
      .orderBy(desc(balanceSnapshots.snapshotAt))
      .limit(1);

    return NextResponse.json({
      snapshotCount: countResult?.total ?? 0,
      oldestSnapshot: rangeResult?.oldest?.toISOString() ?? null,
      latestSnapshot: rangeResult?.latest?.toISOString() ?? null,
      lastSnapshot: lastRows[0] ?? null,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
