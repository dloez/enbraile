import { and, asc, desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import type { PcPage } from "../../shared/pc.js";
import type { SeriesBanner, SeriesPage } from "../../shared/series.js";
import { db } from "./db.js";
import { downloadUrl } from "./files.js";
import { game, milestone, save, series, snapshot, user } from "./schema.js";
import { findShown, gameOf, mayUpload, milestonesOf, plays, trainersOf, viewer } from "./series-data.js";

export const seriesRoutes = new Hono();

seriesRoutes.get("/", async (c) => {
  const rows = await db
    .select({ number: series.number, name: series.name, scene: series.scene, state: series.state, game: game.name })
    .from(series)
    .leftJoin(game, eq(game.id, series.gameId))
    .where(ne(series.state, "draft"))
    .orderBy(desc(series.number));
  return c.json(rows satisfies SeriesBanner[]);
});

seriesRoutes.get("/:number", async (c) => {
  const user = await viewer(c.req.raw);
  if (!user) return c.json({ error: "Sign in first" }, 401);
  const row = await findShown(c.req.param("number"), !!user.admin);
  if (!row) return c.json({ error: "No such series" }, 404);
  const chosen = await gameOf(row);
  const page: SeriesPage = {
    number: row.number,
    name: row.name,
    scene: row.scene,
    state: row.state,
    game: chosen?.name ?? null,
    ingestion: row.ingestion,
    rules: row.rules,
    milestones: await milestonesOf(row.id),
    trainers: (await trainersOf(row.id, user)).map((trainer) => ({ ...trainer, canUpload: mayUpload(user, row, trainer.id) })),
    canDownload: chosen?.fileKey != null && (!!user.admin || (await plays(row.id, user.id))),
  };
  return c.json(page);
});

seriesRoutes.get("/:number/download", async (c) => {
  const user = await viewer(c.req.raw);
  if (!user) return c.json({ error: "Sign in first" }, 401);
  const row = await findShown(c.req.param("number"), !!user.admin);
  if (!row) return c.json({ error: "No such series" }, 404);
  if (!user.admin && !(await plays(row.id, user.id))) return c.json({ error: "Only this series' players download its game" }, 403);
  const chosen = await gameOf(row);
  if (!chosen?.fileKey || !chosen.fileName) return c.json({ error: "No file uploaded" }, 404);
  return c.json({ url: await downloadUrl(chosen.fileKey, chosen.fileName) });
});

seriesRoutes.get("/:number/trainers/:player/pc", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: "No such series" }, 404);
  const playerId = c.req.param("player");
  if (!(await plays(row.id, playerId))) return c.json({ error: "Not a player of this series" }, 404);
  const [player] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, playerId));
  if (!player) return c.json({ error: "Not a player of this series" }, 404);
  const taken = await db
    .select({ milestone: milestone.name, snapshotId: snapshot.id })
    .from(milestone)
    .leftJoin(save, and(eq(save.seriesId, milestone.seriesId), eq(save.userId, playerId)))
    .leftJoin(snapshot, and(eq(snapshot.saveId, save.id), eq(snapshot.milestoneId, milestone.id)))
    .where(eq(milestone.seriesId, row.id))
    .orderBy(asc(milestone.position));
  const asked = c.req.query("snapshot");
  const chosen = asked === undefined ? taken.findLast((m) => m.snapshotId !== null) : taken.find((m) => m.milestone === asked);
  if (asked !== undefined && !chosen?.snapshotId) return c.json({ error: `No snapshot at ${asked}` }, 404);
  const [held] = chosen?.snapshotId ? await db.select({ data: snapshot.data }).from(snapshot).where(eq(snapshot.id, chosen.snapshotId)) : [];
  const page: PcPage = {
    player,
    series: { number: row.number, name: row.name },
    milestones: taken.map((m) => ({ name: m.milestone, taken: m.snapshotId !== null })),
    milestone: held ? (chosen?.milestone ?? null) : null,
    snapshot: held?.data ?? null,
  };
  return c.json(page);
});
