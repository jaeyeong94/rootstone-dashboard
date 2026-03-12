import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "./schema";
import { hashSync } from "bcryptjs";
import { nanoid } from "nanoid";

async function seed() {
  const sql = neon(process.env.POSTGRES_URL!);
  const db = drizzle(sql);

  const password = process.env.ADMIN_PASSWORD || "changeme123!";

  console.log("Seeding database...");

  const adminId = nanoid();
  await db.insert(users)
    .values({
      id: adminId,
      username: "admin",
      passwordHash: hashSync(password, 12),
      role: "admin",
    })
    .onConflictDoNothing();

  console.log(`Admin user created (username: admin, password: ${password === "changeme123!" ? "[default - CHANGE THIS]" : "[from env]"})`);
  console.log("Done!");
  process.exit(0);
}

seed().catch(console.error);
