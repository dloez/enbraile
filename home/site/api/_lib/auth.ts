import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const db = drizzle(new pg.Pool({ connectionString: required("DATABASE_URL"), max: 3 }), { schema });

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: "https://enbraile.vip",
  secret: required("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: ["https://enbraile.vip", "https://pkmn.enbraile.vip", "https://dj.enbraile.vip"],
  socialProviders: { discord: { clientId: required("DISCORD_CLIENT_ID"), clientSecret: required("DISCORD_CLIENT_SECRET"), overrideUserInfoOnSignIn: true } },
  account: { accountLinking: { enabled: false } },
  advanced: { cookiePrefix: "enbraile", crossSubDomainCookies: { enabled: true, domain: "enbraile.vip" } },
  user: {
    additionalFields: {
      admin: { type: "boolean", required: false, defaultValue: false, input: false },
      allowed: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.providerId === "credential") return;
          const [owner] = await db.select({ admin: schema.user.admin }).from(schema.user).where(eq(schema.user.id, account.userId));
          if (owner?.admin) throw new APIError("FORBIDDEN", { message: "Admins sign in with their password" });
        },
      },
    },
  },
});
