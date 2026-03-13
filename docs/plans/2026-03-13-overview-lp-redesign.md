# Overview LP Redesign — Design Document
Date: 2026-03-13

## Goal
LP(Limited Partner) 영업용 페이지로서 Overview를 재설계. 실시간성, 퍼포먼스, 전략 정교함 세 가지를 동시에 전달하는 "Wow" 페이지.

## Target Audience
- 퀀트/알고 트레이딩 전문가부터 일반 투자자까지 혼재
- 사용 시나리오: 운용사 미팅 중 화면 공유 + LP 독립적 모니터링 포털

## Architecture: Two-Zone Layout

### Zone 1 — Hero (~100vh, 첫 화면)

목적: 첫 인상. 미팅 시 메인 슬라이드 역할.

**레이아웃**
```
Header (기존) — ROOTSTONE | ● LIVE
─────────────────────────────────────────
서브타이틀: "Rebeta v3.1 is live."

[누적 수익률 카운터]
  +1,847.3%
  Since Mar 2022 · 1,461 days live

[KPI 5개 카드 — 가로 배열]
  Sharpe | Sortino | Max DD | Win Rate | Today PnL

[에쿼티 커브 스파크라인 — 전체 너비]
  얇은 골드 라인, 로드 시 좌→우로 그려짐

[LiveTickerStrip — 기존 강화]
  BTC · ETH · SOL · BNB 실시간 가격
```

**애니메이션 (로드 시)**
1. 배경 그리드 패턴 페이드인 (0.3s)
2. 서브타이틀 페이드인 (0.5s)
3. 누적 수익률 카운터 0 → 현재값 카운트업 (2s, easeOut)
4. KPI 카드 stagger 페이드인 (0.1s 간격)
5. 에쿼티 커브 SVG stroke-dashoffset 애니메이션 (1.5s)

**배경**: 미세 그리드 패턴 (#997B66 @ 10% opacity)

---

### Zone 2 — Intelligence Feed (스크롤 영역)

각 섹션은 뷰포트 진입 시 fade-in + translateY(-16px) 애니메이션 (Intersection Observer).

#### Section 1: LIVE ACTIVITY (3컬럼)
- **LivePositionBar**: 현재 오픈 포지션을 심볼별 바 그래프로 표시 (Long/Short 방향, 레버리지, 미실현 PnL)
- **ExecutionsFeed**: 최근 체결 내역 스트리밍 피드. 새 체결 감지 시 상단 삽입 + 슬라이드다운 애니메이션
- **RiskGauge**: 원형 SVG 게이지. 마진 사용률 기반 리스크 레벨 (green < 30% / gold 30-70% / red > 70%)

#### Section 2: PERFORMANCE (2컬럼)
- **EquityCurve** (기존 강화): BTC 벤치마크 오버레이 추가 + 기간 필터 (1M/3M/6M/1Y/ALL)
- **MonthlyReturnsHeatmap** (기존 유지)

#### Section 3: MARKET CONTEXT (2컬럼)
- **BenchmarkChart**: Rebeta vs BTC 누적 수익률 비교 오버레이 차트 (Recharts)
- **DrawdownChart** (기존 유지)

#### Section 4: STRATEGY INTELLIGENCE (3컬럼)
- **RollingMetrics** (기존 유지)
- **PnLDistribution** (기존 유지)
- **TodayStats**: 오늘 거래 횟수, 승/패 비율, 최대 단일 수익, 실현 PnL 요약

---

## New Components

| 컴포넌트 | 파일 | 데이터 소스 |
|---------|------|-----------|
| `LivePositionBar` | `components/dashboard/LivePositionBar.tsx` | `/api/bybit/positions` (5초 폴링) |
| `ExecutionsFeed` | `components/dashboard/ExecutionsFeed.tsx` | `/api/bybit/executions` + SWR |
| `RiskGauge` | `components/dashboard/RiskGauge.tsx` | positions + balance 계산 |
| `BenchmarkChart` | `components/dashboard/BenchmarkChart.tsx` | `/api/bybit/benchmark` |
| `TodayStats` | `components/dashboard/TodayStats.tsx` | `/api/bybit/pnl` + executions |
| `HeroSparkline` | `components/dashboard/HeroSparkline.tsx` | `/api/bybit/equity-curve` |

## Existing Components (재배치)

Zone 1으로 이동:
- `HeroStats` → 수익률 카운터 + KPI 5개로 재설계
- `LiveTickerStrip` → Zone 1 하단 고정

Zone 2로 재배치:
- `PerformanceChart` → Section 2 (BTC 오버레이 추가)
- `MonthlyReturnsHeatmap` → Section 2
- `DrawdownChart` → Section 3
- `RollingMetrics` → Section 4
- `PnLDistribution` → Section 4

## Design Tokens (기존 유지)
- 배경: `#0F0F0F`
- 카드: `#161616`
- 액센트: `#997B66` (bronze)
- 데이터: `#C5A049` (gold)
- 음수: `#EF4444`
- 폰트: Manrope (헤딩) / Inter (본문) / JetBrains Mono (숫자)

## Scroll Behavior
- Intersection Observer API로 섹션 진입 감지
- `will-change: opacity, transform` 최적화
- 모바일 대응은 이번 스코프 외 (데스크탑 우선)
