import { and, asc, eq, inArray } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { covers, type GameInput, gameInput, type LeaguePage, type MatchPage, nextGame, standings, wins } from "../../shared/league.js";
import { requireAdmin } from "./admin.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { says } from "./i18n.js";
import { fixGame, type Move, recordGame, type Refusal } from "./match.js";
import { leagueGame, leagueMatch, leagueRound, milestone, seriesPlayer, user } from "./schema.js";
import { findShown, type SeriesRow, viewer } from "./series-data.js";

const t = says({
  en: {
    signIn: "Sign in first",
    noSeries: "No such series",
    noMatch: "No such match",
    badGame: "A winner of the two, each side's fainted from 0 to 6 and a replay link or none",
    winner: "The winner must be one of the match's two players",
    closed: "The match is decided; fix one of its games instead",
    noGame: "No such game",
    past: "That would leave a game after the match is won",
    order: "The games must run 1, 2, 3 with none missing",
    score: "That would not fit the score the match keeps from the Trainer League app",
  },
  es: {
    signIn: "Inicia sesión primero",
    noSeries: "Esa serie no existe",
    noMatch: "Ese combate no existe",
    badGame: "Un ganador de los dos, los debilitados de cada lado de 0 a 6 y un enlace a la repetición o ninguno",
    winner: "El ganador tiene que ser uno de los dos jugadores del combate",
    closed: "El combate está decidido; corrige una de sus partidas",
    noGame: "Esa partida no existe",
    past: "Quedaría una partida después de ganado el combate",
    order: "Las partidas tienen que ir 1, 2, 3 sin huecos",
    score: "No encajaría con el resultado que el combate conserva de la app de la Liga",
  },
});

export const league = new Hono();

async function leagueOf(row: SeriesRow): Promise<LeaguePage> {
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
  return {
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
        })),
    })),
    standings: standings(
      players.map((p) => p.id),
      matches.map((m) => ({ a: m.playerA, b: m.playerB, gamesA: m.gamesA, gamesB: m.gamesB, faintedA: m.faintedA, faintedB: m.faintedB })),
      row.id,
    ),
  };
}

league.get("/:number/league", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  return c.json(await leagueOf(row));
});

async function matchOf(row: SeriesRow, matchId: string, admin: boolean): Promise<MatchPage | null> {
  const page = await leagueOf(row);
  const round = page.rounds.find((r) => r.matches.some((m) => m.id === matchId));
  const match = round?.matches.find((m) => m.id === matchId);
  if (!round || !match) return null;
  const games = await db.select().from(leagueGame).where(eq(leagueGame.matchId, matchId)).orderBy(asc(leagueGame.number));
  const played = games.map((g) => ({ number: g.number, winner: g.winnerId, faintedA: g.faintedA, faintedB: g.faintedB, replay: g.replay }));
  const won = wins(match, played);
  const side = (id: string) => {
    const standing = page.standings.find((s) => s.player === id);
    return { id, name: page.players.find((p) => p.id === id)?.name ?? "?", place: standing?.place ?? null, points: standing?.points ?? 0 };
  };
  const whole = covers(match, played);
  return {
    id: match.id,
    number: page.number,
    name: page.name,
    round: { number: round.number, milestone: round.milestone },
    a: side(match.a),
    b: side(match.b),
    gamesA: match.gamesA,
    gamesB: match.gamesB,
    faintedA: match.faintedA,
    faintedB: match.faintedB,
    games: played,
    unrecorded: whole ? { a: 0, b: 0 } : { a: (match.gamesA ?? 0) - won.gamesA, b: (match.gamesB ?? 0) - won.gamesB },
    next: nextGame(match, played),
    admin,
  };
}

league.get("/:number/league/matches/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const page = await matchOf(row, c.req.param("id"), !!reader.admin);
  if (!page) return c.json({ error: t(c).noMatch }, 404);
  return c.json(page);
});

const refusalStatus: Record<Refusal, 400 | 404 | 409> = { noMatch: 404, winner: 400, order: 409, closed: 409, noGame: 404, past: 409, score: 409 };

async function moveOn(c: Context, make: (matchId: string, input: GameInput, by: string) => Promise<Move>) {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", true);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const matchId = c.req.param("id") ?? "";
  if (!(await matchOf(row, matchId, true))) return c.json({ error: t(c).noMatch }, 404);
  const input = await body(c.req.raw, gameInput);
  if (!input) return c.json({ error: t(c).badGame }, 400);
  const moved = await make(matchId, input, reader.id);
  if (!moved.done) return c.json({ error: t(c)[moved.refused] }, refusalStatus[moved.refused]);
  return c.json(await matchOf(row, matchId, true));
}

league.post("/:number/league/matches/:id/games", requireAdmin, (c) => moveOn(c, recordGame));

league.put("/:number/league/matches/:id/games/:game", requireAdmin, async (c) => {
  const number = Number(c.req.param("game"));
  if (!Number.isInteger(number)) return c.json({ error: t(c).noGame }, 404);
  return moveOn(c, (matchId, input, by) => fixGame(matchId, number, input, by));
});
