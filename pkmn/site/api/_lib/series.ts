import { desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import type { SeriesBanner, SeriesPage } from "../../shared/series.js";
import { db } from "./db.js";
import { downloadUrl } from "./files.js";
import { game, series } from "./schema.js";
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
