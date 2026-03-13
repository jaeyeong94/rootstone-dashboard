import { pgTable, text, serial, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";

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
export type Visitor = typeof visitors.$inferSelect;
export type NewVisitor = typeof visitors.$inferInsert;
