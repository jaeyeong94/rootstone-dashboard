import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function createDatabase() {
  return drizzle(getDatabaseUrl(), { schema });
}

type Database = ReturnType<typeof createDatabase>;

let _db: Database | null = null;

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return databaseUrl;
}

export function getDb(): Database {
  if (!_db) {
    _db = createDatabase();
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_db && "end" in _db.$client && typeof _db.$client.end === "function") {
    await _db.$client.end();
    _db = null;
  }
}

export { getDb as db };
