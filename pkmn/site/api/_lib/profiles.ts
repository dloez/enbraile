import { and, asc, countDistinct, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cupReach } from "../../shared/league.js";
import { careerOf, type LatestRecord, type ProfileLeague, type ProfilePage } from "../../shared/profile.js";
import type { Snapshot } from "../../shared/snapshot.js";
import { db } from "./db.js";
import { game, milestone, save, series, seriesPlayer, snapshot, team, teamSource, user } from "./schema.js";
import { says } from "./i18n.js";
import { leagueOf } from "./league.js";
import { teamsSeenBy, type Viewer, viewer } from "./series-data.js";

const t = says({
  en: {
    noPlayer: "No such player",
    signIn: "Sign in first",
  },
  es: {
    noPlayer: "Ese jugador no existe",
    signIn: "Inicia sesión primero",
  },
});

export const profiles = new Hono();

profiles.get("/:player", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const [player] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.id, c.req.param("player")), eq(user.admin, false)));
  if (!player) return c.json({ error: t(c).noPlayer }, 404);
  const played = await db
    .select({ id: series.id, number: series.number, name: series.name, scene: series.scene, state: series.state, game: game.name })
    .from(seriesPlayer)
    .innerJoin(series, eq(series.id, seriesPlayer.seriesId))
    .leftJoin(game, eq(game.id, series.gameId))
    .where(and(eq(seriesPlayer.userId, player.id), ne(series.state, "draft")))
    .orderBy(desc(series.number));
  const ids = played.map((s) => s.id);
  const milestones = ids.length
    ? await db
        .select({ seriesId: milestone.seriesId, name: milestone.name })
        .from(milestone)
        .where(inArray(milestone.seriesId, ids))
        .orderBy(asc(milestone.position))
    : [];
  const taken = ids.length
    ? await db
        .select({
          seriesId: save.seriesId,
          milestone: milestone.name,
          playTime: sql<Snapshot["playTime"]>`${snapshot.data}->'playTime'`,
          trainer: sql<Snapshot["trainer"]>`${snapshot.data}->'trainer'`,
          pokedex: sql<Snapshot["pokedex"]>`${snapshot.data}->'pokedex'`,
          records: sql<Snapshot["records"]>`${snapshot.data}->'records'`,
          fainted: sql<number>`coalesce(${snapshot.faintedSet}, ${snapshot.fainted})`,
        })
        .from(snapshot)
        .innerJoin(save, eq(save.id, snapshot.saveId))
        .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
        .where(and(eq(save.userId, player.id), inArray(save.seriesId, ids)))
        .orderBy(asc(milestone.position))
    : [];
  const progress = ids.length
    ? await db
        .select({ seriesId: save.seriesId, milestone: milestone.name })
        .from(save)
        .innerJoin(milestone, eq(milestone.id, save.progressId))
        .where(and(eq(save.userId, player.id), inArray(save.seriesId, ids)))
    : [];
  const teamCounts = ids.length
    ? await db
        .select({ seriesId: save.seriesId, teams: countDistinct(team.id) })
        .from(team)
        .innerJoin(teamSource, eq(teamSource.teamId, team.id))
        .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
        .innerJoin(save, eq(save.id, snapshot.saveId))
        .where(and(eq(team.ownerId, player.id), inArray(save.seriesId, ids), teamsSeenBy(reader)))
        .groupBy(save.seriesId)
    : [];
  const rows = played.map((s) => {
    const last = taken.findLast((t) => t.seriesId === s.id);
    const reached = progress.find((p) => p.seriesId === s.id)?.milestone ?? last?.milestone ?? null;
    const latest: LatestRecord | null = last
      ? {
          series: s.name,
          playTime: last.playTime,
          badges: last.trainer.badges.filter(Boolean).length,
          badgeSlots: last.trainer.badges.length,
          owned: last.pokedex.owned,
          trainerBattlesWon: last.records.trainerBattlesWon,
          trainerBattlesLost: last.records.trainerBattlesLost,
          blackouts: last.records.blackouts,
          fallen: last.fainted,
        }
      : null;
    return { s, reached, latest, end: milestones.findLast((m) => m.seriesId === s.id)?.name ?? null };
  });
  const page: ProfilePage = {
    player,
    since: played.at(-1)?.name ?? null,
    career: careerOf(rows.map(({ s, latest }) => ({ finished: s.state === "finished", latest }))),
    leagues: await leaguesOf(player.id, ids, reader),
    series: rows.map(({ s, reached, latest, end }) => ({
      number: s.number,
      name: s.name,
      scene: s.scene,
      state: s.state,
      game: s.game,
      reached,
      reachedEnd: reached !== null && reached === end,
      playTime: latest?.playTime ?? null,
      fallen: latest?.fallen ?? null,
      teams: teamCounts.find((t) => t.seriesId === s.id)?.teams ?? 0,
    })),
  };
  return c.json(page);
});

async function leaguesOf(player: string, ids: string[], reader: Viewer): Promise<ProfileLeague[]> {
  if (ids.length === 0) return [];
  const held = await db.select().from(series).where(inArray(series.id, ids)).orderBy(desc(series.number));
  const pages = await Promise.all(held.map((row) => leagueOf(row, reader)));
  return pages.flatMap((page, at) => {
    const row = held[at]!;
    const standing = page.standings.find((one) => one.player === player);
    if (!standing || (page.rounds.length === 0 && page.tries.length === 0 && !page.cup)) return [];
    return [
      {
        number: row.number,
        name: row.name,
        state: row.state,
        round: page.rounds.at(-1)?.number ?? null,
        cupOn: page.cup !== null,
        place: standing.place,
        points: standing.points,
        wins: standing.wins,
        losses: standing.losses,
        best: standing.best,
        cup: page.cup && cupReach(page.cup, player),
      },
    ];
  });
}
