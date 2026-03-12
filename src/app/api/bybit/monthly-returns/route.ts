import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import type { MonthlyReturn } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshots = await getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt));

    if (snapshots.length < 2) {
      return NextResponse.json({ returns: [] });
    }

    const monthlyMap = new Map<string, { first: number; last: number }>();

    for (const s of snapshots) {
      const date = new Date(s.snapshotAt);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const existing = monthlyMap.get(key);
      if (!existing) {
        monthlyMap.set(key, { first: s.totalEquity, last: s.totalEquity });
      } else {
        existing.last = s.totalEquity;
      }
    }

    const returns: MonthlyReturn[] = [];
    const entries = Array.from(monthlyMap.entries());

    for (let i = 0; i < entries.length; i++) {
      const [key, data] = entries[i];
      const [yearStr, monthStr] = key.split("-");
      const base = i > 0 ? entries[i - 1][1].last : data.first;
      const ret = base > 0 ? ((data.last - base) / base) * 100 : 0;

      returns.push({
        year: parseInt(yearStr),
        month: parseInt(monthStr),
        return: parseFloat(ret.toFixed(2)),
      });
    }

    return NextResponse.json({ returns });
  } catch (error) {
    console.error("Monthly returns error:", error);
    return NextResponse.json(
      { error: "Failed to calculate monthly returns" },
      { status: 500 }
    );
  }
}
