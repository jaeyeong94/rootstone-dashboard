import { pgTable, text, serial, doublePrecision, timestamp, date, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const balanceSnapshots = pgTable("balance_snapshots", {
  id: serial("id").primaryKey(),
  totalEquity: doublePrecision("total_equity").notNull(),
  totalWalletBalance: doublePrecision("total_wallet_balance").notNull(),
  totalUnrealisedPnl: doublePrecision("total_unrealised_pnl").notNull(),
  snapshotAt: timestamp("snapshot_at").notNull().defaultNow(),
}, (table) => [
  index("idx_balance_snapshots_snapshot_at").on(table.snapshotAt),
]);

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  agreedAt: timestamp("agreed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_visitors_email").on(table.email),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type NewBalanceSnapshot = typeof balanceSnapshots.$inferInsert;
export const dailyReturns = pgTable("daily_returns", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  navIndex: doublePrecision("nav_index").notNull(),
  dailyReturn: doublePrecision("daily_return").notNull(),
  rawNav: doublePrecision("raw_nav"),
  source: text("source", { enum: ["tearsheet", "snapshot_backfill", "cron", "csv_factsheet", "api_rebuild"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_daily_returns_date").on(table.date),
]);

export const navAlerts = pgTable("nav_alerts", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  type: text("type", { enum: ["api_error", "gap_detected", "gap_recovered", "verification_mismatch"] }).notNull(),
  message: text("message").notNull(),
  resolved: timestamp("resolved"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_nav_alerts_date").on(table.date),
  index("idx_nav_alerts_resolved").on(table.resolved),
]);

export type Visitor = typeof visitors.$inferSelect;
export type NewVisitor = typeof visitors.$inferInsert;
export type DailyReturn = typeof dailyReturns.$inferSelect;
export type NewDailyReturn = typeof dailyReturns.$inferInsert;
export const marginUtilSnapshots = pgTable("margin_util_snapshots", {
  id: serial("id").primaryKey(),
  hour: text("hour").notNull(),  // "YYYY-MM-DD HH:00"
  marginUtil: doublePrecision("margin_util").notNull(),
  positionValue: doublePrecision("position_value").notNull(),
  cashBalance: doublePrecision("cash_balance").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_margin_util_hour").on(table.hour),
]);

export const marginUtilDistribution = pgTable("margin_util_distribution", {
  id: serial("id").primaryKey(),
  dataJson: text("data_json").notNull(),  // JSON string of full distribution result
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const benchmarkPrices = pgTable("benchmark_prices", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),         // SPY, QQQ, GLD, IEF
  date: date("date").notNull(),
  close: doublePrecision("close").notNull(),
}, (table) => [
  uniqueIndex("idx_benchmark_prices_symbol_date").on(table.symbol, table.date),
  index("idx_benchmark_prices_symbol").on(table.symbol),
]);

export type NavAlert = typeof navAlerts.$inferSelect;
export type NewNavAlert = typeof navAlerts.$inferInsert;
export type MarginUtilSnapshot = typeof marginUtilSnapshots.$inferSelect;
export type MarginUtilDistribution = typeof marginUtilDistribution.$inferSelect;
export type BenchmarkPrice = typeof benchmarkPrices.$inferSelect;
