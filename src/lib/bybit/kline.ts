/**
 * Bybit Kline (Candlestick) API client
 * Used for market data: volatility, correlation, regime detection
 */

const BASE_URL = "https://api.bybit.com";

export interface KlineCandle {
  startTime: string;   // ms timestamp
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  turnover: string;
}

/**
 * Get kline data (public endpoint - no auth required)
 * @param symbol e.g., "BTCUSDT"
 * @param interval e.g., "D" for daily, "60" for 1h
 * @param limit number of candles (max 200)
 */
export async function getKlines(
  symbol: string,
  interval: string = "D",
  limit: number = 90
): Promise<KlineCandle[]> {
  const params = new URLSearchParams({
    category: "linear",
    symbol,
    interval,
    limit: String(limit),
  });

  const res = await fetch(`${BASE_URL}/v5/market/kline?${params}`, {
    next: { revalidate: 300 }, // cache 5 minutes
  });

  if (!res.ok) {
    throw new Error(`Bybit Kline API error: ${res.status}`);
  }

  const data = await res.json();

  if (data.retCode !== 0) {
    throw new Error(`Bybit Kline error: ${data.retCode} - ${data.retMsg}`);
  }

  // Bybit returns [startTime, open, high, low, close, volume, turnover]
  // in reverse chronological order
  const list: string[][] = data.result?.list ?? [];
  return list
    .map((candle: string[]) => ({
      startTime: candle[0],
      openPrice: candle[1],
      highPrice: candle[2],
      lowPrice: candle[3],
      closePrice: candle[4],
      volume: candle[5],
      turnover: candle[6],
    }))
    .reverse(); // chronological order
}

/**
 * Get daily close prices for a symbol
 */
export async function getDailyClosePrices(
  symbol: string,
  days: number = 90
): Promise<{ time: string; close: number }[]> {
  const candles = await getKlines(symbol, "D", days);
  return candles.map((c) => ({
    time: new Date(parseInt(c.startTime)).toISOString().split("T")[0],
    close: parseFloat(c.closePrice),
  }));
}
