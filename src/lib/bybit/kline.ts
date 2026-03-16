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
 * Bybit max 1000 per request. Paginates automatically for larger requests.
 */
export async function getKlines(
  symbol: string,
  interval: string = "D",
  limit: number = 90
): Promise<KlineCandle[]> {
  const allCandles: KlineCandle[] = [];
  let endTs = Date.now();
  let remaining = limit;

  for (let page = 0; page < 5 && remaining > 0; page++) {
    const batchLimit = Math.min(remaining, 1000);
    const params = new URLSearchParams({
      category: "linear",
      symbol,
      interval,
      limit: String(batchLimit),
      end: String(endTs),
    });

    const res = await fetch(`${BASE_URL}/v5/market/kline?${params}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Bybit Kline API error: ${res.status}`);
    }

    const data = await res.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit Kline error: ${data.retCode} - ${data.retMsg}`);
    }

    const list: string[][] = data.result?.list ?? [];
    if (list.length === 0) break;

    const batch = list.map((candle: string[]) => ({
      startTime: candle[0],
      openPrice: candle[1],
      highPrice: candle[2],
      lowPrice: candle[3],
      closePrice: candle[4],
      volume: candle[5],
      turnover: candle[6],
    }));

    allCandles.push(...batch);
    remaining -= list.length;

    if (list.length < batchLimit) break; // No more data

    // Next page: oldest candle's timestamp
    endTs = parseInt(list[list.length - 1][0]);
  }

  // Deduplicate by startTime and sort chronologically
  const seen = new Set<string>();
  return allCandles
    .filter((c) => {
      if (seen.has(c.startTime)) return false;
      seen.add(c.startTime);
      return true;
    })
    .sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
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
