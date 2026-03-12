import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

let _db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const DB_PATH =
      process.env.DATABASE_URL?.replace("file:", "") || "./db.sqlite";
    const sqlite = new Database(path.resolve(DB_PATH));
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// Convenience export - use getDb() directly in API routes
export { getDb as db };
