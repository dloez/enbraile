import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { allowedChange, type Player } from "../../shared/players.js";
import { requireAdmin } from "./admin.js";
import { db } from "./db.js";
import { user } from "./schema.js";

const columns = { id: user.id, name: user.name, allowed: user.allowed, createdAt: user.createdAt };

function view(row: { id: string; name: string; allowed: boolean; createdAt: Date }): Player {
  return { id: row.id, name: row.name, allowed: row.allowed, joinedAt: row.createdAt.toISOString() };
}

export const players = new Hono();

players.use(requireAdmin);

players.get("/", async (c) => {
  const rows = await db.select(columns).from(user).where(eq(user.admin, false)).orderBy(asc(user.allowed), asc(user.createdAt));
  return c.json(rows.map(view));
});

players.post("/:id/allowed", async (c) => {
  const parsed = allowedChange.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Say whether they are allowed" }, 400);
  const [row] = await db
    .update(user)
    .set({ allowed: parsed.data.allowed })
    .where(and(eq(user.id, c.req.param("id")), eq(user.admin, false)))
    .returning(columns);
  if (!row) return c.json({ error: "No such player" }, 404);
  return c.json(view(row));
});
