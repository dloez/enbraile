import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { username } from "better-auth/plugins/username";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { devSignIn } from "./dev-sign-in.js";
import { requireEnv } from "./env.js";
import * as schema from "./schema.js";

const discordId = process.env.DISCORD_CLIENT_ID;
const discordSecret = process.env.DISCORD_CLIENT_SECRET;

export const auth = betterAuth({
  basePath: "/api/auth",
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  socialProviders: discordId && discordSecret ? { discord: { clientId: discordId, clientSecret: discordSecret, overrideUserInfoOnSignIn: true } } : {},
  account: { accountLinking: { enabled: false } },
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
  plugins: [username(), ...(process.env.DEV_SIGN_IN === "1" ? [devSignIn()] : [])],
});
