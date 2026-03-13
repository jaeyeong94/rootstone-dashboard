import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthHeadersWithQuery } from "@/lib/bybit/signing";

const BASE = "https://api.bybit.com";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: Record<string, unknown> = {};

  // 1) 퍼블릭 API 테스트
  try {
    const res = await fetch(`${BASE}/v5/market/time`, { cache: "no-store" });
    const text = await res.text();
    results.publicApi = { status: res.status, body: text.slice(0, 300) };
  } catch (e) {
    results.publicApi = { error: String(e) };
  }

  // 2) 인증 API 테스트
  try {
    const qs = new URLSearchParams({ accountType: "UNIFIED" }).toString();
    const headers = getAuthHeadersWithQuery(qs);
    const res = await fetch(`${BASE}/v5/account/wallet-balance?${qs}`, {
      headers,
      cache: "no-store",
    });
    const text = await res.text();
    results.privateApi = { status: res.status, body: text.slice(0, 500) };
  } catch (e) {
    results.privateApi = { error: String(e) };
  }

  // 3) 환경변수 확인 (키 앞 4자리만)
  results.envCheck = {
    BYBIT_API_KEY: process.env.BYBIT_API_KEY
      ? process.env.BYBIT_API_KEY.slice(0, 4) + "..."
      : "MISSING",
    BYBIT_API_SECRET: process.env.BYBIT_API_SECRET ? "SET" : "MISSING",
  };

  return NextResponse.json(results);
}
