import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth, db } from "./auth.js";
import { account } from "./schema.js";

export const app = new Hono().basePath("/api");

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.get("/me", async (c) => {
  c.header("cache-control", "private, no-store");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ user: null }, 401);
  const [discord] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, "discord")));
  return c.json({ user: { id: session.user.id, name: session.user.name, image: session.user.image ?? null, discordId: discord?.accountId ?? null } });
});
