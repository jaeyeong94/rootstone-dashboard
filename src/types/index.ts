// Bybit API types

export interface BybitWalletBalance {
  totalEquity: string;
  totalWalletBalance: string;
  totalAvailableBalance: string;
  totalPerpUPL: string;
  totalMarginBalance: string;
  accountType: string;
  coin: BybitCoinBalance[];
}

export interface BybitCoinBalance {
  coin: string;
  equity: string;
  usdValue: string;
  walletBalance: string;
  availableToWithdraw: string;
  unrealisedPnl: string;
  cumRealisedPnl: string;
}

export interface BybitPosition {
  symbol: string;
  side: "Buy" | "Sell";
  size: string;
  avgPrice: string;
  markPrice: string;
  positionValue: string;
  leverage: string;
  unrealisedPnl: string;
  cumRealisedPnl: string;
  createdTime: string;
  updatedTime: string;
  liqPrice: string;
  takeProfit: string;
  stopLoss: string;
  positionIdx: number;
}

export interface BybitExecution {
  symbol: string;
  side: "Buy" | "Sell";
  orderId: string;
  execId: string;
  execPrice: string;
  execQty: string;
  execFee: string;
  execTime: string;
  execType: string;
  closedSize: string;
  closedPnl: string;
}

export interface BybitClosedPnl {
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  leverage: string;
  createdTime: string;
  updatedTime: string;
  orderId: string;
}

export interface BybitApiResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

export interface BybitOrder {
  orderId: string;
  symbol: string;
  side: string; // "Buy" | "Sell"
  price: string;
  qty: string;
  orderType: string;
  orderStatus: string;
  cumExecQty: string;
  createdTime: string;
}

// Ticker (WebSocket)
export interface TickerData {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  turnover24h: string;
  volume24h: string;
  markPrice: string;
}

// Dashboard types
export interface BalanceChange {
  current: number;
  change24h: number;
  change7d: number;
  change30d: number;
}

export interface EquityCurvePoint {
  time: string; // YYYY-MM-DD
  value: number; // cumulative return %
}

// Strategy metrics
export interface StrategyMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgHoldingHours: number;
  totalReturn: number;
  totalTrades: number;
}

// Monthly returns heatmap
export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
}

// Rolling metrics
export interface RollingMetricPoint {
  time: string;
  value: number;
}

// Benchmark
export interface BenchmarkPoint {
  time: string;
  value: number; // cumulative return %
}

// Normalized position (from /api/bybit/positions response)
export interface Position {
  symbol: string;
  side: "Buy" | "Sell";
  size: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  unrealisedPnl: string;
  cumRealisedPnl: string;
  liqPrice: string;
  createdTime: string;
  updatedTime: string;
}
