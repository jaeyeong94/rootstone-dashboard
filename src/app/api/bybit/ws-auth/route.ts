import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "API keys not configured" }, { status: 500 });
  }

  const expires = Date.now() + 5000;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(`GET/realtime${expires}`)
    .digest("hex");

  return NextResponse.json({ apiKey, expires, signature });
}
