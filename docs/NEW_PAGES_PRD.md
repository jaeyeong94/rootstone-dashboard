# New Pages PRD - Rootstone Dashboard v2

> 5개 신규 페이지 상세 기획 문서
> 작성일: 2026-03-13

---

## 구현 순서

| # | 페이지 | 경로 | 우선순위 | 난이도 |
|---|--------|------|----------|--------|
| 1 | Risk Monitor | `/dashboard/risk` | Tier 1 | 중 |
| 2 | Reports | `/dashboard/reports` | Tier 1 | 중-상 |
| 3 | Market Regime | `/dashboard/regime` | Tier 1 | 상 |
| 4 | Trading Calendar | `/dashboard/calendar` | Tier 2 | 중 |
| 5 | Correlation & Portfolio Fit | `/dashboard/correlation` | Tier 3 | 상 |

---

## 1. Risk Monitor (`/dashboard/risk`)

### 1.1 목적
Rebeta v3.1의 리스크 프레임워크(Strategy 페이지에서 설명)를 **실시간**으로 시각화.
투자자가 "지금 리스크가 얼마나 사용되고 있는가"를 한눈에 파악할 수 있어야 함.

### 1.2 섹션 구성

#### A. Exposure Dashboard (상단 히어로)
- **Gross Exposure 게이지**: 현재 Gross Exposure / x3 한도 (반원형 게이지)
  - 계산: `Σ |positionValue| / totalEquity`
  - 색상: <1x 그린, 1x~2x 골드, 2x~3x 레드
- **Net Exposure 게이지**: Long - Short 노출도
  - 계산: `(Σ longValue - Σ shortValue) / totalEquity`
- **Position Count**: 현재 오픈 포지션 수 / 4 (최대)
- **Leverage 평균**: 전체 포지션의 가중 평균 레버리지

#### B. Monthly Drawdown Tracker
- 당월 Realized Drawdown 진행 바
  - 기준: -10% hard stop
  - 현재 월초 대비 하락률 표시
  - 바 색상: 0%~-3% 그린, -3%~-7% 옐로, -7%~-10% 레드
- 월별 히스토리 (최근 6개월 미니 바 차트)

#### C. Position Concentration
- 자산별 비중 도넛 차트 (BTC, ETH, XRP, LTC)
  - 각 자산의 포지션 가치 비중 (%)
- 방향별 (Long vs Short) 비중 바

#### D. Exposure History Chart
- 시간축 라인 차트 (최근 30일)
  - Gross Exposure 라인
  - Net Exposure 라인
  - x3 한도 점선
- 데이터: balance_snapshots 테이블에서 계산 (새 필드 추가 필요)

#### E. Risk Parameters Status
- 테이블: Strategy 페이지의 Risk Parameters와 동일 구조
  - Max Gross Exposure: x3 → 현재 값 표시
  - Monthly Drawdown: -10% → 현재 값 표시
  - Holding Period: max 24h → 현재 가장 오래된 포지션 표시
- 각 행에 상태 뱃지: SAFE / WARNING / BREACH

### 1.3 API 엔드포인트

#### `GET /api/bybit/risk-metrics`
```typescript
interface RiskMetrics {
  grossExposure: number;      // x배수 (예: 1.5)
  netExposure: number;        // 비율 (예: 0.3 = 30% long-biased)
  maxGrossLimit: number;      // 3.0
  positionCount: number;
  maxPositions: number;       // 4
  avgLeverage: number;
  monthlyDrawdown: number;    // 당월 시작 대비 변동 (%)
  monthlyDrawdownLimit: number; // -10
  longestHoldingHours: number;
  maxHoldingHours: number;    // 24
  concentrations: {
    symbol: string;
    weight: number;           // 0~1
    side: "Buy" | "Sell";
    exposure: number;         // x배수
  }[];
}
```

#### `GET /api/bybit/exposure-history`
- DB: balance_snapshots + positions 스냅샷에서 계산
- 일별 gross/net exposure 시계열

### 1.4 데이터 소스
- `getWalletBalance()` → totalEquity
- `getPositions()` → 현재 포지션 목록
- `balanceSnapshots` 테이블 → 월초 기준 equity, 히스토리

### 1.5 DB 스키마 변경
```typescript
// balance_snapshots 테이블에 추가 필드
grossExposure: doublePrecision("gross_exposure"),
netExposure: doublePrecision("net_exposure"),
positionCount: integer("position_count"),
```

---

## 2. Reports (`/dashboard/reports`)

### 2.1 목적
투자자가 특정 기간의 성과를 요약된 리포트로 조회/다운로드.
"정기 보고서" 역할 → 투자자 미팅, 내부 보고에 활용.

### 2.2 섹션 구성

#### A. Report Period Selector (상단)
- 프리셋: Last Month / Last Quarter / Last Year / Custom Range
- 커스텀: DatePicker (시작일 ~ 종료일)
- "Generate Report" 버튼

#### B. Executive Summary
- 기간 수익률 (%)
- 기간 Sharpe Ratio
- 기간 Max Drawdown
- 거래 횟수
- 승률 (Win Rate)
- BTC 대비 Alpha

#### C. Equity Curve (기간 내)
- 선택 기간의 누적 수익률 차트
- BTC 벤치마크 오버레이

#### D. Monthly Returns Grid (기간 내)
- 월별 수익률 히트맵 (기간 필터 적용)
- 기간 내 Best/Worst Month 하이라이트

#### E. Trade Highlights
- 기간 내 Top 5 수익 거래
- 기간 내 Top 5 손실 거래
- 각 거래: Symbol, Side, Entry→Exit, PnL(%), Holding Time

#### F. Risk Summary
- 기간 내 최대 드로다운
- 평균 Gross Exposure
- VaR (95%) 추정치

#### G. Export Actions
- "Download PDF" 버튼 → 브라우저 인쇄 기반 PDF 생성 (`@media print`)
- 디자인: 인쇄 시 흰 배경 + ROOTSTONE 로고 헤더 + Confidential 워터마크

### 2.3 API 엔드포인트

#### `GET /api/reports/summary`
```typescript
// Query: ?start=2026-01-01&end=2026-01-31
interface ReportSummary {
  period: { start: string; end: string };
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
  btcReturn: number;
  alpha: number;
  equityCurve: { time: string; value: number }[];
  btcCurve: { time: string; value: number }[];
  monthlyReturns: { year: number; month: number; return: number }[];
  topWins: TradeHighlight[];
  topLosses: TradeHighlight[];
  avgGrossExposure: number;
  var95: number;
}

interface TradeHighlight {
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  holdingHours: number;
  closedAt: string;
}
```

### 2.4 데이터 소스
- `balanceSnapshots` → 기간 내 equity 시계열
- `getClosedPnl()` → 기간 내 거래 내역
- BTC 벤치마크: 기존 `/api/bybit/benchmark` 활용

### 2.5 인쇄 스타일
```css
@media print {
  /* 다크 → 라이트 변환 */
  body { background: white; color: #1a1a1a; }
  .sidebar, .header, .no-print { display: none; }
  .report-content { max-width: 800px; margin: 0 auto; }
  /* ROOTSTONE 로고 + Confidential 헤더 */
}
```

---

## 3. Market Regime (`/dashboard/regime`)

### 3.1 목적
Strategy 페이지에서 설명한 3가지 마켓 레짐(Core/Crisis/Challenging)의 **현재 상태**를 라이브로 시각화.
"전략이 지금 어떤 모드로 작동 중인가"를 보여주는 킬러 피처.

### 3.2 주의사항
실제 모델의 레짐 판단은 내부 시스템에서 이루어짐. 대시보드에서는 **시장 데이터 기반 프록시 지표**로 레짐을 추정.
정확한 모델 신호가 아닌 "시장 상태 근사치"임을 명시.

### 3.3 섹션 구성

#### A. Current Regime Hero
- 대형 레짐 표시 카드 (풀 와이드)
  - 레짐 이름: CORE / CRISIS / CHALLENGING
  - 아이콘 + 색상 (Core: 골드, Crisis: 레드, Challenging: 옐로)
  - Confidence 레벨 바 (70~100%)
  - 부제: "Normal trending markets — Full signal deployment" 등
- 마지막 업데이트 시각

#### B. Regime Indicators (3열 그리드)
- **Volatility Index**: 현재 BTC 30일 실현 변동성
  - Normal (<50%), Elevated (50-80%), Extreme (>80%)
- **Correlation Breakdown Score**: BTC-ETH 상관관계 변화
  - Normal (>0.7), Weakening (0.4-0.7), Breakdown (<0.4)
- **Momentum Score**: 4자산 평균 모멘텀
  - Positive / Neutral / Negative

#### C. Regime Timeline
- 가로 타임라인 바 (최근 90일)
  - Core: 골드 구간
  - Crisis: 레드 구간
  - Challenging: 옐로 구간
- 마우스 오버 → 해당 날짜의 레짐 + 수익률

#### D. Regime Performance Stats
- 3x3 그리드: 각 레짐에서의 평균 일일 수익률, 총 일수, 수익률 합계
- 데이터: balanceSnapshots + 레짐 분류 결합

#### E. Market Context Panel
- 현재 시장 데이터 요약
  - BTC 30d Volatility
  - BTC-ETH Rolling Correlation (30d)
  - Fear & Greed Index (선택적 - 외부 API)
  - 최근 7일 수익률 vs 평균

### 3.4 레짐 판정 로직 (프록시)
```typescript
function estimateRegime(
  btcVolatility30d: number,
  btcEthCorrelation: number,
  btcReturn7d: number,
): "core" | "crisis" | "challenging" {
  // Crisis: 변동성 극단 + 상관관계 붕괴 + 급락
  if (btcVolatility30d > 80 && btcReturn7d < -10) return "crisis";
  // Challenging: 중간 변동성 + 불확실
  if (btcVolatility30d > 50 || (btcReturn7d > -10 && btcReturn7d < -3)) return "challenging";
  // Core: 정상 범위
  return "core";
}
```

### 3.5 API 엔드포인트

#### `GET /api/bybit/regime`
```typescript
interface RegimeData {
  currentRegime: "core" | "crisis" | "challenging";
  confidence: number;         // 0~1
  indicators: {
    btcVolatility30d: number;
    btcEthCorrelation: number;
    momentumScore: number;
    btcReturn7d: number;
  };
  timeline: {
    date: string;
    regime: "core" | "crisis" | "challenging";
    dailyReturn: number;
  }[];
  regimeStats: {
    regime: string;
    avgDailyReturn: number;
    totalDays: number;
    totalReturn: number;
  }[];
  updatedAt: string;
}
```

### 3.6 데이터 소스
- `getKlines()` (Bybit Kline API) → BTC, ETH 가격 시계열
  - Bybit: `/v5/market/kline?category=linear&symbol=BTCUSDT&interval=D&limit=90`
- 변동성: 일일 수익률의 표준편차 × √365
- 상관관계: BTC-ETH 일일 수익률 피어슨 상관계수 (30일 롤링)
- `balanceSnapshots` → 일별 전략 수익률

---

## 4. Trading Calendar (`/dashboard/calendar`)

### 4.1 목적
일별 수익률을 캘린더 뷰로 시각화. 특정 날짜의 거래 활동을 드릴다운.
"언제 무슨 일이 있었나?"를 직관적으로 파악.

### 4.2 섹션 구성

#### A. Calendar View (메인)
- 월간 캘린더 그리드 (7열 × 4~6행)
- 각 셀:
  - 날짜
  - 일일 수익률 (%) → 색상 코딩 (수익 골드, 손실 레드, 강도에 따라 투명도)
  - 거래 건수 작은 뱃지
  - 레짐 작은 도트 (optional)
- 월 네비게이션: ← 이전월 / 현재월 표시 / 다음월 →
- 연간 보기 토글: 12개월 미니 히트맵 (GitHub contribution 스타일)

#### B. Day Detail Panel (날짜 클릭 시)
- 슬라이드 오버 또는 하단 확장 패널
- 해당일 요약:
  - 일일 수익률
  - 오픈/클로즈한 포지션 수
  - 총 거래 건수
  - 가장 큰 수익/손실 거래
- 해당일 거래 목록 (History 페이지의 테이블과 동일 포맷)

#### C. Monthly Summary Strip
- 캘린더 하단에 월간 통계:
  - 총 수익률, 거래일 수, 승률, 최고/최저일

### 4.3 API 엔드포인트

#### `GET /api/calendar/monthly`
```typescript
// Query: ?year=2026&month=3
interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
  summary: {
    totalReturn: number;
    tradingDays: number;
    winRate: number;
    bestDay: { date: string; return: number };
    worstDay: { date: string; return: number };
  };
}

interface CalendarDay {
  date: string;              // YYYY-MM-DD
  dailyReturn: number;       // %
  tradeCount: number;
  positionsOpened: number;
  positionsClosed: number;
  topTrade: {
    symbol: string;
    pnlPercent: number;
  } | null;
}
```

#### `GET /api/calendar/day-detail`
```typescript
// Query: ?date=2026-03-10
interface CalendarDayDetail {
  date: string;
  dailyReturn: number;
  trades: {
    symbol: string;
    side: string;
    execPrice: string;
    execQty: string;
    execTime: string;
    pnl: number;
  }[];
  positionChanges: {
    symbol: string;
    action: "opened" | "closed";
    pnl?: number;
  }[];
}
```

### 4.4 데이터 소스
- `balanceSnapshots` → 일별 equity → 일일 수익률
- `getClosedPnl()` → 기간 내 체결 거래
- `getExecutions()` → 상세 실행 내역

---

## 5. Correlation & Portfolio Fit (`/dashboard/correlation`)

### 5.1 목적
Rebeta가 기존 포트폴리오의 "구조적 보완재"임을 데이터로 증명.
투자자가 직접 포트폴리오 비중을 조절해보고 효과를 시뮬레이션.

### 5.2 섹션 구성

#### A. Correlation Matrix (상단)
- 4x4 히트맵: Rebeta / BTC / ETH / S&P 500
  - 셀 색상: 상관관계 -1(파랑) ~ 0(흰색) ~ +1(레드)
  - 기간 선택: 30d / 90d / 180d / All
- 핵심 메시지: "Rebeta의 BTC 상관관계: 0.14"

#### B. Rolling Correlation Chart
- 롤링 상관계수 라인 차트 (30일 윈도우)
  - Rebeta vs BTC
  - Rebeta vs ETH
- X축: 시간, Y축: -1 ~ +1
- 주요 이벤트 마커 (블랙 스완 시기에 상관관계 변화)

#### C. Portfolio Simulator
- 인터랙티브 슬라이더:
  - BTC: 0~100%
  - Rebeta: 0~100%
  - (합계 = 100%)
- 시뮬레이션 결과:
  - 혼합 포트폴리오의 누적 수익률 차트
  - 지표 비교 테이블: 순수 BTC vs 혼합 vs 순수 Rebeta
    - Cumulative Return, CAGR, Sharpe, Sortino, Max DD, Volatility
  - 프리셋: "60/40 BTC/Rebeta", "80/20", "50/50"

#### D. Efficient Frontier (심화)
- 산점도: X축 = 변동성, Y축 = 수익률
  - BTC only 점
  - Rebeta only 점
  - 다양한 혼합 비율 점들 (10% 단위)
  - 효율적 프론티어 곡선
- 최적 비율 하이라이트

#### E. Key Insights Panel
- 자동 생성 인사이트:
  - "Rebeta 20% 추가 시 Sharpe 40% 개선, MDD 35% 감소"
  - "최적 배분: BTC 65% + Rebeta 35% (Sharpe 최대화)"

### 5.3 API 엔드포인트

#### `GET /api/correlation/matrix`
```typescript
// Query: ?period=90d
interface CorrelationMatrix {
  period: string;
  assets: string[];             // ["Rebeta", "BTC", "ETH"]
  matrix: number[][];           // correlation coefficients
  rollingCorrelation: {
    time: string;
    rebetaBtc: number;
    rebetaEth: number;
  }[];
}
```

#### `GET /api/correlation/simulate`
```typescript
// Query: ?btcWeight=60&rebetaWeight=40
interface SimulationResult {
  weights: { btc: number; rebeta: number };
  equityCurve: { time: string; value: number }[];
  metrics: {
    cumulativeReturn: number;
    cagr: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    volatility: number;
  };
  comparison: {
    label: string;
    metrics: SimulationResult["metrics"];
  }[];
}
```

#### `GET /api/correlation/frontier`
```typescript
interface EfficientFrontier {
  points: {
    btcWeight: number;
    rebetaWeight: number;
    expectedReturn: number;
    volatility: number;
    sharpe: number;
  }[];
  optimalSharpe: {
    btcWeight: number;
    rebetaWeight: number;
  };
}
```

### 5.4 데이터 소스
- `balanceSnapshots` → Rebeta 일별 수익률
- Bybit Kline API → BTC, ETH 일별 가격
- S&P 500: 외부 API 또는 하드코딩된 데이터 (선택적)
- 시뮬레이션: 서버 사이드 계산 (NumPy 스타일 TS 구현)

---

## 공통 사항

### 디자인 가이드라인
- 기존 ROOTSTONE 디자인 시스템 100% 준수
- 배경: #0F0F0F / 카드: #161616 / 보더: #333333
- 폰트: Manrope(헤딩), Inter(본문), JetBrains Mono(숫자)
- 네비게이션: UPPERCASE + letter-spacing: 1px
- 수익 컬러: #C5A049 (골드) / 손실: #EF4444 (레드)
- 카드 스타일: rounded-sm, border border-border-subtle bg-bg-card

### 사이드바 네비게이션 업데이트
```typescript
const navigation = [
  { name: "OVERVIEW", href: "/dashboard", icon: LayoutDashboard },
  { name: "POSITIONS", href: "/dashboard/positions", icon: BarChart3 },
  { name: "HISTORY", href: "/dashboard/history", icon: History },
  { name: "RISK", href: "/dashboard/risk", icon: ShieldAlert },
  { name: "REGIME", href: "/dashboard/regime", icon: Activity },
  { name: "CALENDAR", href: "/dashboard/calendar", icon: CalendarDays },
  { name: "REPORTS", href: "/dashboard/reports", icon: FileBarChart },
  { name: "CORRELATION", href: "/dashboard/correlation", icon: GitCompare },
  { name: "STRATEGY", href: "/dashboard/strategy", icon: BookOpen },
  { name: "PERFORMANCE", href: "/dashboard/performance", icon: TrendingUp },
  { name: "SETTINGS", href: "/dashboard/settings", icon: Settings },
];
```

### 인증
- 모든 API 라우트: `getServerSession(authOptions)` 체크
- 401 반환 시 클라이언트에서 `/login`으로 리다이렉트

### 에러 처리
- API 실패 시: skeleton 대신 에러 메시지 + 재시도 버튼
- Bybit API 타임아웃: 기본 10초 → 에러 표시

### 반응형
- 데스크톱 우선 (1200px+)
- 태블릿 (768px~1200px): 그리드 열 축소
- 모바일: 기본 레이아웃 (스크롤 뷰)

---

## 파일 구조 (예상)

```
src/
├── app/dashboard/
│   ├── risk/page.tsx
│   ├── reports/page.tsx
│   ├── regime/page.tsx
│   ├── calendar/page.tsx
│   └── correlation/page.tsx
├── app/api/
│   ├── bybit/
│   │   ├── risk-metrics/route.ts
│   │   ├── exposure-history/route.ts
│   │   └── regime/route.ts
│   ├── reports/
│   │   └── summary/route.ts
│   ├── calendar/
│   │   ├── monthly/route.ts
│   │   └── day-detail/route.ts
│   └── correlation/
│       ├── matrix/route.ts
│       ├── simulate/route.ts
│       └── frontier/route.ts
├── components/
│   ├── risk/
│   │   ├── ExposureGauge.tsx
│   │   ├── DrawdownTracker.tsx
│   │   ├── ConcentrationChart.tsx
│   │   ├── ExposureHistory.tsx
│   │   └── RiskParamsTable.tsx
│   ├── reports/
│   │   ├── ReportPeriodSelector.tsx
│   │   ├── ExecutiveSummary.tsx
│   │   ├── TradeHighlights.tsx
│   │   └── ReportPrintLayout.tsx
│   ├── regime/
│   │   ├── RegimeHero.tsx
│   │   ├── RegimeIndicators.tsx
│   │   ├── RegimeTimeline.tsx
│   │   └── RegimeStats.tsx
│   ├── calendar/
│   │   ├── CalendarGrid.tsx
│   │   ├── CalendarCell.tsx
│   │   ├── DayDetailPanel.tsx
│   │   ├── MonthNavigator.tsx
│   │   └── YearHeatmap.tsx
│   └── correlation/
│       ├── CorrelationMatrix.tsx
│       ├── RollingCorrelationChart.tsx
│       ├── PortfolioSimulator.tsx
│       ├── EfficientFrontier.tsx
│       └── InsightsPanel.tsx
├── lib/
│   ├── math/
│   │   ├── correlation.ts      # 상관관계 계산
│   │   ├── statistics.ts       # 변동성, VaR, Sharpe 등
│   │   ├── portfolio.ts        # 포트폴리오 시뮬레이션
│   │   └── regime.ts           # 레짐 판정 로직
│   └── bybit/
│       └── kline.ts            # Kline(캔들) API 클라이언트
└── types/
    └── index.ts                # 신규 타입 추가
```

---

## 테스트 전략 (TDD)

### Unit Tests
1. **수학 함수** (`lib/math/`):
   - `correlation.ts`: 피어슨 상관계수, 롤링 상관계수
   - `statistics.ts`: 실현 변동성, VaR, Sharpe, Sortino, MDD
   - `portfolio.ts`: 포트폴리오 혼합 수익률, 효율적 프론티어
   - `regime.ts`: 레짐 판정 로직
2. **API 라우트**: 각 엔드포인트 응답 구조 검증
3. **유틸리티**: 날짜 계산, 포맷팅

### Integration Tests
1. **API → 컴포넌트 데이터 플로우**: fetch → state → render
2. **인쇄 레이아웃**: Reports 페이지의 print CSS 적용 확인

### Component Tests
1. **ExposureGauge**: 다양한 exposure 값에 따른 색상/각도 렌더링
2. **CalendarGrid**: 월별 데이터 렌더링, 날짜 클릭 이벤트
3. **PortfolioSimulator**: 슬라이더 조작 → 결과 업데이트
4. **CorrelationMatrix**: 히트맵 색상 매핑

---

## 성공 기준

1. 모든 페이지가 기존 디자인 시스템과 100% 일관성 유지
2. API 응답 시간 < 2초 (모든 엔드포인트)
3. 실시간 데이터 (positions, tickers)와 정합성 보장
4. 인쇄 PDF가 프로페셔널한 리포트 수준
5. 절대 금액 노출 없음 (% 표시만)
6. 모든 수학 함수에 대한 단위 테스트 통과
