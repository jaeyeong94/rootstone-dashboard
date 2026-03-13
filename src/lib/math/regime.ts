/**
 * Market regime detection utilities
 * Proxy-based estimation using market data signals
 */

import { realizedVolatility } from "./statistics";
import { pearsonCorrelation } from "./correlation";

export type RegimeType = "core" | "crisis" | "challenging";

export interface RegimeResult {
  regime: RegimeType;
  confidence: number;
  indicators: {
    btcVolatility30d: number;
    btcEthCorrelation: number;
    momentumScore: number;
    btcReturn7d: number;
  };
}

/**
 * Estimate current market regime from market data
 *
 * Regime definitions (from Strategy page):
 * - Core (~70%): Normal trending/mean-reverting markets
 * - Crisis (~10%): Extreme volatility and correlation breakdown
 * - Challenging (~20%): Choppy, low-conviction environments
 */
export function estimateRegime(
  btcDailyReturns30d: number[],
  ethDailyReturns30d: number[],
  btcReturn7d: number,
  allAssetReturns7d: number[] // BTC, ETH, XRP, LTC 7d returns
): RegimeResult {
  // 1. BTC 30d realized volatility (annualized %)
  const btcVol = realizedVolatility(btcDailyReturns30d) * 100;

  // 2. BTC-ETH correlation (30d rolling)
  const btcEthCorr = pearsonCorrelation(btcDailyReturns30d, ethDailyReturns30d);

  // 3. Momentum score: average of 4-asset 7d returns
  const momentumScore =
    allAssetReturns7d.length > 0
      ? allAssetReturns7d.reduce((a, b) => a + b, 0) / allAssetReturns7d.length
      : 0;

  // Regime classification
  let regime: RegimeType;
  let confidence: number;

  if (btcVol > 80 && btcReturn7d < -10) {
    // Crisis: extreme volatility + sharp decline
    regime = "crisis";
    confidence = Math.min(0.95, 0.7 + (btcVol - 80) / 100 + Math.abs(btcReturn7d) / 50);
  } else if (btcVol > 60 && btcReturn7d < -5) {
    // High stress but not full crisis
    regime = "crisis";
    confidence = 0.6 + (btcVol - 60) / 200;
  } else if (
    btcVol > 50 ||
    btcEthCorr < 0.4 ||
    (btcReturn7d < -3 && btcReturn7d >= -10)
  ) {
    // Challenging: elevated volatility or weak correlation or mild decline
    regime = "challenging";
    confidence = 0.65 + (btcVol > 50 ? 0.1 : 0) + (btcEthCorr < 0.4 ? 0.1 : 0);
  } else {
    // Core: normal conditions
    regime = "core";
    confidence = Math.min(
      0.95,
      0.7 + (btcEthCorr > 0.7 ? 0.1 : 0) + (btcVol < 30 ? 0.1 : 0)
    );
  }

  confidence = Math.min(Math.max(confidence, 0.5), 0.95);

  return {
    regime,
    confidence,
    indicators: {
      btcVolatility30d: Math.round(btcVol * 100) / 100,
      btcEthCorrelation: Math.round(btcEthCorr * 1000) / 1000,
      momentumScore: Math.round(momentumScore * 100) / 100,
      btcReturn7d: Math.round(btcReturn7d * 100) / 100,
    },
  };
}

/**
 * Classify a daily snapshot into a regime
 * Simplified version for historical timeline building
 */
export function classifyDay(
  btcVol: number, // annualized %
  btcReturn7d: number // %
): RegimeType {
  if (btcVol > 80 && btcReturn7d < -10) return "crisis";
  if (btcVol > 60 && btcReturn7d < -5) return "crisis";
  if (btcVol > 50 || (btcReturn7d < -3 && btcReturn7d >= -10)) return "challenging";
  return "core";
}

/**
 * Get regime display properties
 */
export function getRegimeDisplay(regime: RegimeType) {
  const displays = {
    core: {
      label: "CORE",
      description: "Normal trending markets — Full signal deployment",
      color: "text-gold",
      bgColor: "bg-gold/10",
      borderColor: "border-gold/30",
      icon: "○",
    },
    crisis: {
      label: "CRISIS",
      description: "Extreme volatility — Defensive positioning",
      color: "text-pnl-negative",
      bgColor: "bg-pnl-negative/10",
      borderColor: "border-pnl-negative/30",
      icon: "⚠",
    },
    challenging: {
      label: "CHALLENGING",
      description: "Choppy environment — Reduced position sizes",
      color: "text-status-warn",
      bgColor: "bg-status-warn/10",
      borderColor: "border-status-warn/30",
      icon: "✱",
    },
  };
  return displays[regime];
}
