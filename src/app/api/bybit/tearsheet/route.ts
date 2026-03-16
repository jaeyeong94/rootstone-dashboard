import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyReturns, getMonthlyReturns } from "@/lib/daily-returns";
import {
  calcSharpeRatio,
  calcSortinoRatio,
  calcMaxDrawdown,
} from "@/lib/utils";
import {
  realizedVolatility,
  historicalVaR,
  conditionalVaR,
} from "@/lib/math/statistics";
import { CALENDAR_DAYS_PER_YEAR } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Comprehensive tearsheet API — ALL metrics computed from daily_returns DB.
 * Third parties can reproduce these results using the same daily return series.
 *
 * Returns: main metrics, risk metrics, period returns, worst drawdowns,
 * yearly returns, monthly stats — all live from DB.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await getDailyReturns();
    if (rows.length < 2) {
      return NextResponse.json({ error: "Insufficient data" }, { status: 404 });
    }

    const returns = rows.map((r) => r.dailyReturn);
    const navSeries = rows.map((r) => r.navIndex);
    const dates = rows.map((r) => r.date);
    const n = returns.length;
    const startDate = dates[0];
    const endDate = dates[n - 1];
    const totalDays = n;

    // ── Main Metrics ──
    const totalReturn = (navSeries[n - 1] / navSeries[0] - 1) * 100;
    const years = totalDays / CALENDAR_DAYS_PER_YEAR;
    const cagr = (Math.pow(navSeries[n - 1] / navSeries[0], 1 / years) - 1) * 100;
    const sharpe = calcSharpeRatio(returns);
    const sortino = calcSortinoRatio(returns);
    const maxDrawdown = calcMaxDrawdown(navSeries) * 100;
    const volatility = realizedVolatility(returns) * 100;
    const calmar = maxDrawdown !== 0 ? cagr / Math.abs(maxDrawdown) : 0;

    // Max drawdown duration
    let peak = navSeries[0];
    let inDrawdown = false;
    let maxDDDuration = 0;
    let currentDDDuration = 0;
    for (let i = 0; i < n; i++) {
      if (navSeries[i] > peak) {
        peak = navSeries[i];
        if (inDrawdown) {
          maxDDDuration = Math.max(maxDDDuration, currentDDDuration);
          inDrawdown = false;
        }
        currentDDDuration = 0;
      } else {
        if (!inDrawdown) {
          inDrawdown = true;
        }
        currentDDDuration++;
      }
    }
    if (inDrawdown) maxDDDuration = Math.max(maxDDDuration, currentDDDuration);

    // ── Risk Metrics ──
    const var95 = historicalVaR(returns, 0.95) * 100;
    const var99 = historicalVaR(returns, 0.99) * 100;
    const cvar95 = conditionalVaR(returns, 0.95) * 100;
    const cvar99 = conditionalVaR(returns, 0.99) * 100;

    // Omega ratio: sum of gains / |sum of losses|
    let gainSum = 0, lossSum = 0;
    for (const r of returns) {
      if (r > 0) gainSum += r;
      else lossSum += Math.abs(r);
    }
    const omega = lossSum > 0 ? gainSum / lossSum : 0;

    // Tail ratio: 95th percentile gain / |5th percentile loss|
    const sorted = [...returns].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(n * 0.05)] ?? 0;
    const p95 = sorted[Math.floor(n * 0.95)] ?? 0;
    const tailRatio = p5 !== 0 ? Math.abs(p95 / p5) : 0;

    // ── Period Returns ──
    const today = new Date();
    function periodReturn(daysBack: number): number {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - daysBack);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      const filtered = rows.filter((r) => r.date >= cutoffStr);
      if (filtered.length < 2) return 0;
      return (filtered[filtered.length - 1].navIndex / filtered[0].navIndex - 1) * 100;
    }

    // MTD
    const mtdCutoff = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const mtdRows = rows.filter((r) => r.date >= mtdCutoff);
    const mtdReturn = mtdRows.length >= 2
      ? (mtdRows[mtdRows.length - 1].navIndex / mtdRows[0].navIndex - 1) * 100 : 0;

    // YTD
    const ytdCutoff = `${today.getUTCFullYear()}-01-01`;
    const ytdRows = rows.filter((r) => r.date >= ytdCutoff);
    const ytdReturn = ytdRows.length >= 2
      ? (ytdRows[ytdRows.length - 1].navIndex / ytdRows[0].navIndex - 1) * 100 : 0;

    // Best/Worst day
    let bestDay = { date: "", value: -Infinity };
    let worstDay = { date: "", value: Infinity };
    for (let i = 0; i < n; i++) {
      if (returns[i] > bestDay.value) bestDay = { date: dates[i], value: returns[i] };
      if (returns[i] < worstDay.value) worstDay = { date: dates[i], value: returns[i] };
    }

    // ── Monthly Returns + Best/Worst Month + Monthly Stats ──
    const monthly = await getMonthlyReturns();
    let bestMonth = { key: "", value: -Infinity };
    let worstMonth = { key: "", value: Infinity };
    const profitMonths: number[] = [];
    const lossMonths: number[] = [];

    for (const m of monthly) {
      const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
      if (m.returnPct > bestMonth.value) bestMonth = { key, value: m.returnPct };
      if (m.returnPct < worstMonth.value) worstMonth = { key, value: m.returnPct };
      if (m.returnPct > 0) profitMonths.push(m.returnPct);
      else if (m.returnPct < 0 || Object.is(m.returnPct, -0)) lossMonths.push(m.returnPct);
    }

    const avgProfitMonth = profitMonths.length > 0
      ? profitMonths.reduce((a, b) => a + b, 0) / profitMonths.length : 0;
    const avgLossMonth = lossMonths.length > 0
      ? lossMonths.reduce((a, b) => a + b, 0) / lossMonths.length : 0;
    const avgAllMonths = monthly.length > 0
      ? monthly.reduce((s, m) => s + m.returnPct, 0) / monthly.length : 0;

    // ── Yearly Returns (compounded from monthly) ──
    const yearlyMap = new Map<number, number[]>();
    for (const m of monthly) {
      const arr = yearlyMap.get(m.year) || [];
      arr.push(m.returnPct);
      yearlyMap.set(m.year, arr);
    }

    const yearlyReturns = Array.from(yearlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, monthlyRets]) => {
        const compounded = monthlyRets.reduce((mul, r) => mul * (1 + r / 100), 1);
        return { year, return: parseFloat(((compounded - 1) * 100).toFixed(1)) };
      });

    // Best/Worst year
    let bestYear = { year: 0, value: -Infinity };
    let worstYear = { year: 0, value: Infinity };
    for (const y of yearlyReturns) {
      if (y.return > bestYear.value) bestYear = { year: y.year, value: y.return };
      if (y.return < worstYear.value) worstYear = { year: y.year, value: y.return };
    }

    // ── Worst Drawdowns (Top 10) ──
    const drawdowns: { rank: number; started: string; recovered: string; dd: number; days: number }[] = [];
    {
      let pk = navSeries[0];
      let pkIdx = 0;
      let trough = navSeries[0];
      let troughIdx = 0;
      const ddEvents: { startIdx: number; troughIdx: number; endIdx: number; dd: number }[] = [];
      let inDD = false;

      for (let i = 1; i < n; i++) {
        if (navSeries[i] >= pk) {
          if (inDD) {
            ddEvents.push({ startIdx: pkIdx, troughIdx, endIdx: i, dd: (trough - pk) / pk });
            inDD = false;
          }
          pk = navSeries[i];
          pkIdx = i;
          trough = navSeries[i];
          troughIdx = i;
        } else {
          inDD = true;
          if (navSeries[i] < trough) {
            trough = navSeries[i];
            troughIdx = i;
          }
        }
      }
      // Still in drawdown at end of series
      if (inDD) {
        ddEvents.push({ startIdx: pkIdx, troughIdx, endIdx: n - 1, dd: (trough - pk) / pk });
      }

      ddEvents.sort((a, b) => a.dd - b.dd);
      for (let i = 0; i < Math.min(10, ddEvents.length); i++) {
        const ev = ddEvents[i];
        const recovered = ev.endIdx < n - 1 || navSeries[ev.endIdx] >= navSeries[ev.startIdx];
        drawdowns.push({
          rank: i + 1,
          started: dates[ev.startIdx],
          recovered: recovered ? dates[ev.endIdx] : "ongoing",
          dd: parseFloat((ev.dd * 100).toFixed(2)),
          days: ev.endIdx - ev.startIdx,
        });
      }
    }

    return NextResponse.json({
      dataRange: { start: startDate, end: endDate, days: totalDays },
      mainMetrics: {
        cumulativeReturn: parseFloat(totalReturn.toFixed(1)),
        cagr: parseFloat(cagr.toFixed(1)),
        volatility: parseFloat(volatility.toFixed(1)),
        sharpe: parseFloat(sharpe.toFixed(4)),
        sortino: parseFloat(sortino.toFixed(4)),
        calmar: parseFloat(calmar.toFixed(4)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(1)),
        maxDrawdownDuration: maxDDDuration,
      },
      riskMetrics: {
        var95: parseFloat(var95.toFixed(2)),
        var99: parseFloat(var99.toFixed(2)),
        cvar95: parseFloat(cvar95.toFixed(2)),
        cvar99: parseFloat(cvar99.toFixed(2)),
        omega: parseFloat(omega.toFixed(4)),
        tailRatio: parseFloat(tailRatio.toFixed(4)),
      },
      periodReturns: {
        mtd: parseFloat(mtdReturn.toFixed(1)),
        "3m": parseFloat(periodReturn(90).toFixed(1)),
        "6m": parseFloat(periodReturn(180).toFixed(1)),
        ytd: parseFloat(ytdReturn.toFixed(1)),
        bestDay: { date: bestDay.date, value: parseFloat((bestDay.value * 100).toFixed(1)) },
        worstDay: { date: worstDay.date, value: parseFloat((worstDay.value * 100).toFixed(1)) },
        bestMonth: { key: bestMonth.key, value: parseFloat(bestMonth.value.toFixed(1)) },
        worstMonth: { key: worstMonth.key, value: parseFloat(worstMonth.value.toFixed(1)) },
        bestYear: { year: bestYear.year, value: bestYear.value },
        worstYear: { year: worstYear.year, value: worstYear.value },
      },
      monthlyStats: {
        avgProfitMonth: parseFloat(avgProfitMonth.toFixed(1)),
        avgLossMonth: parseFloat(avgLossMonth.toFixed(1)),
        avgAllMonths: parseFloat(avgAllMonths.toFixed(1)),
        totalMonths: monthly.length,
        profitCount: profitMonths.length,
        lossCount: lossMonths.length,
      },
      yearlyReturns,
      worstDrawdowns: drawdowns,
    });
  } catch (error) {
    console.error("Tearsheet API error:", error);
    return NextResponse.json({ error: "Failed to compute tearsheet" }, { status: 500 });
  }
}
