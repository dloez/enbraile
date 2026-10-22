import { pool } from "../api/_lib/db.js";
import { requireEnv } from "../api/_lib/env.js";
import { createAdmin, createTestPlayer, usernameTaken } from "./accounts.js";

const admin = { name: "admin", password: "admin-password" };
const testPlayers = ["Red", "Blue", "Leaf"];

async function main() {
  const host = new URL(requireEnv("DATABASE_URL")).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`Refusing to seed ${host}: the seed is for the local stack only`);

  if (!(await usernameTaken(admin.name))) await createAdmin(admin.name, admin.password);
  for (const name of testPlayers) {
    if (!(await usernameTaken(name.toLowerCase()))) await createTestPlayer(name);
  }
  console.log(`Seeded admin ${admin.name} (password ${admin.password}) and test players ${testPlayers.join(", ")}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
