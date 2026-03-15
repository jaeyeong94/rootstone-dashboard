import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCumulativeCurve } from "@/lib/daily-returns";
import type { EquityCurvePoint } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const points = await getCumulativeCurve({ from, to });

    if (points.length === 0) {
      return NextResponse.json({ curve: [], startDate: null });
    }

    const curve: EquityCurvePoint[] = points.map((p) => ({
      time: p.date,
      value: parseFloat(p.value.toFixed(2)),
    }));

    return NextResponse.json({
      curve,
      startDate: points[0].date,
    });
  } catch (error) {
    console.error("Equity curve error:", error);
    return NextResponse.json(
      { error: "Failed to calculate equity curve" },
      { status: 500 }
    );
  }
}
