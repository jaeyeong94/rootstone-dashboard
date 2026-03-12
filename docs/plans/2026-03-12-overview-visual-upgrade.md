# Overview 페이지 비주얼 풀 리디자인 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overview 페이지를 LP 영업용 퀀트펀드 대시보드 수준으로 풀 리디자인 — 10개 새 컴포넌트, 5개 새 API, 라이브 효과 추가

**Architecture:** 기존 Overview 페이지의 6개 컴포넌트를 10개 새 컴포넌트로 교체. 시계열 차트는 Lightweight Charts, 범용 차트는 Recharts(신규). 새 API 엔드포인트 5개가 balance_snapshots + Bybit API에서 메트릭스 계산. 백테스트 데이터는 정적 JSON, 라이브 데이터는 Bybit API.

**Tech Stack:** Next.js 15 (App Router), Lightweight Charts 4.2, Recharts (신규), Zustand 5, SWR 2.3, Tailwind CSS 4, TypeScript

---

## Phase 1: Foundation (기반 세팅)

### Task 1: Recharts 설치 + 새 타입 정의

**Files:**
- Modify: `package.json`
- Modify: `src/types/index.ts`

**Step 1: Recharts 설치**

```bash
pnpm add recharts
```

**Step 2: 새 타입 추가**

`src/types/index.ts` 파일 하단에 추가:

```typescript
// Strategy metrics
export interface StrategyMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgHoldingHours: number;
  totalReturn: number;
  totalTrades: number;
}

// Monthly returns heatmap
export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
}

// Drawdown series
export interface DrawdownPoint {
  time: string; // YYYY-MM-DD
  value: number; // negative percentage
}

// Rolling metrics
export interface RollingMetricPoint {
  time: string;
  value: number;
}

export interface RollingMetricsData {
  sharpe: RollingMetricPoint[];
  volatility: RollingMetricPoint[];
}

// Benchmark
export interface BenchmarkPoint {
  time: string;
  value: number; // cumulative return %
}

// PnL distribution
export interface DailyPnL {
  time: string;
  value: number; // daily return %
}
```

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml src/types/index.ts
git commit -m "feat: recharts 설치 및 차트 관련 타입 정의 추가"
```

---

### Task 2: 유틸리티 함수 + CSS 애니메이션

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `src/app/globals.css`

**Step 1: 계산 유틸리티 함수 추가**

`src/lib/utils.ts` 하단에 추가:

```typescript
/**
 * Calculate Sharpe Ratio from daily returns
 * Sharpe = (mean(returns) - riskFreeRate) / std(returns) * sqrt(365)
 */
export function calcSharpeRatio(dailyReturns: number[], riskFreeRate = 0): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return ((mean - riskFreeRate) / std) * Math.sqrt(365);
}

/**
 * Calculate Sortino Ratio (only downside deviation)
 */
export function calcSortinoRatio(dailyReturns: number[], riskFreeRate = 0): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const downsideReturns = dailyReturns.filter((r) => r < riskFreeRate);
  if (downsideReturns.length === 0) return 0;
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + (r - riskFreeRate) ** 2, 0) / downsideReturns.length;
  const downsideStd = Math.sqrt(downsideVariance);
  if (downsideStd === 0) return 0;
  return ((mean - riskFreeRate) / downsideStd) * Math.sqrt(365);
}

/**
 * Calculate max drawdown from equity series
 * Returns negative percentage (e.g., -0.15 = -15%)
 */
export function calcMaxDrawdown(equitySeries: number[]): number {
  if (equitySeries.length < 2) return 0;
  let peak = equitySeries[0];
  let maxDd = 0;
  for (const equity of equitySeries) {
    if (equity > peak) peak = equity;
    const dd = (equity - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

/**
 * Calculate drawdown series from equity series
 */
export function calcDrawdownSeries(equitySeries: { time: string; equity: number }[]): { time: string; value: number }[] {
  if (equitySeries.length === 0) return [];
  let peak = equitySeries[0].equity;
  return equitySeries.map((point) => {
    if (point.equity > peak) peak = point.equity;
    return { time: point.time, value: ((point.equity - peak) / peak) * 100 };
  });
}

/**
 * Calculate daily returns from equity series
 */
export function calcDailyReturns(equitySeries: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equitySeries.length; i++) {
    returns.push((equitySeries[i] - equitySeries[i - 1]) / equitySeries[i - 1]);
  }
  return returns;
}

/**
 * Calculate rolling metric over a window
 */
export function calcRollingValues(
  dailyReturns: number[],
  times: string[],
  window: number,
  calcFn: (returns: number[]) => number
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = window; i <= dailyReturns.length; i++) {
    const slice = dailyReturns.slice(i - window, i);
    result.push({ time: times[i], value: calcFn(slice) });
  }
  return result;
}
```

**Step 2: CSS 애니메이션 추가**

`src/app/globals.css` 하단에 추가:

```css
/* Tick flash animation - price change highlight */
@keyframes tick-flash-up {
  0% { color: var(--color-pnl-positive); }
  100% { color: inherit; }
}

@keyframes tick-flash-down {
  0% { color: var(--color-pnl-negative); }
  100% { color: inherit; }
}

.tick-up {
  animation: tick-flash-up 0.3s ease-out;
}

.tick-down {
  animation: tick-flash-down 0.3s ease-out;
}

/* Slide-in animation for new trades */
@keyframes slide-in-top {
  0% {
    opacity: 0;
    transform: translateY(-12px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slide-in-top 0.4s ease-out;
}

/* Count-up number transition */
.count-up {
  transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Glow effect for hero number */
.glow-gold {
  text-shadow: 0 0 20px rgba(197, 160, 73, 0.3);
}

/* Heatmap cell hover */
.heatmap-cell {
  transition: opacity 0.15s ease;
}

.heatmap-cell:hover {
  opacity: 0.8;
}

/* Backtest/Live transition marker */
.chart-marker-live {
  border-left: 1px dashed var(--color-bronze);
}
```

**Step 3: Commit**

```bash
git add src/lib/utils.ts src/app/globals.css
git commit -m "feat: 차트 계산 유틸리티 함수 및 라이브 효과 CSS 애니메이션 추가"
```

---

## Phase 2: API Layer (새 엔드포인트)

### Task 3: GET /api/bybit/metrics — 전략 핵심 지표 API

**Files:**
- Create: `src/app/api/bybit/metrics/route.ts`

**Context:**
- `balance_snapshots` 테이블에서 equity 시계열 조회 → daily returns 계산 → Sharpe, Sortino, MDD 등 산출
- `getClosedPnl` 에서 win rate, 평균 홀딩 시간 계산
- 기존 패턴: `src/app/api/bybit/equity-curve/route.ts` 참고

**Step 1: API 라우트 생성**

```typescript
// src/app/api/bybit/metrics/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { getClosedPnl } from "@/lib/bybit/client";
import {
  calcSharpeRatio,
  calcSortinoRatio,
  calcMaxDrawdown,
  calcDailyReturns,
} from "@/lib/utils";
import type { StrategyMetrics } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get equity series from snapshots
    const snapshots = getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt))
      .all();

    const equities = snapshots.map((s) => s.totalEquity);
    const dailyReturns = calcDailyReturns(equities);

    // Calculate metrics
    const sharpeRatio = calcSharpeRatio(dailyReturns);
    const sortinoRatio = calcSortinoRatio(dailyReturns);
    const maxDrawdown = calcMaxDrawdown(equities);
    const totalReturn =
      equities.length >= 2
        ? (equities[equities.length - 1] - equities[0]) / equities[0]
        : 0;

    // Get closed PnL for win rate
    let winRate = 0;
    let totalTrades = 0;
    let avgHoldingHours = 0;

    try {
      const pnlData = await getClosedPnl({ limit: "200" });
      const trades = pnlData.list;
      totalTrades = trades.length;

      if (totalTrades > 0) {
        const wins = trades.filter((t) => parseFloat(t.closedPnl) > 0).length;
        winRate = wins / totalTrades;

        // Average holding time (createdTime to updatedTime)
        const holdingTimes = trades
          .map((t) => {
            const created = parseInt(t.createdTime);
            const updated = parseInt(t.updatedTime);
            return (updated - created) / (1000 * 60 * 60); // hours
          })
          .filter((h) => h > 0 && h < 24 * 365); // filter outliers

        avgHoldingHours =
          holdingTimes.length > 0
            ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length
            : 0;
      }
    } catch {
      // If PnL API fails, continue with calculated metrics
    }

    const metrics: StrategyMetrics = {
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
      winRate: parseFloat((winRate * 100).toFixed(1)),
      avgHoldingHours: parseFloat(avgHoldingHours.toFixed(1)),
      totalReturn: parseFloat((totalReturn * 100).toFixed(2)),
      totalTrades,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Metrics calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate metrics" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/bybit/metrics/route.ts
git commit -m "feat: 전략 핵심 지표 API 추가 (Sharpe, Sortino, MDD, WinRate)"
```

---

### Task 4: GET /api/bybit/monthly-returns — 월별 수익률 히트맵 데이터

**Files:**
- Create: `src/app/api/bybit/monthly-returns/route.ts`

**Step 1: API 라우트 생성**

```typescript
// src/app/api/bybit/monthly-returns/route.ts
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
    const snapshots = getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt))
      .all();

    if (snapshots.length < 2) {
      return NextResponse.json({ returns: [] });
    }

    // Group snapshots by month, take first and last of each month
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

    // Calculate monthly returns
    const returns: MonthlyReturn[] = [];
    const entries = Array.from(monthlyMap.entries());

    for (let i = 0; i < entries.length; i++) {
      const [key, data] = entries[i];
      const [yearStr, monthStr] = key.split("-");
      // Use previous month's last equity as base, or this month's first
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
```

**Step 2: Commit**

```bash
git add src/app/api/bybit/monthly-returns/route.ts
git commit -m "feat: 월별 수익률 히트맵 API 추가"
```

---

### Task 5: GET /api/bybit/drawdown — 드로다운 시계열

**Files:**
- Create: `src/app/api/bybit/drawdown/route.ts`

**Step 1: API 라우트 생성**

```typescript
// src/app/api/bybit/drawdown/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { calcDrawdownSeries } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshots = getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt))
      .all();

    if (snapshots.length === 0) {
      return NextResponse.json({ series: [] });
    }

    const equitySeries = snapshots.map((s) => ({
      time: new Date(s.snapshotAt).toISOString().split("T")[0],
      equity: s.totalEquity,
    }));

    const series = calcDrawdownSeries(equitySeries);

    return NextResponse.json({ series });
  } catch (error) {
    console.error("Drawdown error:", error);
    return NextResponse.json(
      { error: "Failed to calculate drawdown" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/bybit/drawdown/route.ts
git commit -m "feat: 드로다운 시계열 API 추가"
```

---

### Task 6: GET /api/bybit/benchmark — BTC 벤치마크 데이터

**Files:**
- Create: `src/app/api/bybit/benchmark/route.ts`

**Context:**
- Bybit Public API: `GET /v5/market/kline` (인증 불필요)
- 일봉 데이터로 BTC 누적 수익률 계산
- 서버 사이드에서 호출하여 클라이언트에 전달

**Step 1: API 라우트 생성**

```typescript
// src/app/api/bybit/benchmark/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { BenchmarkPoint } from "@/types";

const BYBIT_PUBLIC = "https://api.bybit.com";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = "D"; // Daily
  const limit = searchParams.get("limit") || "365";

  try {
    // Bybit kline: [startTime, open, high, low, close, volume, turnover]
    const url = `${BYBIT_PUBLIC}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour
    const data = await res.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit kline error: ${data.retMsg}`);
    }

    const klines: string[][] = data.result.list || [];

    if (klines.length === 0) {
      return NextResponse.json({ series: [] });
    }

    // Klines are in reverse chronological order, flip them
    const sorted = [...klines].reverse();
    const firstClose = parseFloat(sorted[0][4]);

    const series: BenchmarkPoint[] = sorted.map((k) => ({
      time: new Date(parseInt(k[0])).toISOString().split("T")[0],
      value: ((parseFloat(k[4]) - firstClose) / firstClose) * 100,
    }));

    return NextResponse.json({ series, symbol });
  } catch (error) {
    console.error("Benchmark error:", error);
    return NextResponse.json(
      { error: "Failed to fetch benchmark data" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/bybit/benchmark/route.ts
git commit -m "feat: BTC 벤치마크 데이터 API 추가 (Bybit Public kline)"
```

---

### Task 7: GET /api/bybit/rolling-metrics — 롤링 Sharpe/변동성

**Files:**
- Create: `src/app/api/bybit/rolling-metrics/route.ts`

**Step 1: API 라우트 생성**

```typescript
// src/app/api/bybit/rolling-metrics/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db as getDb } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import {
  calcDailyReturns,
  calcSharpeRatio,
  calcRollingValues,
} from "@/lib/utils";

function calcVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365) * 100; // annualized %
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const window = parseInt(searchParams.get("window") || "30");

  try {
    const snapshots = getDb()
      .select()
      .from(balanceSnapshots)
      .orderBy(asc(balanceSnapshots.snapshotAt))
      .all();

    if (snapshots.length < window + 1) {
      return NextResponse.json({ sharpe: [], volatility: [] });
    }

    const equities = snapshots.map((s) => s.totalEquity);
    const times = snapshots.map(
      (s) => new Date(s.snapshotAt).toISOString().split("T")[0]
    );
    const dailyReturns = calcDailyReturns(equities);
    // times for dailyReturns starts at index 1
    const returnTimes = times.slice(1);

    const sharpe = calcRollingValues(
      dailyReturns,
      returnTimes,
      window,
      calcSharpeRatio
    );
    const volatility = calcRollingValues(
      dailyReturns,
      returnTimes,
      window,
      calcVolatility
    );

    return NextResponse.json({ sharpe, volatility });
  } catch (error) {
    console.error("Rolling metrics error:", error);
    return NextResponse.json(
      { error: "Failed to calculate rolling metrics" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/bybit/rolling-metrics/route.ts
git commit -m "feat: 롤링 Sharpe/변동성 시계열 API 추가"
```

---

## Phase 3: Components (10개 새 컴포넌트)

### Task 8: HeroStats — 누적 수익률 히어로 + 스파크라인

**Files:**
- Create: `src/components/dashboard/HeroStats.tsx`
- Create: `src/hooks/useCountUp.ts`

**Context:**
- 왼쪽: 누적 수익률 큰 숫자 (48px, JetBrains Mono, gold glow) + 기간 토글
- Recharts 미니 스파크라인 (최근 30일)
- 로드 시 0 → 목표값 카운팅 애니메이션
- SWR로 `/api/bybit/equity-curve` 데이터 사용

**Step 1: useCountUp 훅 생성**

```typescript
// src/hooks/useCountUp.ts
"use client";

import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration = 1000): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}
```

**Step 2: HeroStats 컴포넌트 생성**

```tsx
// src/components/dashboard/HeroStats.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "24h" | "7d" | "30d" | "ALL";

export function HeroStats() {
  const [period, setPeriod] = useState<Period>("ALL");

  const { data: curveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });
  const { data: balanceData } = useSWR(
    `/api/bybit/balance?period=${period === "ALL" ? "30d" : period}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const curve: EquityCurvePoint[] = curveData?.curve ?? [];
  const sparklineData = curve.slice(-30);

  // For ALL period, use curve's last value as total return
  const displayValue =
    period === "ALL"
      ? (curve.length > 0 ? curve[curve.length - 1].value / 100 : 0)
      : (balanceData?.changePercent ?? 0);

  const animatedValue = useCountUp(displayValue, 800);
  const hasData = period === "ALL" ? curve.length > 0 : balanceData?.hasHistory;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      {/* Period Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Cumulative Return
        </span>
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "ALL"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-1 text-[11px] uppercase tracking-[1px] transition-colors",
                period === p
                  ? "text-bronze"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-6">
        {/* Big number */}
        <div>
          {hasData ? (
            <span
              className={cn(
                "font-[family-name:var(--font-mono)] text-5xl font-medium glow-gold",
                getPnlColor(displayValue)
              )}
            >
              {formatPnlPercent(animatedValue)}
            </span>
          ) : (
            <span className="font-[family-name:var(--font-mono)] text-5xl font-medium text-text-muted">
              --
            </span>
          )}
          <p className="mt-1 text-xs text-text-muted">
            {period === "ALL" ? "Since inception" : `vs ${period} ago`}
          </p>
        </div>

        {/* Sparkline */}
        {sparklineData.length > 1 && (
          <div className="h-16 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C5A049" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C5A049" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#C5A049"
                  strokeWidth={1.5}
                  fill="url(#sparkGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/hooks/useCountUp.ts src/components/dashboard/HeroStats.tsx
git commit -m "feat: HeroStats 컴포넌트 추가 — 누적 수익률 큰 숫자 + 스파크라인"
```

---

### Task 9: LiveTickerStrip — 실시간 가격 피드

**Files:**
- Create: `src/components/dashboard/LiveTickerStrip.tsx`

**Context:**
- BTC, ETH, XRP, LTC 수평 배치
- WebSocket 틱 시 flash 애니메이션 (tick-up / tick-down CSS class)
- `useTickerStore`에서 실시간 데이터 구독
- 이전 가격과 비교하여 상승/하락 플래시

**Step 1: LiveTickerStrip 컴포넌트 생성**

```tsx
// src/components/dashboard/LiveTickerStrip.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber } from "@/lib/utils";

const COINS = [
  { symbol: "BTCUSDT", name: "BTC" },
  { symbol: "ETHUSDT", name: "ETH" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "LTCUSDT", name: "LTC" },
];

function TickerItem({ symbol, name }: { symbol: string; name: string }) {
  const ticker = useTickerStore((s) => s.tickers[symbol]);
  const prevPriceRef = useRef<string | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const price = ticker?.lastPrice;
  const change = ticker?.price24hPcnt;
  const changeNum = change ? parseFloat(change) * 100 : null;

  useEffect(() => {
    if (!price || !prevPriceRef.current) {
      prevPriceRef.current = price ?? null;
      return;
    }
    if (price !== prevPriceRef.current) {
      const direction = parseFloat(price) > parseFloat(prevPriceRef.current) ? "up" : "down";
      setFlash(direction);
      prevPriceRef.current = price;
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
  }, [price]);

  return (
    <div className="flex items-center gap-3 rounded-sm bg-bg-elevated px-4 py-3">
      <span className="text-xs font-medium text-text-secondary">{name}</span>
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-sm text-text-primary",
          flash === "up" && "tick-up",
          flash === "down" && "tick-down"
        )}
      >
        {price
          ? formatNumber(parseFloat(price), parseFloat(price) < 1 ? 4 : 2)
          : "--"}
      </span>
      {changeNum !== null && (
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-[11px]",
            changeNum > 0
              ? "text-pnl-positive"
              : changeNum < 0
                ? "text-pnl-negative"
                : "text-text-muted"
          )}
        >
          {changeNum >= 0 ? "+" : ""}
          {changeNum.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export function LiveTickerStrip() {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Market
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-status-live animate-live-pulse" />
          <span className="text-[10px] uppercase tracking-[1px] text-status-live">
            Live
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {COINS.map((c) => (
          <TickerItem key={c.symbol} symbol={c.symbol} name={c.name} />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/LiveTickerStrip.tsx
git commit -m "feat: LiveTickerStrip 컴포넌트 — 실시간 가격 틱 플래시 애니메이션"
```

---

### Task 10: StrategyMetricsBar — 핵심 지표 수평 바

**Files:**
- Create: `src/components/dashboard/StrategyMetricsBar.tsx`

**Context:**
- `/api/bybit/metrics`에서 SWR로 데이터 fetch
- Sharpe, Sortino, MDD, Win Rate, Avg Hold, LIVE 상태를 한 줄로 표시
- 각 지표 라벨(작게) + 값(크게) + 컬러 코딩

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/StrategyMetricsBar.tsx
"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import { LiveIndicator } from "./LiveIndicator";
import type { StrategyMetrics } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MetricItemProps {
  label: string;
  value: string;
  color?: string;
}

function MetricItem({ label, value, color }: MetricItemProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-[1px] text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-sm font-medium",
          color || "text-text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function StrategyMetricsBar() {
  const { data, isLoading } = useSWR<StrategyMetrics>(
    "/api/bybit/metrics",
    fetcher,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="flex h-16 items-center justify-center rounded-sm border border-border-subtle bg-bg-card">
        <div className="h-3 w-64 animate-pulse rounded bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-sm border border-border-subtle bg-bg-card px-6 py-3">
      <div className="flex items-center gap-8">
        <MetricItem
          label="Sharpe"
          value={data?.sharpeRatio?.toFixed(2) ?? "--"}
          color={
            (data?.sharpeRatio ?? 0) >= 1.5
              ? "text-pnl-positive"
              : "text-text-primary"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Sortino"
          value={data?.sortinoRatio?.toFixed(2) ?? "--"}
          color={
            (data?.sortinoRatio ?? 0) >= 2
              ? "text-pnl-positive"
              : "text-text-primary"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Max DD"
          value={data?.maxDrawdown ? `${data.maxDrawdown.toFixed(1)}%` : "--"}
          color="text-pnl-negative"
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Win Rate"
          value={data?.winRate ? `${data.winRate.toFixed(0)}%` : "--"}
          color={
            (data?.winRate ?? 0) >= 55
              ? "text-pnl-positive"
              : "text-text-primary"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Avg Hold"
          value={
            data?.avgHoldingHours
              ? data.avgHoldingHours >= 24
                ? `${(data.avgHoldingHours / 24).toFixed(1)}d`
                : `${data.avgHoldingHours.toFixed(0)}h`
              : "--"
          }
        />
        <div className="h-6 w-px bg-border-subtle" />
        <MetricItem
          label="Trades"
          value={data?.totalTrades?.toString() ?? "--"}
        />
      </div>
      <LiveIndicator />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/StrategyMetricsBar.tsx
git commit -m "feat: StrategyMetricsBar — Sharpe/Sortino/MDD/WinRate 수평 지표 바"
```

---

### Task 11: PerformanceChart — 메인 성과 차트 (전략 vs 벤치마크)

**Files:**
- Create: `src/components/dashboard/PerformanceChart.tsx`

**Context:**
- 기존 `EquityCurve.tsx`를 대체하는 강화 버전
- Lightweight Charts로 전략 라인(gold 실선) + BTC 벤치마크(bronze 점선)
- 백테스트/라이브 구분 수직선
- SWR로 `/api/bybit/equity-curve` + `/api/bybit/benchmark` 동시 fetch
- 기간: 1M / 3M / 6M / 1Y / 3Y / ALL

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/PerformanceChart.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "1M" | "3M" | "6M" | "1Y" | "3Y" | "ALL";

const PERIOD_DAYS: Record<Period, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
  ALL: 99999,
};

function filterByPeriod<T extends { time: string }>(
  data: T[],
  period: Period
): T[] {
  if (period === "ALL") return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return data.filter((p) => p.time >= cutoffStr);
}

export function PerformanceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  const strategySeriesRef = useRef<unknown>(null);
  const benchmarkSeriesRef = useRef<unknown>(null);
  const [period, setPeriod] = useState<Period>("ALL");

  const { data: curveData, isLoading: curveLoading } = useSWR(
    "/api/bybit/equity-curve",
    fetcher,
    { refreshInterval: 300000 }
  );
  const { data: benchmarkData } = useSWR(
    "/api/bybit/benchmark?symbol=BTCUSDT&limit=1000",
    fetcher,
    { refreshInterval: 3600000 }
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (chartRef.current) chartRef.current.remove();

      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#888888",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: chartContainerRef.current!.clientWidth,
        height: 420,
        rightPriceScale: {
          borderColor: "#333333",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      // Strategy line (gold)
      const strategySeries = chart.addAreaSeries({
        lineColor: "#C5A049",
        lineWidth: 2,
        topColor: "rgba(197, 160, 73, 0.15)",
        bottomColor: "rgba(197, 160, 73, 0)",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(2)}%`,
        },
        title: "Rebeta v3.1",
      });

      // Benchmark line (bronze, dashed effect via thinner line)
      const benchmarkSeries = chart.addLineSeries({
        color: "#997B66",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(2)}%`,
        },
        title: "BTC",
      });

      chartRef.current = chart;
      strategySeriesRef.current = strategySeries;
      benchmarkSeriesRef.current = benchmarkSeries;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!strategySeriesRef.current) return;

    const curve: EquityCurvePoint[] = curveData?.curve ?? [];
    const benchmark: BenchmarkPoint[] = benchmarkData?.series ?? [];

    const filteredCurve = filterByPeriod(curve, period);
    const filteredBenchmark = filterByPeriod(benchmark, period);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (strategySeriesRef.current as any).setData(
      filteredCurve.map((p) => ({ time: p.time, value: p.value }))
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (benchmarkSeriesRef.current as any).setData(
      filteredBenchmark.map((p) => ({ time: p.time, value: p.value }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [curveData, benchmarkData, period]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
            Performance
          </span>
          {/* Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-gold" />
              <span className="text-[10px] text-text-muted">Rebeta v3.1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 border-t border-dashed border-bronze" />
              <span className="text-[10px] text-text-muted">BTC</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {(["1M", "3M", "6M", "1Y", "3Y", "ALL"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-1 text-[11px] uppercase tracking-[1px] transition-colors",
                period === p
                  ? "text-bronze"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {curveLoading ? (
          <div className="h-[420px] animate-pulse rounded bg-bg-elevated" />
        ) : (
          <div ref={chartContainerRef} />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/PerformanceChart.tsx
git commit -m "feat: PerformanceChart — 전략 vs BTC 벤치마크 듀얼 라인 차트"
```

---

### Task 12: MonthlyReturnsHeatmap — 월별 수익률 히트맵

**Files:**
- Create: `src/components/dashboard/MonthlyReturnsHeatmap.tsx`

**Context:**
- 연도(행) × 월(열) 테이블 형태
- 셀 배경색이 수익률에 따라 gold(+) ~ red(-) 그라데이션
- 연간 합계 열 포함
- Recharts 불필요, 순수 HTML 테이블 + Tailwind 동적 스타일

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/MonthlyReturnsHeatmap.tsx
"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import type { MonthlyReturn } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getCellBg(value: number | null): string {
  if (value === null) return "bg-bg-elevated";
  if (value >= 10) return "bg-pnl-positive/40";
  if (value >= 5) return "bg-pnl-positive/25";
  if (value >= 2) return "bg-pnl-positive/15";
  if (value > 0) return "bg-pnl-positive/8";
  if (value === 0) return "bg-bg-elevated";
  if (value > -2) return "bg-pnl-negative/8";
  if (value > -5) return "bg-pnl-negative/15";
  if (value > -10) return "bg-pnl-negative/25";
  return "bg-pnl-negative/40";
}

function getCellText(value: number | null): string {
  if (value === null) return "text-text-dim";
  if (value > 0) return "text-pnl-positive";
  if (value < 0) return "text-pnl-negative";
  return "text-text-muted";
}

export function MonthlyReturnsHeatmap() {
  const { data, isLoading } = useSWR("/api/bybit/monthly-returns", fetcher, {
    refreshInterval: 300000,
  });

  const returns: MonthlyReturn[] = data?.returns ?? [];

  // Build year → month map
  const yearMap = new Map<number, Map<number, number>>();
  for (const r of returns) {
    if (!yearMap.has(r.year)) yearMap.set(r.year, new Map());
    yearMap.get(r.year)!.set(r.month, r.return);
  }

  const years = Array.from(yearMap.keys()).sort((a, b) => b - a); // newest first

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-4 h-32 animate-pulse rounded bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Monthly Returns
      </span>

      {returns.length === 0 ? (
        <div className="mt-4 flex h-24 items-center justify-center text-sm text-text-muted">
          Collecting data...
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-[1px] text-text-muted">
                  Year
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-[1px] text-text-muted"
                  >
                    {m}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center text-[10px] uppercase tracking-[1px] text-text-muted">
                  YTD
                </th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const months = yearMap.get(year)!;
                const ytd = Array.from(months.values()).reduce(
                  (sum, v) => sum + v,
                  0
                );
                return (
                  <tr key={year}>
                    <td className="px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                      {year}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(
                      (month) => {
                        const val = months.get(month) ?? null;
                        return (
                          <td key={month} className="px-0.5 py-0.5">
                            <div
                              className={cn(
                                "heatmap-cell flex h-7 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[10px]",
                                getCellBg(val),
                                getCellText(val)
                              )}
                              title={
                                val !== null
                                  ? `${year} ${MONTHS[month - 1]}: ${val >= 0 ? "+" : ""}${val.toFixed(2)}%`
                                  : ""
                              }
                            >
                              {val !== null
                                ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}`
                                : ""}
                            </div>
                          </td>
                        );
                      }
                    )}
                    <td className="px-0.5 py-0.5">
                      <div
                        className={cn(
                          "flex h-7 items-center justify-center rounded-sm font-[family-name:var(--font-mono)] text-[10px] font-medium",
                          getCellBg(ytd),
                          getCellText(ytd)
                        )}
                      >
                        {ytd >= 0 ? "+" : ""}
                        {ytd.toFixed(1)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/MonthlyReturnsHeatmap.tsx
git commit -m "feat: MonthlyReturnsHeatmap — 월별 수익률 히트맵 테이블"
```

---

### Task 13: DrawdownChart — 드로다운 에리어 차트

**Files:**
- Create: `src/components/dashboard/DrawdownChart.tsx`

**Context:**
- Lightweight Charts 에리어, 0% 기준 아래로 빨간 그라데이션
- `/api/bybit/drawdown` 데이터 사용
- 최대 낙폭 포인트에 마커 표시

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/DrawdownChart.tsx
"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { DrawdownPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DrawdownChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  const seriesRef = useRef<unknown>(null);

  const { data, isLoading } = useSWR("/api/bybit/drawdown", fetcher, {
    refreshInterval: 300000,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (chartRef.current) chartRef.current.remove();

      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#888888",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: chartContainerRef.current!.clientWidth,
        height: 200,
        rightPriceScale: {
          borderColor: "#333333",
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      const series = chart.addAreaSeries({
        lineColor: "#EF4444",
        lineWidth: 1,
        topColor: "rgba(239, 68, 68, 0.05)",
        bottomColor: "rgba(239, 68, 68, 0.25)",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(2)}%`,
        },
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data?.series?.length) return;

    const series: DrawdownPoint[] = data.series;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (seriesRef.current as any).setData(
      series.map((p) => ({ time: p.time, value: p.value }))
    );

    // Mark max drawdown point
    const minPoint = series.reduce(
      (min, p) => (p.value < min.value ? p : min),
      series[0]
    );

    if (minPoint) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (seriesRef.current as any).setMarkers([
        {
          time: minPoint.time,
          position: "belowBar",
          color: "#EF4444",
          shape: "arrowUp",
          text: `${minPoint.value.toFixed(1)}%`,
        },
      ]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Drawdown
      </span>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-[200px] animate-pulse rounded bg-bg-elevated" />
        ) : !data?.series?.length ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-text-muted">
            Collecting data...
          </div>
        ) : (
          <div ref={chartContainerRef} />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/DrawdownChart.tsx
git commit -m "feat: DrawdownChart — 드로다운 에리어 차트 (빨간 그라데이션)"
```

---

### Task 14: PnLDistribution — 일별 PnL 막대 차트

**Files:**
- Create: `src/components/dashboard/PnLDistribution.tsx`

**Context:**
- Recharts BarChart로 일별 PnL 표시
- 양수: gold, 음수: red
- `/api/bybit/equity-curve` 데이터에서 일별 변동 계산

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/PnLDistribution.tsx
"use client";

import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DailyBar {
  date: string;
  value: number;
}

export function PnLDistribution() {
  const { data, isLoading } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });

  const curve: EquityCurvePoint[] = data?.curve ?? [];

  // Calculate daily changes from cumulative curve
  const dailyBars: DailyBar[] = [];
  for (let i = 1; i < curve.length; i++) {
    dailyBars.push({
      date: curve[i].time,
      value: parseFloat((curve[i].value - curve[i - 1].value).toFixed(3)),
    });
  }

  // Show last 60 days max
  const recentBars = dailyBars.slice(-60);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Daily P&L
      </span>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-[200px] animate-pulse rounded bg-bg-elevated" />
        ) : recentBars.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-text-muted">
            Collecting data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentBars} barCategoryGap="15%">
              <XAxis
                dataKey="date"
                tick={{ fill: "#555555", fontSize: 9, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "#222222" }}
                tickLine={false}
                interval="preserveStartEnd"
                tickFormatter={(v: string) => v.slice(5)} // MM-DD
              />
              <YAxis
                tick={{ fill: "#555555", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161616",
                  border: "1px solid #333333",
                  borderRadius: "2px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#888888" }}
                formatter={(value: number) => [
                  `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`,
                  "P&L",
                ]}
              />
              <ReferenceLine y={0} stroke="#333333" />
              <Bar dataKey="value" radius={[1, 1, 0, 0]}>
                {recentBars.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.value >= 0 ? "#C5A049" : "#EF4444"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/PnLDistribution.tsx
git commit -m "feat: PnLDistribution — 일별 PnL 막대 차트 (Recharts)"
```

---

### Task 15: RollingMetrics — 롤링 Sharpe/변동성 차트

**Files:**
- Create: `src/components/dashboard/RollingMetrics.tsx`

**Context:**
- Lightweight Charts 멀티 라인
- 롤링 30일 Sharpe (gold) + 롤링 30일 Volatility (bronze)
- `/api/bybit/rolling-metrics?window=30`

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/RollingMetrics.tsx
"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { RollingMetricPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RollingMetrics() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  const sharpeSeriesRef = useRef<unknown>(null);
  const volSeriesRef = useRef<unknown>(null);

  const { data, isLoading } = useSWR(
    "/api/bybit/rolling-metrics?window=30",
    fetcher,
    { refreshInterval: 300000 }
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle }) => {
      if (chartRef.current) chartRef.current.remove();

      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#888888",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#1C1C1C" },
          horzLines: { color: "#1C1C1C" },
        },
        width: chartContainerRef.current!.clientWidth,
        height: 200,
        rightPriceScale: {
          borderColor: "#333333",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: { borderColor: "#333333", timeVisible: false },
        crosshair: {
          vertLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
          horzLine: { color: "#997B66", width: 1, style: LineStyle.Dashed },
        },
      });

      const sharpeSeries = chart.addLineSeries({
        color: "#C5A049",
        lineWidth: 1.5,
        title: "Sharpe (30d)",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => price.toFixed(2),
        },
      });

      const volSeries = chart.addLineSeries({
        color: "#997B66",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: "Vol (30d)",
        priceScaleId: "vol",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(1)}%`,
        },
      });

      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
      });

      chartRef.current = chart;
      sharpeSeriesRef.current = sharpeSeries;
      volSeriesRef.current = volSeries;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!sharpeSeriesRef.current || !data) return;

    const sharpe: RollingMetricPoint[] = data.sharpe ?? [];
    const volatility: RollingMetricPoint[] = data.volatility ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sharpeSeriesRef.current as any).setData(
      sharpe.map((p) => ({ time: p.time, value: p.value }))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (volSeriesRef.current as any).setData(
      volatility.map((p) => ({ time: p.time, value: p.value }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center gap-4">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Rolling Metrics (30d)
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 bg-gold" />
            <span className="text-[9px] text-text-muted">Sharpe</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3 border-t border-dashed border-bronze" />
            <span className="text-[9px] text-text-muted">Volatility</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-[200px] animate-pulse rounded bg-bg-elevated" />
        ) : !data?.sharpe?.length ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-text-muted">
            Collecting data...
          </div>
        ) : (
          <div ref={chartContainerRef} />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/RollingMetrics.tsx
git commit -m "feat: RollingMetrics — 롤링 Sharpe/변동성 듀얼 차트"
```

---

### Task 16: PositionCards — 강화된 포지션 카드

**Files:**
- Create: `src/components/dashboard/PositionCards.tsx`

**Context:**
- 기존 `PositionCard.tsx`를 대체하는 강화 버전
- 각 포지션이 독립 카드, WebSocket 실시간 PnL 플래시
- 진입가 대비 현재가 시각화 (작은 바 형태)

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/PositionCards.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useTickerStore } from "@/stores/useTickerStore";
import { cn, formatNumber, formatPnlPercent, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Position {
  symbol: string;
  side: "Buy" | "Sell";
  size: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  unrealisedPnl: string;
}

function SinglePositionCard({ position }: { position: Position }) {
  const livePrice = useTickerStore((s) => s.getPrice(position.symbol));
  const currentPrice = livePrice || position.markPrice;
  const entryPrice = parseFloat(position.entryPrice);
  const pnlPercent =
    position.side === "Buy"
      ? (parseFloat(currentPrice) - entryPrice) / entryPrice
      : (entryPrice - parseFloat(currentPrice)) / entryPrice;

  // Flash effect on PnL change
  const prevPnlRef = useRef(pnlPercent);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (Math.abs(pnlPercent - prevPnlRef.current) > 0.0001) {
      setFlash(pnlPercent > prevPnlRef.current ? "up" : "down");
      prevPnlRef.current = pnlPercent;
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
  }, [pnlPercent]);

  // Progress bar: how far price moved from entry
  const priceMove = ((parseFloat(currentPrice) - entryPrice) / entryPrice) * 100;
  const barWidth = Math.min(Math.abs(priceMove) * 5, 100); // scale for visibility

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {position.symbol.replace("USDT", "")}
          </span>
          <span
            className={cn(
              "text-[10px] uppercase tracking-[1px]",
              position.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
            )}
          >
            {position.side === "Buy" ? "LONG" : "SHORT"}
          </span>
          <span className="text-[10px] text-text-dim">{position.leverage}x</span>
        </div>
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-lg font-medium",
            getPnlColor(pnlPercent),
            flash === "up" && "tick-up",
            flash === "down" && "tick-down"
          )}
        >
          {formatPnlPercent(pnlPercent)}
        </span>
      </div>

      {/* Price bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px]">
          <span className="text-text-muted">
            Entry {formatNumber(entryPrice)}
          </span>
          <span className={cn("font-[family-name:var(--font-mono)]", getPnlColor(pnlPercent))}>
            {formatNumber(parseFloat(currentPrice))}
          </span>
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-bg-elevated">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              pnlPercent >= 0 ? "bg-pnl-positive/50" : "bg-pnl-negative/50"
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function PositionCards() {
  const { data, isLoading } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 5000,
  });

  const positions: Position[] = data?.positions ?? [];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Open Positions
        </span>
        <span className="font-[family-name:var(--font-mono)] text-sm text-text-secondary">
          {positions.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <span className="text-sm text-text-muted">
              Waiting for signal...
            </span>
          </div>
        ) : (
          positions.map((pos) => (
            <SinglePositionCard key={pos.symbol} position={pos} />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/PositionCards.tsx
git commit -m "feat: PositionCards — 강화된 포지션 카드 (PnL 플래시 + 가격 바)"
```

---

### Task 17: TradesFeed — 타임라인 스타일 거래 피드

**Files:**
- Create: `src/components/dashboard/TradesFeed.tsx`

**Context:**
- 기존 `RecentActivity.tsx` 대체
- 타임라인 레이아웃 (세로 라인 + 컬러 dot)
- 새 거래 슬라이드인 애니메이션
- 상대 시간 표시

**Step 1: 컴포넌트 생성**

```tsx
// src/components/dashboard/TradesFeed.tsx
"use client";

import useSWR from "swr";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Execution {
  execId: string;
  execTime: string;
  symbol: string;
  side: string;
  execPrice: string;
  execQty: string;
}

export function TradesFeed() {
  const { data, isLoading } = useSWR("/api/bybit/executions?limit=10", fetcher, {
    refreshInterval: 15000,
  });

  const executions: Execution[] = data?.list ?? [];

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Recent Trades
        </span>
        {executions.length > 0 && (
          <span className="text-[10px] text-text-muted">
            {executions.length} trades
          </span>
        )}
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            No recent trades
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border-subtle" />

            <div className="space-y-1">
              {executions.map((exec, index) => {
                const time = new Date(parseInt(exec.execTime));
                const isBuy = exec.side === "Buy";

                return (
                  <div
                    key={exec.execId}
                    className={cn(
                      "relative flex items-center gap-3 rounded-sm py-2 pl-5 pr-3 transition-colors hover:bg-bg-elevated/50",
                      index === 0 && "animate-slide-in"
                    )}
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-[4px] h-[7px] w-[7px] rounded-full",
                        isBuy ? "bg-pnl-positive" : "bg-pnl-negative"
                      )}
                    />

                    <div className="flex flex-1 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
                          {exec.symbol.replace("USDT", "")}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-[1px]",
                            isBuy ? "text-pnl-positive" : "text-pnl-negative"
                          )}
                        >
                          {isBuy ? "BUY" : "SELL"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                          {formatNumber(parseFloat(exec.execPrice))} x{" "}
                          {formatNumber(parseFloat(exec.execQty), 4)}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatRelativeTime(time)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/TradesFeed.tsx
git commit -m "feat: TradesFeed — 타임라인 스타일 거래 피드 (슬라이드인 애니메이션)"
```

---

## Phase 4: Assembly (조립)

### Task 18: Overview 페이지 풀 리디자인

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Context:**
- 기존 6개 컴포넌트를 10개 새 컴포넌트로 교체
- 설계 문서의 레이아웃 구조 적용:
  1. HERO ZONE: HeroStats + LiveTickerStrip
  2. STRATEGY METRICS BAR: StrategyMetricsBar
  3. MAIN CHART: PerformanceChart
  4. ANALYTICS GRID: MonthlyReturnsHeatmap + DrawdownChart + PnLDistribution + RollingMetrics
  5. LIVE ACTIVITY: PositionCards + TradesFeed
- 기존 컴포넌트 파일은 삭제하지 않음 (다른 페이지에서 사용 가능)

**Step 1: Overview 페이지 교체**

```tsx
// src/app/dashboard/page.tsx
import { Header } from "@/components/layout/Header";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { LiveTickerStrip } from "@/components/dashboard/LiveTickerStrip";
import { StrategyMetricsBar } from "@/components/dashboard/StrategyMetricsBar";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MonthlyReturnsHeatmap } from "@/components/dashboard/MonthlyReturnsHeatmap";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { PnLDistribution } from "@/components/dashboard/PnLDistribution";
import { RollingMetrics } from "@/components/dashboard/RollingMetrics";
import { PositionCards } from "@/components/dashboard/PositionCards";
import { TradesFeed } from "@/components/dashboard/TradesFeed";

export default function OverviewPage() {
  return (
    <div>
      <Header title="Overview" />
      <div className="space-y-4 p-6">
        {/* Hero Zone: Cumulative Return + Live Market Tickers */}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <HeroStats />
          <LiveTickerStrip />
        </div>

        {/* Strategy Metrics Bar */}
        <StrategyMetricsBar />

        {/* Main Performance Chart */}
        <PerformanceChart />

        {/* Analytics Grid: 2x2 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyReturnsHeatmap />
          <DrawdownChart />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PnLDistribution />
          <RollingMetrics />
        </div>

        {/* Live Activity: Positions + Trade Feed */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <PositionCards />
          <TradesFeed />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: Overview 페이지 풀 리디자인 — 10개 새 컴포넌트 레이아웃 적용"
```

---

### Task 19: 빌드 검증 + 최종 점검

**Step 1: 빌드 확인**

```bash
pnpm build
```

Expected: 빌드 성공, 에러 없음

**Step 2: 린트 확인**

```bash
pnpm lint
```

Expected: 린트 패스 (워닝은 OK)

**Step 3: 타입 에러 수정 (필요 시)**

빌드/린트 에러가 있으면 해당 파일 수정 후 커밋

**Step 4: 개발 서버에서 시각적 확인**

```bash
pnpm dev
```

`http://localhost:3000/dashboard` 접속하여:
- [ ] Hero Stats 큰 숫자 + 스파크라인 렌더링
- [ ] Live Ticker Strip 실시간 가격 업데이트 + 플래시
- [ ] Strategy Metrics Bar 지표 표시
- [ ] Performance Chart 전략 + BTC 라인 표시
- [ ] Monthly Returns Heatmap 셀 색상
- [ ] Drawdown Chart 빨간 에리어
- [ ] PnL Distribution 막대 차트
- [ ] Rolling Metrics 듀얼 라인
- [ ] Position Cards 실시간 PnL
- [ ] Trades Feed 타임라인

**Step 5: 최종 커밋**

```bash
git add -A
git commit -m "fix: Overview 풀 리디자인 빌드 에러 수정 및 최종 정리"
```

---

## Summary

| Phase | Tasks | 새 파일 | 수정 파일 |
|-------|-------|--------|---------|
| 1. Foundation | 1-2 | 0 | 4 |
| 2. API Layer | 3-7 | 5 | 0 |
| 3. Components | 8-17 | 11 | 0 |
| 4. Assembly | 18-19 | 0 | 1 |
| **Total** | **19 tasks** | **16 files** | **5 files** |

**Dependencies:** Phase 1 → Phase 2 → Phase 3 → Phase 4 (순차적)
**병렬 가능:** Phase 2 내의 Task 3-7은 서로 독립적, Phase 3 내의 Task 8-17도 서로 독립적
