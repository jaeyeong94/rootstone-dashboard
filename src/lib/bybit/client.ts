import { getAuthHeadersWithQuery } from "./signing";
import type {
  BybitApiResponse,
  BybitWalletBalance,
  BybitPosition,
  BybitExecution,
  BybitClosedPnl,
  BybitOrder,
} from "@/types";

const BASE_URL = "https://api.bybit.com";

async function fetchBybit<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  );
  const queryString = new URLSearchParams(filtered).toString();
  const url = queryString
    ? `${BASE_URL}${endpoint}?${queryString}`
    : `${BASE_URL}${endpoint}`;

  const headers = getAuthHeadersWithQuery(queryString);
  const res = await fetch(url, { headers, next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`Bybit API error: ${res.status} ${res.statusText}`);
  }

  const data: BybitApiResponse<T> = await res.json();

  if (data.retCode !== 0) {
    throw new Error(`Bybit API error: ${data.retCode} - ${data.retMsg}`);
  }

  return data.result;
}

/**
 * Get wallet balance for Unified Account
 */
export async function getWalletBalance(): Promise<{
  list: BybitWalletBalance[];
}> {
  return fetchBybit("/v5/account/wallet-balance", {
    accountType: "UNIFIED",
  });
}

/**
 * Get open positions
 */
export async function getPositions(
  symbol?: string
): Promise<{ list: BybitPosition[] }> {
  const params: Record<string, string> = {
    category: "linear",
    settleCoin: "USDT",
  };
  if (symbol) params.symbol = symbol;
  return fetchBybit("/v5/position/list", params);
}

/**
 * Get recent executions (trade history)
 */
export async function getExecutions(
  params: {
    symbol?: string;
    limit?: string;
    cursor?: string;
  } = {}
): Promise<{ list: BybitExecution[]; nextPageCursor: string }> {
  return fetchBybit("/v5/execution/list", {
    category: "linear",
    ...params,
    limit: params.limit || "50",
  });
}

/**
 * Get closed PnL records
 */
export async function getClosedPnl(
  params: {
    symbol?: string;
    limit?: string;
    startTime?: string;
    endTime?: string;
    cursor?: string;
  } = {}
): Promise<{ list: BybitClosedPnl[]; nextPageCursor: string }> {
  return fetchBybit("/v5/position/closed-pnl", {
    category: "linear",
    ...params,
    limit: params.limit || "50",
  });
}

/**
 * Get open orders (realtime)
 */
export async function getOpenOrders(
  symbol?: string
): Promise<{ list: BybitOrder[] }> {
  const params: Record<string, string> = {
    category: "linear",
  };
  if (symbol) {
    params.symbol = symbol;
  } else {
    params.settleCoin = "USDT"; // symbol 미지정 시 settleCoin 필수
    params.limit = "50"; // 기본 20 → 최대 50으로 확장
  }
  return fetchBybit("/v5/order/realtime", params);
}

/**
 * Get kline (candlestick) data from public API.
 * No authentication required.
 * Returns candles as [startTime, open, high, low, close, volume, turnover].
 */
export async function getKline(
  symbol: string,
  interval: string = "D",
  limit: number = 1
): Promise<{ list: string[][] }> {
  const qs = new URLSearchParams({
    category: "linear",
    symbol,
    interval,
    limit: String(limit),
  }).toString();
  const url = `${BASE_URL}/v5/market/kline?${qs}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Bybit kline API error: ${res.status}`);
  }
  const data = await res.json();
  if (data.retCode !== 0) {
    throw new Error(`Bybit kline API error: ${data.retCode} - ${data.retMsg}`);
  }
  return data.result;
}

/**
 * Calculate NAV using Factsheet methodology:
 * NAV(open) = Cash + Unrealized PnL (using kline daily open price)
 *
 * kline open 이외의 가격 소스는 사용하지 않음 (제3자 재현 가능성 보장).
 * API 실패 시 fallback 없이 에러를 throw하여 해당 날짜 NAV 미기록.
 */
export async function calcFactsheetNAV(): Promise<{
  nav: number;
  cash: number;
  unrealisedPnl: number;
  positions: Array<{
    symbol: string;
    side: string;
    size: number;
    avgEntry: number;
    openPrice: number;
    upl: number;
  }>;
  warnings: string[];
}> {
  const [balResult, posResult] = await Promise.all([
    getWalletBalance(),
    getPositions(),
  ]);

  const cash = parseFloat(balResult.list[0].totalWalletBalance);
  const activePositions = posResult.list.filter((p) => parseFloat(p.size) > 0);
  const warnings: string[] = [];

  // Fetch kline open prices — no fallback, API failure = error
  const positionDetails = await Promise.all(
    activePositions.map(async (p) => {
      const kline = await getKline(p.symbol, "D", 1);
      const candle = kline.list?.[0];
      if (!candle) {
        throw new Error(
          `Kline API returned no data for ${p.symbol}. ` +
          `NAV calculation aborted — resolve API issue before retrying.`
        );
      }
      const openPrice = parseFloat(candle[1]);
      if (isNaN(openPrice) || openPrice <= 0) {
        throw new Error(
          `Invalid kline open price for ${p.symbol}: ${candle[1]}. ` +
          `NAV calculation aborted.`
        );
      }

      const size = parseFloat(p.size);
      const avgEntry = parseFloat(p.avgPrice);
      const side = p.side === "Buy" ? 1 : -1;
      const upl = side * size * (openPrice - avgEntry);

      return {
        symbol: p.symbol,
        side: p.side,
        size,
        avgEntry,
        openPrice,
        upl,
      };
    })
  );

  const unrealisedPnl = positionDetails.reduce((sum, p) => sum + p.upl, 0);

  return {
    nav: cash + unrealisedPnl,
    cash,
    unrealisedPnl,
    positions: positionDetails,
    warnings,
  };
}

/**
 * Get transaction log for equity curve calculation
 */
export async function getTransactionLog(
  params: {
    type?: string;
    startTime?: string;
    endTime?: string;
    limit?: string;
  } = {}
): Promise<{
  list: Array<{
    transactionTime: string;
    type: string;
    amount: string;
    cashBalance: string;
  }>;
  nextPageCursor: string;
}> {
  return fetchBybit("/v5/account/transaction-log", {
    accountType: "UNIFIED",
    ...params,
    limit: params.limit || "50",
  });
}
