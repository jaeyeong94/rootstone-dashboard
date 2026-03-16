/**
 * Centralized constants for the Rootstone Dashboard.
 * 수식이나 날짜 변경 시 이 파일만 수정하면 전체 반영됨.
 */

// ── Strategy Dates ──
/** Rebeta 전략 최초 운용 시작일 (v1) */
export const STRATEGY_INCEPTION_DATE = "2021-03-02";
/** Rebeta v3.1 운용 시작일 */
export const V31_START_DATE = "2024-11-17";

// ── Annualization ──
/** 변동성/Sharpe/Sortino 연환산 계수 (크립토 24/7 → 365일) */
export const ANNUALIZATION_DAYS = 365;
/** CAGR 계산용 연간 일수 (윤년 보정) */
export const CALENDAR_DAYS_PER_YEAR = 365.25;

// ── Risk Parameters ──
/** 무위험이자율 가정 (크립토 시장 관행: 0%) */
export const RISK_FREE_RATE = 0;

// ── Composite Tearsheet Metrics (Single Source of Truth) ──
/** v1~v3.1 전체 기간 통합 지표 (qstats v0.1.33 · 2021.03.02 ~ 2026.02.16) */
export const COMPOSITE_TEARSHEET = {
  period: { start: "2021-03-02", end: "2026-02-16" },
  rebeta: {
    cumulativeReturn: 872.2,
    cagr: 58.1,
    sharpe: 1.9096,
    sortino: 3.2160,
    calmar: 2.6374,
    maxDrawdown: -22.0,
    maxDrawdownPrecise: -22.03,
    maxDrawdownDuration: 121,
    volatility: 25.7,
  },
  btc: {
    cumulativeReturn: 40.6,
    cagr: 7.1,
    sharpe: 0.4050,
    sortino: 0.5850,
    calmar: 0.0927,
    maxDrawdown: -76.7,
    maxDrawdownDuration: 846,
    volatility: 56.7,
  },
};

// ── Period Filters ──
export const PERIOD_DAYS = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
} as const;
