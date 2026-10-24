import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { milestonesInput, newSeries, playersInput, rulesInput, seriesInput } from "../../shared/series.js";
import { requireAdmin } from "./admin.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { game, milestone, save, series, seriesPlayer, snapshot, user } from "./schema.js";
import { adminView, type SeriesRow } from "./series-data.js";

async function findSeries(id: string): Promise<SeriesRow | undefined> {
  const [row] = await db.select().from(series).where(eq(series.id, id));
  return row;
}

function uniqueViolation(error: unknown, constraint: string): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505" && "constraint" in cause && cause.constraint === constraint;
}

async function allAllowed(playerIds: string[]): Promise<boolean> {
  if (playerIds.length === 0) return true;
  const found = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, playerIds), eq(user.admin, false), eq(user.allowed, true)));
  return found.length === playerIds.length;
}

export const adminSeries = new Hono();

adminSeries.use(requireAdmin);

adminSeries.get("/", async (c) => {
  const rows = await db.select().from(series).orderBy(desc(series.number));
  return c.json(await Promise.all(rows.map(adminView)));
});

adminSeries.post("/", async (c) => {
  const input = await body(c.req.raw, newSeries);
  if (!input) return c.json({ error: "A series needs a number and a name" }, 400);
  const [row] = await db
    .insert(series)
    .values({ id: crypto.randomUUID(), number: input.number, name: input.name })
    .onConflictDoNothing({ target: series.number })
    .returning();
  if (!row) return c.json({ error: `Series ${input.number} exists` }, 409);
  return c.json(await adminView(row), 201);
});

adminSeries.get("/:id", async (c) => {
  const row = await findSeries(c.req.param("id"));
  if (!row) return c.json({ error: "No such series" }, 404);
  return c.json(await adminView(row));
});

adminSeries.put("/:id", async (c) => {
  const row = await findSeries(c.req.param("id"));
  if (!row) return c.json({ error: "No such series" }, 404);
  if (row.state !== "draft") return c.json({ error: "Only a draft is edited in full" }, 409);
  const input = await body(c.req.raw, seriesInput);
  if (!input) return c.json({ error: "Fill in every field" }, 400);
  const names = input.milestones.map((m) => m.name.toLowerCase());
  if (new Set(names).size !== names.length) return c.json({ error: "Two milestones share a name" }, 400);
  if (input.gameId) {
    const [found] = await db.select({ id: game.id }).from(game).where(eq(game.id, input.gameId));
    if (!found) return c.json({ error: "No such game" }, 400);
  }
  const playerIds = [...new Set(input.playerIds)];
  if (!(await allAllowed(playerIds))) return c.json({ error: "Every player must be on the allowlist" }, 400);
  try {
    const updated = await db.transaction(async (tx) => {
      const [saved] = await tx
        .update(series)
        .set({
          number: input.number,
          name: input.name,
          gameId: input.gameId,
          scene: input.scene,
          ingestion: input.ingestion,
          rules: input.rules,
        })
        .where(and(eq(series.id, row.id), eq(series.state, "draft")))
        .returning();
      if (!saved) return undefined;
      await tx.delete(seriesPlayer).where(eq(seriesPlayer.seriesId, row.id));
      if (playerIds.length > 0) await tx.insert(seriesPlayer).values(playerIds.map((userId) => ({ seriesId: row.id, userId })));
      await tx.delete(milestone).where(eq(milestone.seriesId, row.id));
      if (input.milestones.length > 0) {
        await tx.insert(milestone).values(
          input.milestones.map((m, position) => ({ id: crypto.randomUUID(), seriesId: row.id, position, name: m.name, mark: m.mark })),
        );
      }
      return saved;
    });
    if (!updated) return c.json({ error: "Only a draft is edited in full" }, 409);
    return c.json(await adminView(updated));
  } catch (error) {
    if (uniqueViolation(error, "series_number_unique")) return c.json({ error: `Series ${input.number} exists` }, 409);
    throw error;
  }
});

adminSeries.put("/:id/rules", async (c) => {
  const input = await body(c.req.raw, rulesInput);
  if (!input) return c.json({ error: "Rules are Markdown text" }, 400);
  const [updated] = await db.update(series).set({ rules: input.rules }).where(eq(series.id, c.req.param("id"))).returning();
  if (!updated) return c.json({ error: "No such series" }, 404);
  return c.json(await adminView(updated));
});

adminSeries.put("/:id/players", async (c) => {
  const row = await findSeries(c.req.param("id"));
  if (!row) return c.json({ error: "No such series" }, 404);
  if (row.state !== "running") return c.json({ error: "Only a running series changes its players here" }, 409);
  const input = await body(c.req.raw, playersInput);
  if (!input) return c.json({ error: "Players are a list of ids" }, 400);
  const playerIds = [...new Set(input.playerIds)];
  const current = await db.select({ userId: seriesPlayer.userId }).from(seriesPlayer).where(eq(seriesPlayer.seriesId, row.id));
  const dropped = current.map((p) => p.userId).filter((userId) => !playerIds.includes(userId));
  const added = playerIds.filter((userId) => !current.some((p) => p.userId === userId));
  if (!(await allAllowed(added))) return c.json({ error: "Every player must be on the allowlist" }, 400);
  if (dropped.length > 0) {
    const [played] = await db
      .select({ userId: save.userId })
      .from(save)
      .where(and(eq(save.seriesId, row.id), inArray(save.userId, dropped)))
      .limit(1);
    if (played) return c.json({ error: "A player with a snapshot in this series stays in it" }, 409);
    await db.delete(seriesPlayer).where(and(eq(seriesPlayer.seriesId, row.id), inArray(seriesPlayer.userId, dropped)));
  }
  if (added.length > 0) await db.insert(seriesPlayer).values(added.map((userId) => ({ seriesId: row.id, userId }))).onConflictDoNothing();
  return c.json(await adminView(row));
});

adminSeries.put("/:id/milestones", async (c) => {
  const row = await findSeries(c.req.param("id"));
  if (!row) return c.json({ error: "No such series" }, 404);
  if (row.state !== "running") return c.json({ error: "Only a running series changes its milestones here" }, 409);
  const input = await body(c.req.raw, milestonesInput);
  if (!input) return c.json({ error: "A series keeps at least one named milestone" }, 400);
  const names = input.milestones.map((m) => m.name.toLowerCase());
  if (new Set(names).size !== names.length) return c.json({ error: "Two milestones share a name" }, 400);
  const current = await db.select({ id: milestone.id, name: milestone.name }).from(milestone).where(eq(milestone.seriesId, row.id));
  const kept = input.milestones.flatMap((m) => (m.id ? [m.id] : []));
  if (new Set(kept).size !== kept.length || kept.some((id) => !current.some((m) => m.id === id))) {
    return c.json({ error: "A milestone is not this series'" }, 400);
  }
  const dropped = current.filter((m) => !kept.includes(m.id));
  if (dropped.length > 0) {
    const held = await db
      .selectDistinct({ milestoneId: snapshot.milestoneId })
      .from(snapshot)
      .where(inArray(snapshot.milestoneId, dropped.map((m) => m.id)));
    const blocked = dropped.filter((m) => held.some((h) => h.milestoneId === m.id)).map((m) => m.name);
    if (blocked.length > 0) return c.json({ error: `Move or delete the snapshots at ${blocked.join(", ")} first` }, 409);
  }
  await db.transaction(async (tx) => {
    if (dropped.length > 0) await tx.delete(milestone).where(inArray(milestone.id, dropped.map((m) => m.id)));
    for (const [index, id] of kept.entries()) {
      await tx.update(milestone).set({ position: -1 - index, name: id }).where(eq(milestone.id, id));
    }
    for (const [position, m] of input.milestones.entries()) {
      if (m.id) await tx.update(milestone).set({ position, name: m.name, mark: m.mark }).where(eq(milestone.id, m.id));
      else await tx.insert(milestone).values({ id: crypto.randomUUID(), seriesId: row.id, position, name: m.name, mark: m.mark });
    }
  });
  return c.json(await adminView(row));
});

adminSeries.post("/:id/start", async (c) => {
  const row = await findSeries(c.req.param("id"));
  if (!row) return c.json({ error: "No such series" }, 404);
  if (row.state !== "draft") return c.json({ error: "Only a draft starts" }, 409);
  const view = await adminView(row);
  const missing = view.checklist.filter((item) => !item.done);
  if (missing.length > 0) return c.json({ error: `Missing: ${missing.map((item) => item.label.toLowerCase()).join(", ")}` }, 409);
  try {
    const [started] = await db
      .update(series)
      .set({ state: "running", startedAt: new Date() })
      .where(and(eq(series.id, row.id), eq(series.state, "draft")))
      .returning();
    if (!started) return c.json({ error: "Only a draft starts" }, 409);
    return c.json(await adminView(started));
  } catch (error) {
    if (uniqueViolation(error, "series_one_running_idx")) return c.json({ error: "Another series is running" }, 409);
    throw error;
  }
});

adminSeries.post("/:id/finish", async (c) => {
  const [finished] = await db
    .update(series)
    .set({ state: "finished", finishedAt: new Date() })
    .where(and(eq(series.id, c.req.param("id")), eq(series.state, "running")))
    .returning();
  if (!finished) return c.json({ error: "Only a running series finishes" }, 409);
  return c.json(await adminView(finished));
});

adminSeries.delete("/:id", async (c) => {
  const [deleted] = await db
    .delete(series)
    .where(and(eq(series.id, c.req.param("id")), eq(series.state, "draft")))
    .returning({ id: series.id });
  if (!deleted) return c.json({ error: "Only a draft is deleted" }, 409);
  return c.json({});
});
