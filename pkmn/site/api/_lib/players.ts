import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { allowedChange, invite, type Player } from "../../shared/players.js";
import { requireAdmin } from "./admin.js";
import { db } from "./db.js";
import { account, seriesPlayer, user } from "./schema.js";

const columns = { id: user.id, name: user.name, allowed: user.allowed, createdAt: user.createdAt, accessToken: account.accessToken, accountId: account.id };

type Row = { id: string; name: string; allowed: boolean; createdAt: Date; accessToken: string | null; accountId: string | null };

function view(row: Row): Player {
  return { id: row.id, name: row.name, allowed: row.allowed, invited: row.accountId !== null && row.accessToken === null, joinedAt: row.createdAt.toISOString() };
}

function withDiscord() {
  return db
    .select(columns)
    .from(user)
    .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "discord")));
}

async function one(id: string): Promise<Row | undefined> {
  const [row] = await withDiscord().where(and(eq(user.id, id), eq(user.admin, false)));
  return row;
}

export const players = new Hono();

players.use(requireAdmin);

players.get("/", async (c) => {
  const rows = await withDiscord().where(eq(user.admin, false)).orderBy(asc(user.allowed), asc(user.createdAt));
  return c.json(rows.map(view));
});

players.post("/", async (c) => {
  const parsed = invite.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Give a Discord user ID (17 to 20 digits) and a name" }, 400);
  const { discordId, name } = parsed.data;
  const [taken] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.providerId, "discord"), eq(account.accountId, discordId)));
  if (taken) return c.json({ error: "That Discord user is already a player" }, 409);
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id, name, email: `${discordId}@discord.invalid`, allowed: true });
    await tx.insert(account).values({ id: crypto.randomUUID(), userId: id, providerId: "discord", accountId: discordId });
  });
  const row = await one(id);
  return c.json(view(row!), 201);
});

players.post("/:id/allowed", async (c) => {
  const parsed = allowedChange.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Say whether they are allowed" }, 400);
  const [updated] = await db
    .update(user)
    .set({ allowed: parsed.data.allowed })
    .where(and(eq(user.id, c.req.param("id")), eq(user.admin, false)))
    .returning({ id: user.id });
  if (!updated) return c.json({ error: "No such player" }, 404);
  return c.json(view((await one(updated.id))!));
});

players.delete("/:id", async (c) => {
  const row = await one(c.req.param("id"));
  if (!row) return c.json({ error: "No such player" }, 404);
  if (!view(row).invited) return c.json({ error: "Only an invite nobody has used can be deleted" }, 409);
  const [inSeries] = await db.select({ id: seriesPlayer.seriesId }).from(seriesPlayer).where(eq(seriesPlayer.userId, row.id)).limit(1);
  if (inSeries) return c.json({ error: "Take them out of their series first" }, 409);
  await db.delete(user).where(and(eq(user.id, row.id), eq(user.admin, false)));
  return c.json({ id: row.id });
});
