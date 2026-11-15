import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requireEnv } from "./env.js";
import * as schema from "./schema.js";

export const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

export const db = drizzle(pool, { schema });
