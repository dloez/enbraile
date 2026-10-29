import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AbilitiesPage } from "../../shared/abilities.js";
import { fallenAcross, type JourneyPage } from "../../shared/journey.js";
import type { PcPage } from "../../shared/pc.js";
import type { Snapshot } from "../../shared/snapshot.js";
import type { OwedSeries, SeriesBanner, SeriesPage } from "../../shared/series.js";
import { db } from "./db.js";
import { downloadUrl } from "./files.js";
import { game, milestone, save, series, seriesPlayer, snapshot, user } from "./schema.js";
import { findShown, gameOf, mayUpload, milestonesOf, plays, trainersOf, viewer } from "./series-data.js";
import { seesSpreads, withoutSpreads } from "./spreads.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    noSnapshotAt: (name: string) => `No snapshot at ${name}`,
    signIn: "Sign in first",
    noSeries: "No such series",
    gameDownload: "Only this series' players download its game",
    noFile: "No file uploaded",
    notPlayer: "Not a player of this series",
  },
  es: {
    noSnapshotAt: (name: string) => `No hay captura en ${name}`,
    signIn: "Inicia sesión primero",
    noSeries: "Esa serie no existe",
    gameDownload: "Solo los jugadores de esta serie descargan su juego",
    noFile: "No hay ningún archivo subido",
    notPlayer: "No es jugador de esta serie",
  },
});

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

seriesRoutes.get("/owed", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const rows = await db
    .select({ id: series.id, number: series.number, name: series.name })
    .from(seriesPlayer)
    .innerJoin(series, eq(series.id, seriesPlayer.seriesId))
    .where(and(eq(seriesPlayer.userId, reader.id), eq(seriesPlayer.needsSave, true), eq(series.state, "running"), eq(series.ingestion, "manual")))
    .orderBy(asc(series.number));
  const owed: OwedSeries[] = await Promise.all(rows.map(async (row) => ({ number: row.number, name: row.name, milestones: await milestonesOf(row.id) })));
  return c.json(owed);
});

seriesRoutes.get("/:number", async (c) => {
  const user = await viewer(c.req.raw);
  if (!user) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!user.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const chosen = await gameOf(row);
  const page: SeriesPage = {
    number: row.number,
    name: row.name,
    scene: row.scene,
    state: row.state,
    game: chosen?.name ?? null,
    ingestion: row.ingestion,
    rules: row.rules,
    rulesEs: row.rulesEs,
    milestones: await milestonesOf(row.id),
    trainers: (await trainersOf(row.id, user)).map((trainer) => ({ ...trainer, canUpload: mayUpload(user, row, trainer.id) })),
    canDownload: chosen?.fileKey != null && (!!user.admin || (await plays(row.id, user.id))),
  };
  return c.json(page);
});

seriesRoutes.get("/:number/download", async (c) => {
  const user = await viewer(c.req.raw);
  if (!user) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!user.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  if (!user.admin && !(await plays(row.id, user.id))) return c.json({ error: t(c).gameDownload }, 403);
  const chosen = await gameOf(row);
  if (!chosen?.fileKey || !chosen.fileName) return c.json({ error: t(c).noFile }, 404);
  return c.json({ url: await downloadUrl(chosen.fileKey, chosen.fileName) });
});

seriesRoutes.get("/:number/trainers/:player/pc", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const player = await playerOf(row.id, c.req.param("player"));
  if (!player) return c.json({ error: t(c).notPlayer }, 404);
  const playerId = player.id;
  const taken = await db
    .select({ milestone: milestone.name, snapshotId: snapshot.id })
    .from(milestone)
    .leftJoin(save, and(eq(save.seriesId, milestone.seriesId), eq(save.userId, playerId)))
    .leftJoin(snapshot, and(eq(snapshot.saveId, save.id), eq(snapshot.milestoneId, milestone.id)))
    .where(eq(milestone.seriesId, row.id))
    .orderBy(asc(milestone.position));
  const asked = c.req.query("snapshot");
  const chosen = asked === undefined ? taken.findLast((m) => m.snapshotId !== null) : taken.find((m) => m.milestone === asked);
  if (asked !== undefined && !chosen?.snapshotId) return c.json({ error: t(c).noSnapshotAt(asked) }, 404);
  const [held] = chosen?.snapshotId ? await db.select({ data: snapshot.data, missing: snapshot.missing }).from(snapshot).where(eq(snapshot.id, chosen.snapshotId)) : [];
  const shown = seesSpreads(reader, playerId);
  const page: PcPage = {
    player,
    series: { number: row.number, name: row.name, gameId: row.gameId },
    milestones: taken.map((m) => ({ name: m.milestone, taken: m.snapshotId !== null })),
    milestone: held ? (chosen?.milestone ?? null) : null,
    snapshotId: held ? (chosen?.snapshotId ?? null) : null,
    pc: held ? (await import("../../shared/describe.js")).describePc(shown ? held.data : withoutSpreads(held.data), !shown) : null,
    missing: held?.missing ?? null,
  };
  return c.json(page);
});

seriesRoutes.get("/:number/abilities", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const taken = await db
    .select({
      player: { id: user.id, name: user.name },
      milestone: milestone.name,
      pokemon: sql<Snapshot["pokemon"]>`${snapshot.data}->'pokemon'`,
    })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .innerJoin(seriesPlayer, and(eq(seriesPlayer.seriesId, save.seriesId), eq(seriesPlayer.userId, save.userId)))
    .innerJoin(user, eq(user.id, save.userId))
    .where(eq(save.seriesId, row.id))
    .orderBy(asc(user.name), asc(milestone.position));
  const latest = new Map(taken.map((t) => [t.player.id, t]));
  const { describeHolders } = await import("../../shared/describe.js");
  const page: AbilitiesPage = {
    series: { number: row.number, name: row.name, gameId: row.gameId },
    trainers: [...latest.values()].map((t) => ({ player: t.player, milestone: t.milestone, mons: describeHolders(t.pokemon) })),
  };
  return c.json(page);
});

async function playerOf(seriesId: string, playerId: string) {
  if (!(await plays(seriesId, playerId))) return undefined;
  const [player] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, playerId));
  return player;
}

seriesRoutes.get("/:number/trainers/:player/journey", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const player = await playerOf(row.id, c.req.param("player"));
  if (!player) return c.json({ error: t(c).notPlayer }, 404);
  const taken = await db
    .select({
      milestone: milestone.name,
      playTime: sql<Snapshot["playTime"]>`${snapshot.data}->'playTime'`,
      trainer: sql<Snapshot["trainer"]>`${snapshot.data}->'trainer'`,
      pokedex: sql<Snapshot["pokedex"]>`${snapshot.data}->'pokedex'`,
      records: sql<Snapshot["records"]>`${snapshot.data}->'records'`,
      fainted: sql<Snapshot["fainted"]>`${snapshot.data}->'fainted'`,
      faintedSet: snapshot.faintedSet,
    })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, row.id), eq(save.userId, player.id)))
    .orderBy(asc(milestone.position));
  const page: JourneyPage = {
    player,
    series: { number: row.number, name: row.name },
    columns: (await milestonesOf(row.id)).map(({ name }) => {
      const s = taken.find((t) => t.milestone === name);
      return {
        milestone: name,
        record: s
          ? {
              playTime: s.playTime,
              badges: s.trainer.badges.filter(Boolean).length,
              badgeSlots: s.trainer.badges.length,
              money: s.trainer.money,
              seen: s.pokedex.seen,
              owned: s.pokedex.owned,
              trainerBattlesWon: s.records.trainerBattlesWon,
              trainerBattlesLost: s.records.trainerBattlesLost,
              blackouts: s.records.blackouts,
              fainted: s.faintedSet ?? s.fainted.length,
            }
          : null,
      };
    }),
    latest: taken.at(-1)?.milestone ?? null,
    fallen: fallenAcross(taken, (await import("../../shared/species.js")).describeMember),
  };
  return c.json(page);
});
