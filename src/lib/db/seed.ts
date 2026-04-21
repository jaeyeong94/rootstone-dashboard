import { users } from "./schema";
import { hashSync } from "bcryptjs";
import { nanoid } from "nanoid";
import { closeDb, getDb } from "./index";

async function seed() {
  const db = getDb();

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
  await closeDb();
  process.exit(0);
}

seed().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
