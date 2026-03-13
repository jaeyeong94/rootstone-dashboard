# Overview LP Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overview 페이지를 LP 영업용 "Wow" 페이지로 재설계. Zone 1(첫 화면 히어로) + Zone 2(인텔리전스 피드) 구조.

**Architecture:** Zone 1은 100vh 전체를 차지하는 시네마틱 히어로 존. Zone 2는 Intersection Observer 기반 스크롤 애니메이션으로 4개 섹션이 순차적으로 등장. 신규 컴포넌트 6개 추가, 기존 컴포넌트 재배치.

**Tech Stack:** Next.js 15 (App Router), React 19, TailwindCSS 4, Recharts, SWR, Zustand, SVG animations, Intersection Observer API

---

## 기존 코드 참고 사항 (읽기 전에 확인)

- `src/components/dashboard/HeroStats.tsx` — 기존 누적 수익률 컴포넌트 (재설계 대상)
- `src/components/dashboard/StrategyMetricsBar.tsx` — Sharpe/Sortino 등 지표 (Zone 1 KPI에 통합)
- `src/components/dashboard/PositionCards.tsx` — 포지션 카드 (LivePositionBar로 교체)
- `src/hooks/useCountUp.ts` — 숫자 카운트업 훅 (재사용)
- `src/stores/useTickerStore.ts` — WebSocket 가격 store (재사용)
- `src/app/api/bybit/executions/route.ts` — 체결 API (재사용)
- `src/app/api/bybit/benchmark/route.ts` — BTC 벤치마크 API (재사용)
- `src/app/api/bybit/metrics/route.ts` — Sharpe 등 지표 API (재사용)
- `src/app/dashboard/page.tsx` — 마지막 Task에서 전체 재구성

---

## Task 1: useInView 훅 (스크롤 애니메이션 기반)

**Files:**
- Create: `src/hooks/useInView.ts`

Zone 2의 모든 섹션이 뷰포트에 진입할 때 애니메이션을 트리거하는 훅.

**Step 1: 파일 생성**

```typescript
// src/hooks/useInView.ts
"use client";

import { useEffect, useRef, useState } from "react";

export function useInView(options?: IntersectionObserverInit): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect(); // 한 번만 실행
        }
      },
      { threshold: 0.1, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}
```

**Step 2: globals.css에 스크롤 애니메이션 클래스 추가**

`src/app/globals.css`에 아래 추가:

```css
/* Section reveal animation */
.section-hidden {
  opacity: 0;
  transform: translateY(20px);
}
.section-visible {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
```

**Step 3: 커밋**
```bash
git add src/hooks/useInView.ts src/app/globals.css
git commit -m "feat: add useInView hook for scroll-triggered animations"
```

---

## Task 2: AnimatedSparkline 컴포넌트

**Files:**
- Create: `src/components/dashboard/AnimatedSparkline.tsx`

Zone 1 하단에 표시되는 전체 너비 에쿼티 커브 스파크라인. 페이지 로드 시 좌→우로 선이 그려지는 SVG 애니메이션.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/AnimatedSparkline.tsx
"use client";

import { useEffect, useRef } from "react";
import type { EquityCurvePoint } from "@/types";

interface Props {
  data: EquityCurvePoint[];
}

export function AnimatedSparkline({ data }: Props) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || data.length < 2) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    // 다음 프레임에 트랜지션 시작 (레이아웃 계산 완료 후)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset 2s ease-in-out";
        path.style.strokeDashoffset = "0";
      });
    });
  }, [data]);

  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 1200;
  const H = 60;
  const pad = 4;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - pad - ((d.value - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  const d = `M ${points.join(" L ")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-12 w-full"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C5A049" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#C5A049" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* fill area */}
      <path
        d={`${d} L ${W},${H} L 0,${H} Z`}
        fill="url(#sparkFill)"
        opacity="0.5"
      />
      {/* animated line */}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="#C5A049"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/AnimatedSparkline.tsx
git commit -m "feat: animated equity sparkline with SVG stroke-dashoffset"
```

---

## Task 3: HeroZone 컴포넌트 (Zone 1)

**Files:**
- Create: `src/components/dashboard/HeroZone.tsx`

첫 화면 전체를 차지하는 히어로 존. 배경 그리드, 누적 수익률 카운터, KPI 5개, 애니메이션 스파크라인.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/HeroZone.tsx
"use client";

import useSWR from "swr";
import { cn, formatPnlPercent, getPnlColor } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { AnimatedSparkline } from "./AnimatedSparkline";
import type { EquityCurvePoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const INCEPTION_DATE = new Date("2022-03-01");

function daysLive(): number {
  return Math.floor((Date.now() - INCEPTION_DATE.getTime()) / 86400000);
}

export function HeroZone() {
  const { data: curveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });
  const { data: metrics } = useSWR("/api/bybit/metrics", fetcher, {
    refreshInterval: 300000,
  });
  const { data: balanceData } = useSWR("/api/bybit/balance?period=24h", fetcher, {
    refreshInterval: 30000,
  });

  const curve: EquityCurvePoint[] = curveData?.curve ?? [];
  const lastValue = curve.length > 0 ? curve[curve.length - 1].value / 100 : 0;
  const animatedReturn = useCountUp(lastValue, 2000);

  const kpis = [
    { label: "Sharpe Ratio", value: metrics?.sharpe?.toFixed(2) ?? "--" },
    { label: "Sortino Ratio", value: metrics?.sortino?.toFixed(2) ?? "--" },
    { label: "Max Drawdown", value: metrics?.maxDrawdown != null ? `${metrics.maxDrawdown.toFixed(1)}%` : "--" },
    { label: "Win Rate", value: metrics?.winRate != null ? `${metrics.winRate.toFixed(1)}%` : "--" },
    {
      label: "Today",
      value: balanceData?.changePercent != null ? formatPnlPercent(balanceData.changePercent) : "--",
      color: balanceData?.changePercent != null ? getPnlColor(balanceData.changePercent) : undefined,
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden border-b border-border-subtle pb-0">
      {/* 배경 그리드 패턴 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(153,123,102,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(153,123,102,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pt-8 lg:px-12">
        {/* 서브타이틀 */}
        <p className="text-[11px] uppercase tracking-[2px] text-bronze/70">
          Rebeta v3.1 · Algorithmic Strategy
        </p>

        {/* 누적 수익률 카운터 */}
        <div className="mt-6">
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-7xl font-medium leading-none lg:text-8xl",
              curve.length > 0 ? getPnlColor(lastValue) : "text-text-muted",
              "glow-gold"
            )}
          >
            {curve.length > 0 ? formatPnlPercent(animatedReturn) : "--"}
          </span>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-text-muted">
            Cumulative Return · Since Mar 2022 ·{" "}
            <span className="text-bronze">{daysLive()} days live</span>
          </p>
        </div>

        {/* KPI 5개 카드 */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-sm border border-border-subtle bg-bg-card/80 p-4 backdrop-blur-sm"
              style={{
                animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
              }}
            >
              <p className="text-[10px] uppercase tracking-[1px] text-text-muted">
                {kpi.label}
              </p>
              <p
                className={cn(
                  "mt-1.5 font-[family-name:var(--font-mono)] text-xl font-medium",
                  kpi.color ?? "text-text-primary"
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단: 스파크라인 + 스크롤 힌트 */}
      <div className="relative z-10 mt-auto">
        <div className="px-0 opacity-60">
          <AnimatedSparkline data={curve} />
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="flex flex-col items-center gap-1 text-text-dim">
            <span className="text-[10px] uppercase tracking-[1px]">Scroll</span>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path d="M1 1l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: globals.css에 fadeIn 키프레임 추가** (`src/app/globals.css`)

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Step 3: 커밋**
```bash
git add src/components/dashboard/HeroZone.tsx src/app/globals.css
git commit -m "feat: HeroZone component with animated return counter and KPI grid"
```

---

## Task 4: ExecutionsFeed 컴포넌트

**Files:**
- Create: `src/components/dashboard/ExecutionsFeed.tsx`

실시간 체결 피드. 10초마다 폴링하여 새 체결 발견 시 상단에서 슬라이드인.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/ExecutionsFeed.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn, formatNumber } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Execution {
  execId: string;
  symbol: string;
  side: string;
  execQty: string;
  execPrice: string;
  closedPnl: string;
  execTime: string;
}

function timeAgo(ms: string): string {
  const diff = Date.now() - parseInt(ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function ExecutionsFeed() {
  const { data } = useSWR("/api/bybit/executions?limit=20", fetcher, {
    refreshInterval: 10000,
  });

  const executions: Execution[] = data?.executions ?? [];
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (executions.length === 0) return;
    const currentIds = new Set(executions.map((e) => e.execId));
    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!prevIdsRef.current.has(id) && prevIdsRef.current.size > 0) {
        fresh.add(id);
      }
    });
    if (fresh.size > 0) {
      setNewIds(fresh);
      setTimeout(() => setNewIds(new Set()), 1500);
    }
    prevIdsRef.current = currentIds;
  }, [executions]);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Executions Feed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-[live-pulse_2s_ease-in-out_infinite] rounded-full bg-status-live" />
          <span className="text-[10px] text-status-live">Live</span>
        </span>
      </div>

      <div className="mt-3 space-y-1 overflow-hidden">
        {executions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-text-muted">No recent executions</span>
          </div>
        ) : (
          executions.slice(0, 8).map((ex) => {
            const pnl = parseFloat(ex.closedPnl);
            const isNew = newIds.has(ex.execId);
            return (
              <div
                key={ex.execId}
                className={cn(
                  "flex items-center justify-between rounded-sm px-3 py-2 transition-all duration-500",
                  isNew ? "bg-bronze/10 slide-in-top" : "hover:bg-bg-elevated"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "w-1 h-4 rounded-full shrink-0",
                      ex.side === "Buy" ? "bg-pnl-positive" : "bg-pnl-negative"
                    )}
                  />
                  <span className="font-[family-name:var(--font-mono)] text-xs text-text-primary truncate">
                    {ex.symbol.replace("USDT", "")}
                  </span>
                  <span className={cn(
                    "text-[10px] uppercase tracking-[1px]",
                    ex.side === "Buy" ? "text-pnl-positive" : "text-pnl-negative"
                  )}>
                    {ex.side === "Buy" ? "L" : "S"}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                    @{formatNumber(parseFloat(ex.execPrice))}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {pnl !== 0 && (
                    <span className={cn(
                      "font-[family-name:var(--font-mono)] text-xs",
                      pnl >= 0 ? "text-pnl-positive" : "text-pnl-negative"
                    )}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                    </span>
                  )}
                  <span className="text-[10px] text-text-dim w-12 text-right">
                    {timeAgo(ex.execTime)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/ExecutionsFeed.tsx
git commit -m "feat: ExecutionsFeed component with live polling and new-item animation"
```

---

## Task 5: LivePositionBar 컴포넌트

**Files:**
- Create: `src/components/dashboard/LivePositionBar.tsx`

포지션을 바 그래프로 시각화. 레버리지·방향·실시간 PnL을 한눈에.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/LivePositionBar.tsx
"use client";

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

function PositionRow({ pos }: { pos: Position }) {
  const livePrice = useTickerStore((s) => s.getPrice(pos.symbol));
  const currentPrice = parseFloat(livePrice || pos.markPrice);
  const entryPrice = parseFloat(pos.entryPrice);
  const isLong = pos.side === "Buy";

  const pnlPct = isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;

  const barPct = Math.min(Math.abs(pnlPct) * 10 * 100, 100);

  return (
    <div className="space-y-1.5 py-3 border-b border-border-subtle last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {pos.symbol.replace("USDT", "")}
          </span>
          <span className={cn(
            "text-[9px] uppercase tracking-[1.5px] px-1.5 py-0.5 rounded-sm",
            isLong ? "bg-pnl-positive/15 text-pnl-positive" : "bg-pnl-negative/15 text-pnl-negative"
          )}>
            {isLong ? "Long" : "Short"}
          </span>
          <span className="text-[10px] text-text-dim">{pos.leverage}×</span>
        </div>
        <span className={cn(
          "font-[family-name:var(--font-mono)] text-sm font-medium",
          getPnlColor(pnlPct)
        )}>
          {formatPnlPercent(pnlPct)}
        </span>
      </div>

      {/* 포지션 바 */}
      <div className="h-1 w-full rounded-full bg-bg-elevated overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pnlPct >= 0 ? "bg-pnl-positive/60" : "bg-pnl-negative/60"
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-text-dim">
        <span>Entry {formatNumber(entryPrice)}</span>
        <span className={getPnlColor(pnlPct)}>{formatNumber(currentPrice)}</span>
      </div>
    </div>
  );
}

export function LivePositionBar() {
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
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-[live-pulse_2s_ease-in-out_infinite] rounded-full bg-status-live" />
          <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
            {positions.length}
          </span>
        </div>
      </div>

      <div className="mt-2">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <div className="text-2xl text-text-dim mb-1">◎</div>
              <p className="text-xs text-text-muted">Waiting for signal</p>
            </div>
          </div>
        ) : (
          <div className="divide-border-subtle">
            {positions.map((pos) => (
              <PositionRow key={pos.symbol} pos={pos} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/LivePositionBar.tsx
git commit -m "feat: LivePositionBar with direction badges and PnL progress bars"
```

---

## Task 6: RiskGauge 컴포넌트

**Files:**
- Create: `src/components/dashboard/RiskGauge.tsx`

원형 SVG 게이지로 마진 사용률(리스크 레벨) 표시.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/RiskGauge.tsx
"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ArcGauge({ pct }: { pct: number }) {
  // 반원 arc (180도): 왼쪽(-180°) → 오른쪽(0°)
  const R = 54;
  const cx = 64;
  const cy = 70;
  const circumference = Math.PI * R; // 반원 둘레

  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;

  const riskColor =
    pct < 30 ? "#10B981" : pct < 70 ? "#C5A049" : "#EF4444";
  const riskLabel =
    pct < 30 ? "LOW" : pct < 70 ? "MEDIUM" : "HIGH";

  return (
    <svg viewBox="0 0 128 80" className="w-full max-w-[180px]">
      {/* 배경 arc */}
      <path
        d="M 10,70 A 54,54 0 0,1 118,70"
        fill="none"
        stroke="#1C1C1C"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* 채워진 arc */}
      <path
        d="M 10,70 A 54,54 0 0,1 118,70"
        fill="none"
        stroke={riskColor}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }}
      />
      {/* 퍼센트 */}
      <text x="64" y="58" textAnchor="middle" fill="white" fontSize="18" fontFamily="JetBrains Mono">
        {pct.toFixed(0)}%
      </text>
      {/* 레이블 */}
      <text x="64" y="73" textAnchor="middle" fill={riskColor} fontSize="9" fontFamily="Inter" letterSpacing="1.5">
        {riskLabel}
      </text>
    </svg>
  );
}

export function RiskGauge() {
  const { data: balData } = useSWR("/api/bybit/balance?period=24h", fetcher, {
    refreshInterval: 30000,
  });
  const { data: posData } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 10000,
  });

  // 마진 사용률 = 포지션 총 증거금 / 전체 지갑 잔고
  // 간략화: unrealisedPnl 합산 vs totalWalletBalance
  const positions = posData?.positions ?? [];
  const totalWallet = balData?.totalWalletBalance ?? 0;

  let usedMargin = 0;
  for (const pos of positions) {
    // positionValue / leverage ≈ initial margin (근사치)
    const posValue = parseFloat(pos.size) * parseFloat(pos.markPrice);
    const lev = parseFloat(pos.leverage) || 1;
    usedMargin += posValue / lev;
  }

  const marginPct = totalWallet > 0 ? Math.min((usedMargin / totalWallet) * 100, 100) : 0;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Risk Gauge
      </span>

      <div className="mt-4 flex flex-col items-center gap-3">
        <ArcGauge pct={marginPct} />

        <div className="w-full space-y-2 text-[10px]">
          <div className="flex justify-between text-text-muted">
            <span>Positions</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {positions.length}
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Margin Used</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {marginPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Strategy</span>
            <span className="font-[family-name:var(--font-mono)] text-bronze">
              Rebeta v3.1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/RiskGauge.tsx
git commit -m "feat: RiskGauge SVG arc component with dynamic risk level coloring"
```

---

## Task 7: TodayStats 컴포넌트

**Files:**
- Create: `src/components/dashboard/TodayStats.tsx`

오늘의 거래 요약 (체결 횟수, 오늘 승률, 최대 단일 수익, 실현 PnL).

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/TodayStats.tsx
"use client";

import useSWR from "swr";
import { cn, getPnlColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Execution {
  execId: string;
  closedPnl: string;
  execTime: string;
  side: string;
  symbol: string;
}

function StatBlock({ label, value, sub, valueClass }: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[1px] text-text-muted">{label}</span>
      <span className={cn("font-[family-name:var(--font-mono)] text-xl font-medium text-text-primary", valueClass)}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-text-dim">{sub}</span>}
    </div>
  );
}

export function TodayStats() {
  const { data: execData } = useSWR("/api/bybit/executions?limit=200", fetcher, {
    refreshInterval: 30000,
  });

  const allExecs: Execution[] = execData?.executions ?? [];

  // 오늘 날짜 (UTC 기준)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayExecs = allExecs.filter(
    (e) => parseInt(e.execTime) >= todayStart.getTime()
  );

  const closingExecs = todayExecs.filter((e) => parseFloat(e.closedPnl) !== 0);
  const wins = closingExecs.filter((e) => parseFloat(e.closedPnl) > 0);
  const losses = closingExecs.filter((e) => parseFloat(e.closedPnl) < 0);
  const totalPnl = closingExecs.reduce((sum, e) => sum + parseFloat(e.closedPnl), 0);
  const bestTrade = closingExecs.reduce(
    (max, e) => Math.max(max, parseFloat(e.closedPnl)),
    -Infinity
  );
  const winRate =
    closingExecs.length > 0 ? (wins.length / closingExecs.length) * 100 : 0;

  const hasData = todayExecs.length > 0;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Today
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim">
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {!hasData ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-xs text-text-muted">No activity today</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <StatBlock
            label="Executions"
            value={String(todayExecs.length)}
            sub={`${wins.length}W / ${losses.length}L`}
          />
          <StatBlock
            label="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            valueClass={getPnlColor(winRate - 50)}
          />
          <StatBlock
            label="Realized PnL"
            value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`}
            sub="USDT"
            valueClass={getPnlColor(totalPnl)}
          />
          <StatBlock
            label="Best Trade"
            value={bestTrade !== -Infinity ? `+${bestTrade.toFixed(2)}` : "--"}
            sub="USDT"
            valueClass="text-pnl-positive"
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/TodayStats.tsx
git commit -m "feat: TodayStats component with daily execution summary"
```

---

## Task 8: BenchmarkCompare 컴포넌트

**Files:**
- Create: `src/components/dashboard/BenchmarkCompare.tsx`

Rebeta vs BTC 누적 수익률 비교. 두 개의 큰 숫자 + Recharts 비교 라인 차트.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/BenchmarkCompare.tsx
"use client";

import useSWR from "swr";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { EquityCurvePoint, BenchmarkPoint } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BenchmarkCompare() {
  const { data: curveData } = useSWR("/api/bybit/equity-curve", fetcher, {
    refreshInterval: 300000,
  });
  const { data: benchData } = useSWR(
    "/api/bybit/benchmark?symbol=BTCUSDT&limit=1000",
    fetcher,
    { refreshInterval: 3600000 }
  );

  const curve: EquityCurvePoint[] = curveData?.curve ?? [];
  const btc: BenchmarkPoint[] = benchData?.series ?? [];

  // 시간 기준으로 두 시리즈 병합
  const rebetaLast = curve.length > 0 ? curve[curve.length - 1].value : 0;
  const btcLast = btc.length > 0 ? btc[btc.length - 1].value : 0;
  const alpha = rebetaLast - btcLast;

  // 차트용: curve 데이터 다운샘플
  const step = Math.max(1, Math.floor(curve.length / 60));
  const chartData = curve
    .filter((_, i) => i % step === 0)
    .map((c) => {
      const btcPoint = btc.find((b) => b.time === c.time);
      return {
        time: c.time,
        rebeta: parseFloat(c.value.toFixed(2)),
        btc: btcPoint ? parseFloat(btcPoint.value.toFixed(2)) : null,
      };
    });

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        vs BTC Benchmark
      </span>

      {/* 두 큰 숫자 */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-text-muted">Rebeta v3.1</p>
          <p className={cn(
            "mt-1 font-[family-name:var(--font-mono)] text-2xl font-medium",
            rebetaLast >= 0 ? "text-gold" : "text-pnl-negative"
          )}>
            {rebetaLast >= 0 ? "+" : ""}{rebetaLast.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">BTC (Hold)</p>
          <p className={cn(
            "mt-1 font-[family-name:var(--font-mono)] text-2xl font-medium",
            btcLast >= 0 ? "text-bronze" : "text-pnl-negative"
          )}>
            {btcLast >= 0 ? "+" : ""}{btcLast.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Alpha 배지 */}
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-gold/30 bg-gold/5 px-2 py-1">
        <span className="text-[10px] text-text-muted">Alpha</span>
        <span className={cn(
          "font-[family-name:var(--font-mono)] text-xs font-medium",
          alpha >= 0 ? "text-gold" : "text-pnl-negative"
        )}>
          {alpha >= 0 ? "+" : ""}{alpha.toFixed(1)}%
        </span>
      </div>

      {/* 비교 차트 */}
      {chartData.length > 1 && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" hide />
              <Tooltip
                contentStyle={{
                  background: "#161616",
                  border: "1px solid #2A2A2A",
                  borderRadius: "2px",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono",
                }}
                formatter={(v: number) => [`${v.toFixed(2)}%`]}
                labelFormatter={() => ""}
              />
              <Line
                type="monotone"
                dataKey="rebeta"
                stroke="#C5A049"
                strokeWidth={1.5}
                dot={false}
                name="Rebeta"
              />
              <Line
                type="monotone"
                dataKey="btc"
                stroke="#997B66"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="BTC"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/BenchmarkCompare.tsx
git commit -m "feat: BenchmarkCompare component with alpha calculation and dual line chart"
```

---

## Task 9: ScrollSection 래퍼 컴포넌트

**Files:**
- Create: `src/components/dashboard/ScrollSection.tsx`

Zone 2의 각 섹션을 감싸는 Intersection Observer 기반 애니메이션 래퍼.

**Step 1: 파일 생성**

```tsx
// src/components/dashboard/ScrollSection.tsx
"use client";

import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

interface Props {
  children: React.ReactNode;
  className?: string;
  label?: string;
  delay?: number; // ms
}

export function ScrollSection({ children, className, label, delay = 0 }: Props) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {label && (
        <p className="mb-3 text-[10px] uppercase tracking-[2px] text-text-dim">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
```

**Step 2: 커밋**
```bash
git add src/components/dashboard/ScrollSection.tsx
git commit -m "feat: ScrollSection wrapper with Intersection Observer reveal animation"
```

---

## Task 10: Overview 페이지 전체 재구성

**Files:**
- Modify: `src/app/dashboard/page.tsx`

Zone 1 + Zone 2 구조로 Overview 페이지 재조립.

**Step 1: page.tsx 전면 교체**

```tsx
// src/app/dashboard/page.tsx
import { HeroZone } from "@/components/dashboard/HeroZone";
import { LiveTickerStrip } from "@/components/dashboard/LiveTickerStrip";
import { LivePositionBar } from "@/components/dashboard/LivePositionBar";
import { ExecutionsFeed } from "@/components/dashboard/ExecutionsFeed";
import { RiskGauge } from "@/components/dashboard/RiskGauge";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MonthlyReturnsHeatmap } from "@/components/dashboard/MonthlyReturnsHeatmap";
import { BenchmarkCompare } from "@/components/dashboard/BenchmarkCompare";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { RollingMetrics } from "@/components/dashboard/RollingMetrics";
import { PnLDistribution } from "@/components/dashboard/PnLDistribution";
import { TodayStats } from "@/components/dashboard/TodayStats";
import { ScrollSection } from "@/components/dashboard/ScrollSection";

export default function OverviewPage() {
  return (
    <div className="min-h-screen">
      {/* ─── Zone 1: Hero ─── */}
      <HeroZone />

      {/* LiveTickerStrip: Zone 1 하단 고정 (sticky) */}
      <div className="sticky top-0 z-20 border-b border-border-subtle bg-bg-primary/95 backdrop-blur-sm">
        <LiveTickerStrip />
      </div>

      {/* ─── Zone 2: Intelligence Feed ─── */}
      <div className="space-y-12 px-6 py-12 lg:px-12">

        {/* Section 1: Live Activity */}
        <ScrollSection label="Live Activity">
          <div className="grid gap-4 lg:grid-cols-3">
            <LivePositionBar />
            <ExecutionsFeed />
            <RiskGauge />
          </div>
        </ScrollSection>

        {/* Section 2: Performance */}
        <ScrollSection label="Performance" delay={100}>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <PerformanceChart />
            <MonthlyReturnsHeatmap />
          </div>
        </ScrollSection>

        {/* Section 3: Market Context */}
        <ScrollSection label="Market Context" delay={100}>
          <div className="grid gap-4 lg:grid-cols-2">
            <BenchmarkCompare />
            <DrawdownChart />
          </div>
        </ScrollSection>

        {/* Section 4: Strategy Intelligence */}
        <ScrollSection label="Strategy Intelligence" delay={100}>
          <div className="grid gap-4 lg:grid-cols-3">
            <RollingMetrics />
            <PnLDistribution />
            <TodayStats />
          </div>
        </ScrollSection>

      </div>
    </div>
  );
}
```

**Step 2: 빌드 확인**
```bash
pnpm build
```
에러 없이 빌드 성공 확인.

**Step 3: 개발 서버로 시각적 확인**
```bash
pnpm dev
```
`http://localhost:3000/dashboard` 접속 후:
- [ ] Zone 1: 히어로 배경 그리드 보임
- [ ] Zone 1: 수익률 숫자 카운트업 애니메이션
- [ ] Zone 1: KPI 5개 카드 stagger 등장
- [ ] Zone 1: 스파크라인 좌→우 그려짐
- [ ] Zone 1 하단: 스크롤 힌트 화살표
- [ ] LiveTickerStrip: sticky 상단에 고정
- [ ] 스크롤 시 각 섹션 fadeIn
- [ ] Section 1: 3컬럼 (포지션/피드/게이지)
- [ ] Section 2: 퍼포먼스 차트 + 히트맵
- [ ] Section 3: BenchmarkCompare + Drawdown
- [ ] Section 4: Rolling/PnL/Today

**Step 4: 커밋**
```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: Overview LP redesign - Zone 1 hero + Zone 2 intelligence feed"
```

---

## Task 11: 최종 폴리싱

**Files:**
- Modify: `src/app/globals.css` (필요시 미세 조정)
- Modify: `src/components/layout/Header.tsx` (HeroZone에서 헤더 숨기거나 통합)

**Step 1: Header 확인**
현재 `HeroZone`에 Header가 없음. `src/components/layout/Header.tsx`를 읽고 HeroZone에 포함할지 결정.
- Header가 `layout.tsx`에 있다면: HeroZone에서 중복 제거
- Header가 각 page에서 import된다면: HeroZone 내부에 통합하거나 page.tsx에서 분리

**Step 2: 반응형 미세 조정**
모바일(< 768px)에서:
- Zone 1 숫자: `text-5xl`로 줄임 (현재 `lg:text-8xl` 이미 처리됨)
- KPI 카드: 2열 → 이미 `grid-cols-2` 처리됨
- Zone 2 3컬럼: 모바일에서 1컬럼으로 자동 스택

**Step 3: 최종 빌드 & 타입 체크**
```bash
pnpm build && pnpm lint
```

**Step 4: 커밋**
```bash
git add -A
git commit -m "polish: final adjustments for LP overview page"
```

---

## 완성 체크리스트

- [ ] Task 1: useInView 훅 + CSS 애니메이션
- [ ] Task 2: AnimatedSparkline (SVG stroke-dashoffset)
- [ ] Task 3: HeroZone (배경 그리드 + 카운터 + KPI + 스파크라인)
- [ ] Task 4: ExecutionsFeed (라이브 피드 + 새 항목 애니메이션)
- [ ] Task 5: LivePositionBar (방향 배지 + 바 그래프 + 실시간 PnL)
- [ ] Task 6: RiskGauge (SVG 반원 게이지 + 리스크 컬러)
- [ ] Task 7: TodayStats (일일 거래 요약)
- [ ] Task 8: BenchmarkCompare (Rebeta vs BTC + alpha 배지)
- [ ] Task 9: ScrollSection 래퍼 (Intersection Observer)
- [ ] Task 10: Overview 페이지 재조립
- [ ] Task 11: 최종 빌드 & 폴리싱
