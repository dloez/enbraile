import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { db } from "./db.js";
import { requireEnv } from "./env.js";
import * as schema from "./schema.js";

export const auth = betterAuth({
  basePath: "/api/auth",
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      admin: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  plugins: [username()],
});
