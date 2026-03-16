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

// ── Period Filters ──
export const PERIOD_DAYS = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
} as const;
