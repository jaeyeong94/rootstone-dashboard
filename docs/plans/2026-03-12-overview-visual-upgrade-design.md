# Overview 페이지 비주얼 풀 리디자인

## 목표
LP 영업용 대시보드로서 "전략이 살아서 움직이고 있다"는 느낌을 시각적으로 전달.
클라이언트가 Wow 할 수 있는 퀀트펀드 수준의 차트, 라이브 피드, 인포그래픽 구현.

## 핵심 방향
1. **라이브니스 우선** — 실시간 틱, 애니메이션, 라이브 피드
2. **시각적 차트 대거 추가** — 숫자만 있던 것을 차트/히트맵/분포로 시각화
3. **핵심 성과 지표 노출** — Sharpe, Sortino, MDD, Win Rate 등 Overview에 표시
4. **벤치마크 비교** — BTC 대비 전략 우위 시각화
5. **5년 히스토리** — 백테스트(점선) + 라이브(실선) 구분 표시

## 차트 라이브러리
- 시계열 라인/에리어: **Lightweight Charts** (TradingView)
- 범용 (바, 히트맵, 분포): **Recharts** (신규 추가)

## 레이아웃 구조

```
┌─────────────────────────────────────────────────────────┐
│ HERO ZONE                                                │
│ ┌─────────────────────────────┬─────────────────────────┐ │
│ │ HeroStats                   │ LiveTickerStrip          │ │
│ │ 누적수익률 큰 숫자 + 스파크라인 │ 4개 코인 실시간 가격 피드  │ │
│ └─────────────────────────────┴─────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ STRATEGY METRICS BAR                                     │
│ Sharpe │ Sortino │ MDD │ Win Rate │ Avg Hold │ Live     │
├─────────────────────────────────────────────────────────┤
│ MAIN CHART ZONE                                          │
│ PerformanceChart (전략 vs BTC 벤치마크, 백테스트/라이브 구분) │
│ 기간: 1M / 3M / 6M / 1Y / 3Y / ALL                       │
├─────────────────────────────────────────────────────────┤
│ ANALYTICS GRID (2x2)                                     │
│ ┌──────────────────────┬──────────────────────────────┐   │
│ │ MonthlyReturnsHeatmap│ DrawdownChart                │   │
│ ├──────────────────────┼──────────────────────────────┤   │
│ │ PnLDistribution      │ RollingMetrics               │   │
│ └──────────────────────┴──────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ LIVE ACTIVITY                                            │
│ ┌──────────────────────┬──────────────────────────────┐   │
│ │ PositionCards         │ TradesFeed                   │   │
│ └──────────────────────┴──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 새 컴포넌트 (10개)

### 1. HeroStats
- 누적 수익률 큰 숫자 (JetBrains Mono, 48px+)
- Recharts 스파크라인 미니 차트 (최근 30일)
- 기간 토글: 24h / 7d / 30d / ALL
- 카운팅 애니메이션 (0 → 목표값)

### 2. LiveTickerStrip
- BTC, ETH, XRP, LTC 실시간 가격
- WebSocket 틱 시 flash 애니메이션 (gold/red 0.3초)
- 24h 변동률 표시
- 컴팩트 수평 레이아웃

### 3. StrategyMetricsBar
- Sharpe Ratio, Sortino Ratio, Max Drawdown, Win Rate, Avg Holding Period
- 수평 한 줄 배치, 각 지표 아이콘+라벨+값
- LIVE 인디케이터 포함

### 4. PerformanceChart (기존 EquityCurve 대체)
- Lightweight Charts, 전략 누적수익률 라인 (gold, 실선)
- BTC 벤치마크 라인 (bronze, 점선)
- 백테스트 구간: 점선 스타일 / 라이브 구간: 실선 스타일
- 전환점에 수직 라인 + "LIVE" 라벨
- 기간: 1M / 3M / 6M / 1Y / 3Y / ALL
- 크로스헤어에 양쪽 값 동시 표시

### 5. MonthlyReturnsHeatmap
- Recharts 기반 연도(행) × 월(열) 테이블
- 셀 색상: 진한 gold(+) ~ 진한 red(-), 그라데이션
- 연간 합계 열 포함
- 마우스 호버 시 상세 수치 표시

### 6. DrawdownChart
- Lightweight Charts 에리어 차트
- 0% 기준선 아래로 빨간 그라데이션 fill
- 최대 낙폭 포인트 마킹
- 크로스헤어로 상세 정보

### 7. PnLDistribution
- Recharts 막대 차트 (일별 PnL)
- 양수: gold 바, 음수: red 바
- X축: 날짜, Y축: 일일 수익률(%)

### 8. RollingMetrics
- Lightweight Charts 멀티 라인
- 롤링 30일 Sharpe Ratio (gold)
- 롤링 30일 Volatility (bronze)
- 듀얼 Y축

### 9. PositionCards (기존 PositionCard 강화)
- 각 포지션별 독립 카드
- 미니 가격 차트 (최근 24h 캔들)
- 진입가 수평선 표시
- 실시간 PnL 숫자 깜빡임

### 10. TradesFeed (기존 RecentActivity 대체)
- 타임라인 스타일 (세로 라인 + 노드)
- 새 거래 발생 시 위에서 슬라이드인 애니메이션
- Buy: gold dot, Sell: red dot
- 상대 시간 표시 ("2분 전")

## 라이브 효과

| 효과 | 위치 | 구현 |
|------|------|------|
| 틱 플래시 | LiveTickerStrip, PositionCards | CSS transition, gold/red 0.3초 |
| 카운팅 애니메이션 | HeroStats | requestAnimationFrame, 1초 카운트업 |
| LIVE 펄스 | StrategyMetricsBar | CSS animate-pulse, 녹색 dot |
| 슬라이드인 | TradesFeed | CSS transform + opacity transition |
| 차트 실시간 점 | PerformanceChart | Lightweight Charts update() |
| 숫자 전환 | 모든 수치 | CSS num-transition (기존) |

## 새 API 엔드포인트

### GET /api/bybit/metrics
- 응답: { sharpe, sortino, mdd, winRate, avgHoldingHours, totalReturn }
- 계산: balance_snapshots + closed-pnl 기반

### GET /api/bybit/monthly-returns
- 응답: { returns: [{ year, month, return }] }
- 계산: balance_snapshots 월별 집계

### GET /api/bybit/drawdown
- 응답: { series: [{ time, drawdown }] }
- 계산: balance_snapshots 고점 대비 하락률

### GET /api/bybit/benchmark?symbol=BTCUSDT&period=ALL
- 응답: { series: [{ time, value }] }
- 데이터: Bybit Public kline API

### GET /api/bybit/rolling-metrics?window=30
- 응답: { sharpe: [{time, value}], volatility: [{time, value}] }
- 계산: balance_snapshots 롤링 윈도우

## 백테스트 데이터

- `public/data/backtest.json` — 일별 누적 수익률
- `public/data/backtest-btc.json` — BTC 일봉 벤치마크
- 차트에서 백테스트↔라이브 전환점 수직선 표시

## 디자인 토큰 (기존 유지)

- 배경: #0F0F0F / 카드: #161616
- 수익 Gold: #C5A049 / 손실 Red: #EF4444
- 액센트 Bronze: #997B66
- 폰트: Manrope(헤딩) / Inter(본문) / JetBrains Mono(숫자)
