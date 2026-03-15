import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMonthlyReturns } from "@/lib/daily-returns";
import type { MonthlyReturn } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const monthly = await getMonthlyReturns();

    const returns: MonthlyReturn[] = monthly.map((m) => ({
      year: m.year,
      month: m.month,
      return: parseFloat(m.returnPct.toFixed(2)),
    }));

    return NextResponse.json({ returns });
  } catch (error) {
    console.error("Monthly returns error:", error);
    return NextResponse.json(
      { error: "Failed to calculate monthly returns" },
      { status: 500 }
    );
  }
}
