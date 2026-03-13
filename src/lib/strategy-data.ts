/**
 * Shared strategy data constants
 * Extracted from Performance & Strategy pages for reuse across Overview components
 * Source: qstats v0.1.33 · 2021.03.02 ~ 2026.02.16
 */

// ── Yearly Returns ──
export const yearlyReturns = [
  { year: 2021, rebeta: 86.2, btc: -5.0 },
  { year: 2022, rebeta: 26.2, btc: -64.1 },
  { year: 2023, rebeta: 77.9, btc: 155.0 },
  { year: 2024, rebeta: 41.7, btc: 119.2 },
  { year: 2025, rebeta: 46.0, btc: -5.4 },
  { year: 2026, rebeta: 12.5, btc: -20.4 },
];

// ── Benchmark Metrics ──
export const benchmarkMetrics = [
  { metric: "Alpha", rebeta: "0.0249", btc: "0.0000", tooltip: "Annualized excess return vs benchmark" },
  { metric: "Beta", rebeta: "0.0637", btc: "1.0000", tooltip: "Market sensitivity" },
  { metric: "Information Ratio", rebeta: "0.4444", btc: "0.0000", tooltip: "Risk-adjusted active return" },
  { metric: "Treynor Ratio", rebeta: "0.40", btc: "0.01", tooltip: "Return per unit of systematic risk" },
  { metric: "Correlation", rebeta: "0.14", btc: "1.00", tooltip: "Pearson correlation with BTC" },
];

// ── Black Swan Events ──
export interface BlackSwanEvent {
  event: string;
  period: string;
  rebeta: string;
  btc: string;
  alpha: string;
}

export const blackSwansV1: BlackSwanEvent[] = [
  { event: "Luna-Terra Collapse", period: "22.05.04~22.05.12", rebeta: "+9.06%", btc: "-23.05%", alpha: "+32.11%p" },
  { event: "Celsius/3AC Bankruptcy", period: "22.06.06~22.06.18", rebeta: "+8.51%", btc: "-36.61%", alpha: "+45.12%p" },
  { event: "FTX Collapse", period: "22.11.05~22.11.13", rebeta: "-4.88%", btc: "-22.79%", alpha: "+17.91%p" },
  { event: "Macro Triple Pressure", period: "24.07.29~24.08.05", rebeta: "-0.20%", btc: "-19.20%", alpha: "+19.00%p" },
];

export const blackSwansV31: BlackSwanEvent[] = [
  { event: "Bybit Hack", period: "25.02.20~25.02.28", rebeta: "+0.49%", btc: "-12.74%", alpha: "+13.23%p" },
  { event: "Tariff War", period: "25.04.01~25.04.08", rebeta: "+8.37%", btc: "-7.54%", alpha: "+15.91%p" },
  { event: "Large-Scale Liquidation", period: "25.10.10~25.10.10", rebeta: "+0.89%", btc: "-7.26%", alpha: "+8.15%p" },
];

export const crisisStats = [
  { value: "+3.18%", label: "Avg Rebeta Return" },
  { value: "-18.46%", label: "Avg BTC Return" },
  { value: "+21.63%p", label: "Avg Outperformance" },
  { value: "5/7", label: "Positive Return Events" },
];

