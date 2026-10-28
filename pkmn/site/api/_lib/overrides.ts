import { and, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { faintedInput, moveInput, progressInput } from "../../shared/series.js";
import { requireAdmin } from "./admin.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { dropIfUnused, saveFor } from "./ingest.js";
import { milestone, save, snapshot } from "./schema.js";
import { findShown, plays, viewer } from "./series-data.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    occupied: (name: string) => `${name} has a snapshot; delete it first`,
    adminsOnly: "Admins only",
    noSeries: "No such series",
    draftNoSnaps: "A draft has no snapshots",
    notPlayer: "Not a player of this series",
    pickMilestone: "Pick a milestone",
    noMilestone: "No such milestone",
    count: "A count from 0 to 999",
    noSnapAtMilestone: "No snapshot at this milestone",
    alreadyThere: "The snapshot is already there",
  },
  es: {
    occupied: (name: string) => `${name} ya tiene una captura; bórrala antes`,
    adminsOnly: "Solo para administradores",
    noSeries: "Esa serie no existe",
    draftNoSnaps: "Un borrador no tiene capturas",
    notPlayer: "No es jugador de esta serie",
    pickMilestone: "Elige un hito",
    noMilestone: "Ese hito no existe",
    count: "Un número de 0 a 999",
    noSnapAtMilestone: "No hay captura en este hito",
    alreadyThere: "La captura ya está ahí",
  },
});

type Target = { seriesId: string; playerId: string; adminId: string };

async function target(c: Context): Promise<Target | Response> {
  const reader = await viewer(c.req.raw);
  if (!reader?.admin) return c.json({ error: t(c).adminsOnly }, 403);
  const row = await findShown(c.req.param("number") ?? "", true);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  if (row.state === "draft") return c.json({ error: t(c).draftNoSnaps }, 400);
  const playerId = c.req.param("player") ?? "";
  if (!(await plays(row.id, playerId))) return c.json({ error: t(c).notPlayer }, 404);
  return { seriesId: row.id, playerId, adminId: reader.id };
}

async function milestoneNamed(seriesId: string, name: string) {
  const [found] = await db
    .select({ id: milestone.id })
    .from(milestone)
    .where(and(eq(milestone.seriesId, seriesId), eq(milestone.name, name)));
  return found;
}

async function snapshotAt(found: Target, name: string) {
  const [row] = await db
    .select({ id: snapshot.id, saveId: snapshot.saveId, milestoneId: snapshot.milestoneId, fileKey: snapshot.fileKey, rolledKey: snapshot.rolledKey })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, found.seriesId), eq(save.userId, found.playerId), eq(milestone.name, name)));
  return row;
}

function taken(error: unknown): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

export const overrides = new Hono();

overrides.put("/:number/trainers/:player/progress", requireAdmin, async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, progressInput);
  if (!input) return c.json({ error: t(c).pickMilestone }, 400);
  const chosen = await milestoneNamed(found.seriesId, input.milestone);
  if (!chosen) return c.json({ error: t(c).noMilestone }, 400);
  const saveId = await saveFor(found.seriesId, found.playerId);
  await db.update(save).set({ progressId: chosen.id, progressSetBy: found.adminId, progressSetAt: new Date() }).where(eq(save.id, saveId));
  return c.json({});
});

overrides.delete("/:number/trainers/:player/progress", requireAdmin, async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  await db
    .update(save)
    .set({ progressId: null, progressSetBy: null, progressSetAt: null })
    .where(and(eq(save.seriesId, found.seriesId), eq(save.userId, found.playerId)));
  return c.json({});
});

overrides.put("/:number/trainers/:player/snapshots/:milestone/fainted", requireAdmin, async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, faintedInput);
  if (!input) return c.json({ error: t(c).count }, 400);
  const held = await snapshotAt(found, c.req.param("milestone"));
  if (!held) return c.json({ error: t(c).noSnapAtMilestone }, 404);
  await db.update(snapshot).set({ faintedSet: input.count, faintedSetBy: found.adminId, faintedSetAt: new Date() }).where(eq(snapshot.id, held.id));
  return c.json({});
});

overrides.delete("/:number/trainers/:player/snapshots/:milestone/fainted", requireAdmin, async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const held = await snapshotAt(found, c.req.param("milestone"));
  if (!held) return c.json({ error: t(c).noSnapAtMilestone }, 404);
  await db.update(snapshot).set({ faintedSet: null, faintedSetBy: null, faintedSetAt: null }).where(eq(snapshot.id, held.id));
  return c.json({});
});

overrides.post("/:number/trainers/:player/snapshots/:milestone/move", requireAdmin, async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, moveInput);
  if (!input) return c.json({ error: t(c).pickMilestone }, 400);
  const held = await snapshotAt(found, c.req.param("milestone"));
  if (!held) return c.json({ error: t(c).noSnapAtMilestone }, 404);
  const chosen = await milestoneNamed(found.seriesId, input.milestone);
  if (!chosen) return c.json({ error: t(c).noMilestone }, 400);
  if (chosen.id === held.milestoneId) return c.json({ error: t(c).alreadyThere }, 400);
  const occupied = t(c).occupied(input.milestone);
  const [other] = await db
    .select({ id: snapshot.id })
    .from(snapshot)
    .where(and(eq(snapshot.saveId, held.saveId), eq(snapshot.milestoneId, chosen.id)));
  if (other) return c.json({ error: occupied }, 409);
  try {
    await db.update(snapshot).set({ milestoneId: chosen.id, movedBy: found.adminId, movedAt: new Date() }).where(eq(snapshot.id, held.id));
  } catch (error) {
    if (taken(error)) return c.json({ error: occupied }, 409);
    throw error;
  }
  return c.json({});
});

overrides.delete("/:number/trainers/:player/snapshots/:milestone", requireAdmin, async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const held = await snapshotAt(found, c.req.param("milestone"));
  if (!held) return c.json({ error: t(c).noSnapAtMilestone }, 404);
  await db.delete(snapshot).where(eq(snapshot.id, held.id));
  await dropIfUnused(held.fileKey);
  await dropIfUnused(held.rolledKey);
  return c.json({});
});
