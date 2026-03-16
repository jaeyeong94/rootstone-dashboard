import { NextResponse } from "next/server";
import { calcFactsheetNAV } from "@/lib/bybit/client";
import { db as getDb } from "@/lib/db";
import { dailyReturns, navAlerts } from "@/lib/db/schema";
import { desc, and, gte, lte, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily NAV cron — Factsheet 방법론 준수
 *
 * 매일 UTC 00:05에 실행:
 * 1. 갭 감지: 마지막 기록일과 오늘 사이에 누락일이 있는지 확인
 * 2. 갭이 있으면 alert 기록 (누락일은 별도 rebuild API로 복구)
 * 3. 당일 NAV 계산: kline daily open price 기반 (fallback 없음)
 * 4. API 실패 시 alert 기록 후 중단 (가짜 데이터 기록 안 함)
 *
 * 제3자 재현 가능성: 동일한 Bybit Read API로 같은 결과 산출 가능
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const database = getDb();
  const today = new Date().toISOString().split("T")[0];

  try {
    // Dedup: skip if today already recorded
    const existing = await database
      .select()
      .from(dailyReturns)
      .where(and(gte(dailyReturns.date, today), lte(dailyReturns.date, today)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        skipped: true,
        reason: "Today's daily return already exists",
        date: today,
      });
    }

    // ── Gap Detection ──
    const prevRow = await database
      .select()
      .from(dailyReturns)
      .orderBy(desc(dailyReturns.date))
      .limit(1);

    if (prevRow.length === 0) {
      return NextResponse.json({ error: "No previous daily return found — run initial data load first" }, { status: 404 });
    }

    const lastRecordedDate = prevRow[0].date;
    const gapDays = getDateGap(lastRecordedDate, today);

    if (gapDays.length > 0) {
      // Record gap alert — do NOT silently skip
      const gapMsg = `Gap detected: ${gapDays.length} missing day(s) between ${lastRecordedDate} and ${today}: [${gapDays.join(", ")}]. Use /api/admin/rebuild-nav to recover.`;
      console.warn(`[daily-nav] ${gapMsg}`);

      await database.insert(navAlerts).values({
        date: today,
        type: "gap_detected",
        message: gapMsg,
      });
    }

    // ── NAV Calculation (kline open only, no fallback) ──
    let navResult;
    try {
      navResult = await calcFactsheetNAV();
    } catch (apiError) {
      const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
      console.error(`[daily-nav] API error: ${errorMsg}`);

      await database.insert(navAlerts).values({
        date: today,
        type: "api_error",
        message: `NAV calculation failed: ${errorMsg}`,
      });

      return NextResponse.json({
        error: "NAV calculation failed — API error recorded",
        detail: errorMsg,
        date: today,
        alert: "api_error",
      }, { status: 502 });
    }

    const todayNAV = navResult.nav;

    // ── Daily Return & navIndex ──
    // 분모: 전일 rawNav (kline 기반). rawNav 없으면 에러 (snapshot fallback 금지)
    const prevRawNav = prevRow[0].rawNav;
    if (prevRawNav == null || prevRawNav <= 0) {
      const msg = `Previous day (${lastRecordedDate}) has no rawNav — cannot compute kline-based daily return. Run /api/admin/rebuild-nav to fix historical data.`;
      console.error(`[daily-nav] ${msg}`);

      await database.insert(navAlerts).values({
        date: today,
        type: "api_error",
        message: msg,
      });

      return NextResponse.json({ error: msg, date: today }, { status: 404 });
    }

    const dailyReturn = (todayNAV - prevRawNav) / prevRawNav;
    const prevNavIndex = prevRow[0].navIndex;
    const navIndex = prevNavIndex * (1 + dailyReturn);

    await database.insert(dailyReturns).values({
      date: today,
      navIndex,
      dailyReturn,
      rawNav: todayNAV,
      source: "cron",
    }).onConflictDoNothing({ target: dailyReturns.date });

    // Resolve any pending api_error alerts for today (we succeeded)
    await database.update(navAlerts)
      .set({ resolved: new Date() })
      .where(and(
        eq(navAlerts.date, today),
        eq(navAlerts.type, "api_error"),
      ));

    return NextResponse.json({
      ok: true,
      date: today,
      method: "factsheet_kline_open",
      todayNAV: parseFloat(todayNAV.toFixed(4)),
      yesterdayNAV: parseFloat(prevRawNav.toFixed(4)),
      navIndex: parseFloat(navIndex.toFixed(6)),
      dailyReturn: parseFloat((dailyReturn * 100).toFixed(4)),
      positions: navResult.positions.length,
      gapDays: gapDays.length > 0 ? gapDays : undefined,
      source: "cron",
    });
  } catch (error) {
    console.error("Daily NAV cron error:", error);
    return NextResponse.json(
      { error: "Failed to compute daily NAV" },
      { status: 500 }
    );
  }
}

/**
 * Calculate missing dates between lastDate (exclusive) and targetDate (exclusive).
 * Returns array of "YYYY-MM-DD" strings for gap days.
 */
function getDateGap(lastDate: string, targetDate: string): string[] {
  const gaps: string[] = [];
  const start = new Date(lastDate + "T00:00:00Z");
  const end = new Date(targetDate + "T00:00:00Z");

  const current = new Date(start);
  current.setUTCDate(current.getUTCDate() + 1);

  while (current < end) {
    gaps.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return gaps;
}
