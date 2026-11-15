import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requireEnv } from "./env.js";
import * as schema from "./schema.js";

export const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

export const db = drizzle(pool, { schema });

const parallelQueries = 4;

export async function warmPool(): Promise<void> {
  const free = pool.options.max - (pool.totalCount - pool.idleCount);
  const opened = await Promise.allSettled(Array.from({ length: Math.min(parallelQueries, free) }, () => pool.connect()));
  for (const result of opened) if (result.status === "fulfilled") result.value.release();
}
