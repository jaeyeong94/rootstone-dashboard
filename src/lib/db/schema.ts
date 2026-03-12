import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const balanceSnapshots = sqliteTable("balance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalEquity: real("total_equity").notNull(),
  totalWalletBalance: real("total_wallet_balance").notNull(),
  totalUnrealisedPnl: real("total_unrealised_pnl").notNull(),
  snapshotAt: integer("snapshot_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type NewBalanceSnapshot = typeof balanceSnapshots.$inferInsert;
