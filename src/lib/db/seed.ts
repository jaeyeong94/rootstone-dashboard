import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users } from "./schema";
import { hashSync } from "bcryptjs";
import { nanoid } from "nanoid";

const sqlite = new Database("./db.sqlite");
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

async function seed() {
  const password = process.env.ADMIN_PASSWORD || "changeme123!";

  console.log("Seeding database...");

  const adminId = nanoid();
  db.insert(users)
    .values({
      id: adminId,
      username: "admin",
      passwordHash: hashSync(password, 12),
      role: "admin",
    })
    .onConflictDoNothing()
    .run();

  console.log(`Admin user created (username: admin, password: ${password === "changeme123!" ? "[default - CHANGE THIS]" : "[from env]"})`);
  console.log("Done!");
  process.exit(0);
}

seed().catch(console.error);
