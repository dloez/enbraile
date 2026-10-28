import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { type LeaguePage, standings } from "../../shared/league.js";
import { db } from "./db.js";
import { says } from "./i18n.js";
import { leagueMatch, leagueRound, milestone, seriesPlayer, user } from "./schema.js";
import { findShown, viewer } from "./series-data.js";

const t = says({
  en: { signIn: "Sign in first", noSeries: "No such series" },
  es: { signIn: "Inicia sesión primero", noSeries: "Esa serie no existe" },
});

export const league = new Hono();

league.get("/:number/league", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const roundMilestones = await db
    .select({ id: milestone.id, name: milestone.name })
    .from(milestone)
    .where(and(eq(milestone.seriesId, row.id), eq(milestone.mark, "round")))
    .orderBy(asc(milestone.position));
  const rounds = await db.select().from(leagueRound).where(eq(leagueRound.seriesId, row.id));
  const matches = rounds.length
    ? await db.select().from(leagueMatch).where(inArray(leagueMatch.roundId, rounds.map((r) => r.id))).orderBy(asc(leagueMatch.position))
    : [];
  const enrolled = await db
    .select({ id: user.id, name: user.name })
    .from(seriesPlayer)
    .innerJoin(user, eq(user.id, seriesPlayer.userId))
    .where(eq(seriesPlayer.seriesId, row.id));
  const paired = new Set([...matches.flatMap((m) => [m.playerA, m.playerB]), ...rounds.flatMap((r) => (r.byeId ? [r.byeId] : []))]);
  const missing = [...paired].filter((id) => !enrolled.some((p) => p.id === id));
  const outside = missing.length ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, missing)) : [];
  const players = rounds.length ? [...enrolled.filter((p) => paired.has(p.id)), ...outside] : enrolled;
  players.sort((x, y) => x.name.localeCompare(y.name));
  const ordered = roundMilestones
    .map((m, index) => ({ number: index + 1, milestone: m, round: rounds.find((r) => r.milestoneId === m.id) }))
    .filter((r) => r.round !== undefined);
  const page: LeaguePage = {
    number: row.number,
    name: row.name,
    roundMilestones: roundMilestones.map((m) => m.name),
    players,
    rounds: ordered.map(({ number, milestone: m, round }) => ({
      number,
      milestone: m.name,
      bye: round!.byeId,
      matches: matches
        .filter((match) => match.roundId === round!.id)
        .map((match) => ({
          id: match.id,
          a: match.playerA,
          b: match.playerB,
          gamesA: match.gamesA,
          gamesB: match.gamesB,
          faintedA: match.faintedA,
          faintedB: match.faintedB,
          replays: match.replays,
        })),
    })),
    standings: standings(
      players.map((p) => p.id),
      matches.map((m) => ({ a: m.playerA, b: m.playerB, gamesA: m.gamesA, gamesB: m.gamesB, faintedA: m.faintedA, faintedB: m.faintedB })),
      row.id,
    ),
  };
  return c.json(page);
});
