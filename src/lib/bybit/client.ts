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
