import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns } from "@/lib/daily-returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await getDailyReturns();

    if (rows.length === 0) {
      return NextResponse.json({ series: [] });
    }

    let peak = rows[0].navIndex;
    const series = rows.map((r) => {
      if (r.navIndex > peak) peak = r.navIndex;
      const ts = Math.floor(new Date(r.date + "T00:00:00Z").getTime() / 1000);
      return { time: ts, value: ((r.navIndex - peak) / peak) * 100 };
    });

    return NextResponse.json({ series });
  } catch (error) {
    console.error("Drawdown error:", error);
    return NextResponse.json(
      { error: "Failed to calculate drawdown" },
      { status: 500 }
    );
  }
}
