import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type Context, Hono } from "hono";
import {
  bestTries,
  covers,
  cupInput,
  cupShape,
  cupSlots,
  type LeagueCup,
  type MatchCup,
  fellProblem,
  type GameInput,
  gameInput,
  type HatchedEggs,
  type LeaguePage,
  type LeagueTry,
  type MatchMember,
  type MatchPage,
  type MatchTeam,
  nextGame,
  openInput,
  pairsInput,
  PARTY_SIZE,
  standings,
  tryEdit,
  tryInput,
  wins,
} from "../../shared/league.js";
import type { Snapshot } from "../../shared/snapshot.js";
import { describeMember, itemName, speciesTypes } from "../../shared/species.js";
import { backedBy, isFree, nextTeamName, type TeamMember, type TeamSlots } from "../../shared/team.js";
import { requireAdmin } from "./admin.js";
import { body } from "./body.js";
import { type CupRefusal, cupState, startCup } from "./cup.js";
import { db } from "./db.js";
import { says } from "./i18n.js";
import { fixGame, type Move, recordGame, type Refusal } from "./match.js";
import { openRound, redrawRound, type RoundMove, type RoundRefusal, setPairs } from "./rounds.js";
import { cup, leagueGame, leagueMatch, leagueRound, leagueTry, milestone, save, seriesPlayer, snapshot, team, teamSource, user } from "./schema.js";
import { findShown, type SeriesRow, teamsSeenBy, type Viewer, viewer } from "./series-data.js";
import { insertTeam } from "./teams.js";

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
    badTry: "Combats won from 0 to 5, and where each Pokémon fell",
    notPlayer: "Only the league's players log their Pokémon League tries",
    noTeam: "No such team of yours",
    partySize: "A Pokémon League team brings one to six Pokémon",
    notFree: "A pasted team holds only Any Pokémon members",
    fell: "A Pokémon can only fall in a combat the try reached",
    noTry: "No such try",
    notYours: "Only the try's player or an admin changes it",
    tryTeam: "Pokémon League try",
    badMode: "Open or closed",
    badPairs: "Pairs of two players and the one who rests, or none",
    noRound: "No such round",
    allOpen: "Every round is already open",
    noDraw: "No draw is left where nobody meets someone they have met",
    notNewest: "Only the newest round's pairs can change",
    started: "A match of the round has a game; its pairs stay",
    player: "Every player must be one of the league's",
    same: "A player cannot meet themselves",
    twice: "Each player goes in once",
    missing: "Every player of the league needs a pair or the rest",
    bye: "One player rests when the league has an odd number, and none otherwise",
    met: "Two of them have already met",
    later: "A later cup match already has a game; fix that one first",
    cupStarted: "The cup has already started",
    cupSize: "The cup needs an even number of players, two or more",
    badCup: "The players who enter the cup",
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
    badTry: "Combates ganados de 0 a 5, y dónde cayó cada Pokémon",
    notPlayer: "Solo los jugadores de la liga anotan sus intentos de la Liga Pokémon",
    noTeam: "No tienes ese equipo",
    partySize: "Un equipo de la Liga Pokémon lleva de uno a seis Pokémon",
    notFree: "Un equipo pegado solo lleva miembros de Cualquier Pokémon",
    fell: "Un Pokémon solo puede caer en un combate al que llegó el intento",
    noTry: "Ese intento no existe",
    notYours: "Solo el jugador del intento o un administrador puede cambiarlo",
    tryTeam: "Intento de la Liga Pokémon",
    badMode: "Abierta o cerrada",
    badPairs: "Parejas de dos jugadores y el que descansa, o ninguno",
    noRound: "Esa ronda no existe",
    allOpen: "Todas las rondas están ya abiertas",
    noDraw: "No queda sorteo en el que nadie repita rival",
    notNewest: "Solo cambian las parejas de la ronda más reciente",
    started: "Un combate de la ronda tiene una partida; sus parejas se quedan",
    player: "Cada jugador tiene que ser de la liga",
    same: "Un jugador no puede enfrentarse a sí mismo",
    twice: "Cada jugador va una sola vez",
    missing: "Cada jugador de la liga necesita pareja o descanso",
    bye: "Descansa un jugador cuando la liga es impar, y ninguno si no",
    met: "Dos de ellos ya se han enfrentado",
    later: "Un combate posterior de la copa ya tiene una partida; corrige ese antes",
    cupStarted: "La copa ya ha empezado",
    cupSize: "La copa necesita un número par de jugadores, dos o más",
    badCup: "Los jugadores que entran en la copa",
  },
});

export const league = new Hono();

const setter = alias(user, "setter");

const hatchedIn = (list: "pokemon" | "fainted") =>
  sql`(select count(*) from jsonb_array_elements(${snapshot.data}->${sql.raw(`'${list}'`)}) as mon where jsonb_typeof(mon->'details'->'obtained'->'hatchedAt') = 'number')`;

async function hatchedOf(seriesId: string, players: string[]): Promise<HatchedEggs[]> {
  if (players.length === 0) return [];
  const saved = await db
    .selectDistinctOn([save.userId], {
      player: save.userId,
      count: sql<number>`${hatchedIn("pokemon")} + ${hatchedIn("fainted")}`.mapWith(Number),
      at: snapshot.takenAt,
    })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, seriesId), inArray(save.userId, players)))
    .orderBy(save.userId, desc(milestone.position));
  const set = await db
    .select({ player: save.userId, count: save.hatchedSet, by: setter.name, at: save.hatchedSetAt, imported: save.hatchedImported })
    .from(save)
    .leftJoin(setter, eq(setter.id, save.hatchedSetBy))
    .where(and(eq(save.seriesId, seriesId), inArray(save.userId, players)));
  return players.map((player) => {
    const latest = saved.find((row) => row.player === player);
    const fromSave = latest?.count ?? null;
    const hand = set.find((row) => row.player === player && row.count !== null && row.at !== null && !(row.imported && latest && latest.at > row.at));
    return {
      player,
      count: hand?.count ?? fromSave ?? 0,
      saved: fromSave,
      set: hand ? { by: hand.imported ? null : hand.by, at: hand.at!.toISOString() } : null,
    };
  });
}

async function cupOf(seriesId: string): Promise<LeagueCup | null> {
  const [held] = await db.select().from(cup).where(eq(cup.seriesId, seriesId));
  if (!held) return null;
  const { seeds, rows, draw } = await cupState(db, held.id);
  return {
    seeds,
    slots: draw.slots.map((slot) => {
      const row = rows.find((r) => r.slot === slot.key && r.playerA === slot.a && r.playerB === slot.b);
      return {
        key: slot.key,
        kind: slot.kind,
        left: slot.left,
        match: row?.id ?? null,
        a: slot.a,
        b: slot.b,
        gamesA: row?.gamesA ?? null,
        gamesB: row?.gamesB ?? null,
        faintedA: row?.faintedA ?? null,
        faintedB: row?.faintedB ?? null,
      };
    }),
    group: draw.group,
    champion: draw.champion,
    at: held.startedAt.toISOString(),
  };
}

async function leagueOf(row: SeriesRow, reader: Viewer): Promise<LeaguePage> {
  const roundMilestones = await db
    .select({ id: milestone.id, name: milestone.name })
    .from(milestone)
    .where(and(eq(milestone.seriesId, row.id), eq(milestone.mark, "round")))
    .orderBy(asc(milestone.position));
  const rounds = await db.select().from(leagueRound).where(eq(leagueRound.seriesId, row.id));
  const matches = rounds.length
    ? await db.select().from(leagueMatch).where(inArray(leagueMatch.roundId, rounds.map((r) => r.id))).orderBy(asc(leagueMatch.position))
    : [];
  const withGames = matches.length
    ? new Set(
        (await db.selectDistinct({ matchId: leagueGame.matchId }).from(leagueGame).where(inArray(leagueGame.matchId, matches.map((m) => m.id)))).map((g) => g.matchId),
      )
    : new Set<string>();
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
  const known = new Set(players.map((p) => p.id));
  const logged = await db.select().from(leagueTry).where(eq(leagueTry.seriesId, row.id)).orderBy(asc(leagueTry.loggedAt), asc(leagueTry.id));
  const linked = logged.flatMap((one) => (one.teamId ? [one.teamId] : []));
  const seen = new Set(linked.length ? (await db.select({ id: team.id }).from(team).where(and(inArray(team.id, linked), teamsSeenBy(reader)))).map((r) => r.id) : []);
  const counted = new Map<string, number>();
  const tries = logged
    .filter((one) => known.has(one.playerId))
    .map((one) => {
      const number = (counted.get(one.playerId) ?? 0) + 1;
      counted.set(one.playerId, number);
      const members = one.members.map((member) => ({ ...member, ...describeMember(member.species, member.species) }));
      return { id: one.id, player: one.playerId, number, combatsWon: one.combatsWon, members, team: one.teamId !== null && seen.has(one.teamId) ? one.teamId : null, at: one.loggedAt.toISOString() };
    });
  const best = bestTries(tries);
  const listed: LeagueTry[] = tries.map((one) => ({ ...one, best: best.get(one.player)?.id === one.id }));
  const placed = roundMilestones.map((m, index) => ({ number: index + 1, milestone: m, round: rounds.find((r) => r.milestoneId === m.id) }));
  const ordered = placed.filter((r) => r.round !== undefined);
  const next = placed.find((r) => r.round === undefined);
  return {
    number: row.number,
    name: row.name,
    roundMilestones: roundMilestones.map((m) => m.name),
    players,
    rounds: ordered.map(({ number, milestone: m, round }) => ({
      number,
      milestone: m.name,
      mode: round!.mode,
      bye: round!.byeId,
      started: matches.some((match) => match.roundId === round!.id && (match.gamesA !== null || withGames.has(match.id))),
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
    next: next ? { number: next.number, milestone: next.milestone.name } : null,
    standings: standings(
      players.map((p) => p.id),
      matches.map((m) => ({ a: m.playerA, b: m.playerB, gamesA: m.gamesA, gamesB: m.gamesB, faintedA: m.faintedA, faintedB: m.faintedB })),
      new Map([...best].map(([player, one]) => [player, one.combatsWon])),
      row.id,
    ),
    tries: listed,
    hatched: await hatchedOf(row.id, players.map((p) => p.id)),
    cup: await cupOf(row.id),
    admin: !!reader.admin,
  };
}

league.get("/:number/league", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  return c.json(await leagueOf(row, reader));
});

function cupPlace(page: LeaguePage, matchId: string): MatchCup | null {
  const held = page.cup;
  const at = held?.slots.find((slot) => slot.match === matchId);
  if (!held || !at) return null;
  const next = cupSlots(held.seeds.length).find((slot) => [slot.a, slot.b].some((feed) => "winner" in feed && feed.winner === at.key));
  const drawn = next && held.slots.find((slot) => slot.key === next.key);
  const winner = at.gamesA !== null && at.gamesB !== null ? (at.gamesA > at.gamesB ? at.a : at.b) : null;
  const other = drawn && winner ? (drawn.a === winner ? drawn.b : drawn.b === winner ? drawn.a : null) : null;
  const opponent = other ? (page.players.find((p) => p.id === other)?.name ?? null) : null;
  return { kind: at.kind, left: at.left, group: cupShape(held.seeds.length).half, onward: next ? { left: next.left ?? 0, opponent } : null };
}

function matchMember(member: TeamMember | null, sheets: ReadonlyMap<string, Snapshot>): MatchMember | null {
  if (!member) return null;
  let nickname: string | null = null;
  if (!isFree(member)) {
    const mon = sheets.get(member.source)?.pokemon[member.index];
    if (!mon || mon.species !== member.species) return null;
    nickname = mon.nickname;
  }
  const look = describeMember(member.species, member.species);
  const item = member.item ? itemName(member.item) : null;
  return {
    nickname: nickname && nickname.toLowerCase() !== look.name.toLowerCase() ? nickname : null,
    species: look.name,
    item: member.item && item ? { id: member.item, name: item } : null,
    types: speciesTypes(member.species),
    sprite: look.sprite,
  };
}

async function matchTeams(row: SeriesRow, matchId: string, players: { a: string; b: string }, inCup: boolean, reader: Viewer): Promise<{ a: MatchTeam; b: MatchTeam }> {
  const seen = teamsSeenBy(reader);
  const held = await db
    .select({ id: team.id, name: team.name, ownerId: team.ownerId, slots: team.slots, lockedAt: team.lockedAt, seen: seen ? sql<boolean>`(${seen})` : sql<boolean>`true` })
    .from(team)
    .where(eq(team.matchId, matchId));
  const shownIds = held.filter((one) => one.seen).map((one) => one.id);
  const sheetRows = shownIds.length
    ? await db
        .select({ id: snapshot.id, data: snapshot.data })
        .from(teamSource)
        .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
        .where(inArray(teamSource.teamId, shownIds))
    : [];
  const sheets = new Map(sheetRows.map((one) => [one.id, one.data]));
  const [tournament] = inCup
    ? await db
        .select({ name: milestone.name })
        .from(milestone)
        .where(and(eq(milestone.seriesId, row.id), eq(milestone.mark, "tournament")))
        .orderBy(desc(milestone.position))
        .limit(1)
    : [];
  const side = (player: string): MatchTeam => {
    const one = held.find((h) => h.ownerId === player);
    if (!one) return tournament ? { state: "waiting", milestone: tournament.name } : { state: "none" };
    if (!one.seen) return { state: "hidden", locked: one.lockedAt !== null };
    return { state: "shown", id: one.id, name: one.name, locked: one.lockedAt !== null, members: one.slots.map((member) => matchMember(member, sheets)) };
  };
  return { a: side(players.a), b: side(players.b) };
}

async function matchOf(row: SeriesRow, matchId: string, reader: Viewer): Promise<MatchPage | null> {
  const page = await leagueOf(row, reader);
  const round = page.rounds.find((r) => r.matches.some((m) => m.id === matchId));
  const slot = page.cup?.slots.find((s) => s.match === matchId);
  const match = round?.matches.find((m) => m.id === matchId) ?? (slot?.a && slot.b ? { ...slot, id: matchId, a: slot.a, b: slot.b } : undefined);
  if (!match) return null;
  const games = await db.select().from(leagueGame).where(eq(leagueGame.matchId, matchId)).orderBy(asc(leagueGame.number));
  const played = games.map((g) => ({ number: g.number, winner: g.winnerId, faintedA: g.faintedA, faintedB: g.faintedB, replay: g.replay }));
  const won = wins(match, played);
  const seeds = round ? [] : (page.cup?.seeds ?? []);
  const side = (id: string) => {
    const standing = page.standings.find((s) => s.player === id);
    const seed = seeds.indexOf(id);
    return { id, name: page.players.find((p) => p.id === id)?.name ?? "?", place: standing?.place ?? null, points: standing?.points ?? 0, seed: seed < 0 ? null : seed + 1 };
  };
  const whole = covers(match, played);
  return {
    id: match.id,
    number: page.number,
    name: page.name,
    round: round ? { number: round.number, milestone: round.milestone } : null,
    cup: round ? null : cupPlace(page, matchId),
    a: side(match.a),
    b: side(match.b),
    teams: await matchTeams(row, matchId, match, !round, reader),
    gamesA: match.gamesA,
    gamesB: match.gamesB,
    faintedA: match.faintedA,
    faintedB: match.faintedB,
    games: played,
    unrecorded: whole ? { a: 0, b: 0 } : { a: (match.gamesA ?? 0) - won.gamesA, b: (match.gamesB ?? 0) - won.gamesB },
    next: nextGame(match, played),
    admin: !!reader.admin,
  };
}

league.get("/:number/league/matches/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const page = await matchOf(row, c.req.param("id"), reader);
  if (!page) return c.json({ error: t(c).noMatch }, 404);
  return c.json(page);
});

const refusalStatus: Record<Refusal, 400 | 404 | 409> = { noMatch: 404, winner: 400, order: 409, closed: 409, noGame: 404, past: 409, score: 409, later: 409 };

async function moveOn(c: Context, make: (matchId: string, input: GameInput, by: string) => Promise<Move>) {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", true);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const matchId = c.req.param("id") ?? "";
  if (!(await matchOf(row, matchId, reader))) return c.json({ error: t(c).noMatch }, 404);
  const input = await body(c.req.raw, gameInput);
  if (!input) return c.json({ error: t(c).badGame }, 400);
  const moved = await make(matchId, input, reader.id);
  if (!moved.done) return c.json({ error: t(c)[moved.refused] }, refusalStatus[moved.refused]);
  return c.json(await matchOf(row, matchId, reader));
}

league.post("/:number/league/matches/:id/games", requireAdmin, (c) => moveOn(c, recordGame));

league.put("/:number/league/matches/:id/games/:game", requireAdmin, async (c) => {
  const number = Number(c.req.param("game"));
  if (!Number.isInteger(number)) return c.json({ error: t(c).noGame }, 404);
  return moveOn(c, (matchId, input, by) => fixGame(matchId, number, input, by));
});

const roundStatus: Record<RoundRefusal, 400 | 404 | 409> = {
  noRound: 404,
  allOpen: 409,
  noDraw: 409,
  notNewest: 409,
  started: 409,
  player: 400,
  same: 400,
  twice: 400,
  missing: 400,
  bye: 400,
  met: 409,
};

async function roundMove(c: Context, make: (seriesId: string) => Promise<RoundMove | null>) {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", true);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const moved = await make(row.id);
  if (!moved) return c.json({ error: t(c).badPairs }, 400);
  if (!moved.done) return c.json({ error: t(c)[moved.refused] }, roundStatus[moved.refused]);
  return c.json(await leagueOf(row, reader));
}

league.post("/:number/league/rounds", requireAdmin, async (c) => {
  const input = await body(c.req.raw, openInput);
  if (!input) return c.json({ error: t(c).badMode }, 400);
  return roundMove(c, (seriesId) => openRound(seriesId, input.mode));
});

const roundNumber = (c: Context) => Number(c.req.param("round"));

league.post("/:number/league/rounds/:round/draw", requireAdmin, (c) => roundMove(c, (seriesId) => redrawRound(seriesId, roundNumber(c))));

league.put("/:number/league/rounds/:round/pairs", requireAdmin, (c) =>
  roundMove(c, async (seriesId) => {
    const input = await body(c.req.raw, pairsInput);
    return input ? setPairs(seriesId, roundNumber(c), input) : null;
  }),
);

const cupRefusal: Record<CupRefusal, { status: 400 | 409; say: "cupStarted" | "cupSize" | "player" | "twice" }> = {
  started: { status: 409, say: "cupStarted" },
  size: { status: 400, say: "cupSize" },
  player: { status: 400, say: "player" },
  twice: { status: 400, say: "twice" },
};

league.post("/:number/league/cup", requireAdmin, async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), true);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const input = await body(c.req.raw, cupInput);
  if (!input) return c.json({ error: t(c).badCup }, 400);
  const page = await leagueOf(row, reader);
  const moved = await startCup(row.id, page.standings.map((s) => s.player), input.players, reader.id);
  if (!moved.done) return c.json({ error: t(c)[cupRefusal[moved.refused].say] }, cupRefusal[moved.refused].status);
  return c.json(await leagueOf(row, reader));
});

const filled = (slots: TeamSlots) => slots.filter((member) => member !== null);

league.post("/:number/league/tries", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const page = await leagueOf(row, reader);
  if (reader.admin || !page.players.some((p) => p.id === reader.id)) return c.json({ error: t(c).notPlayer }, 403);
  const input = await body(c.req.raw, tryInput);
  if (!input) return c.json({ error: t(c).badTry }, 400);
  let slots: TeamSlots;
  if ("id" in input.team) {
    const [picked] = await db.select({ slots: team.slots }).from(team).where(and(eq(team.id, input.team.id), eq(team.ownerId, reader.id)));
    if (!picked) return c.json({ error: t(c).noTeam }, 404);
    slots = picked.slots;
  } else {
    slots = input.team.slots;
    if (!backedBy(slots, [], true)) return c.json({ error: t(c).notFree }, 400);
  }
  const members = filled(slots);
  if (members.length === 0 || members.length > PARTY_SIZE) return c.json({ error: t(c).partySize }, 400);
  if (input.fell.length !== members.length) return c.json({ error: t(c).badTry }, 400);
  if (fellProblem(input.combatsWon, input.fell)) return c.json({ error: t(c).fell }, 400);
  const pasted = "slots" in input.team ? input.team.slots : null;
  await db.transaction(async (tx) => {
    let teamId = "id" in input.team ? input.team.id : null;
    if (pasted) {
      const names = await tx.select({ name: team.name }).from(team).where(eq(team.ownerId, reader.id));
      teamId = crypto.randomUUID();
      await insertTeam(tx, { id: teamId, ownerId: reader.id, name: nextTeamName(names.map((n) => n.name), t(c).tryTeam), anyPokemon: true, slots: pasted, pool: row.pool, sources: [] });
    }
    await tx.insert(leagueTry).values({
      id: crypto.randomUUID(),
      seriesId: row.id,
      playerId: reader.id,
      teamId,
      combatsWon: input.combatsWon,
      members: members.map((member, at) => ({ species: member.species, fell: input.fell[at] ?? null })),
      loggedBy: reader.id,
    });
  });
  return c.json(await leagueOf(row, reader));
});

async function changeTry(c: Context, change: (id: string, by: string) => Promise<Response | null>) {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const id = c.req.param("id") ?? "";
  const [held] = await db.select({ playerId: leagueTry.playerId }).from(leagueTry).where(and(eq(leagueTry.id, id), eq(leagueTry.seriesId, row.id)));
  if (!held) return c.json({ error: t(c).noTry }, 404);
  if (!reader.admin && held.playerId !== reader.id) return c.json({ error: t(c).notYours }, 403);
  const refused = await change(id, reader.id);
  return refused ?? c.json(await leagueOf(row, reader));
}

league.put("/:number/league/tries/:id", (c) =>
  changeTry(c, async (id, by) => {
    const input = await body(c.req.raw, tryEdit);
    if (!input) return c.json({ error: t(c).badTry }, 400);
    const [held] = await db.select({ members: leagueTry.members }).from(leagueTry).where(eq(leagueTry.id, id));
    if (!held || input.fell.length !== held.members.length) return c.json({ error: t(c).badTry }, 400);
    if (fellProblem(input.combatsWon, input.fell)) return c.json({ error: t(c).fell }, 400);
    await db
      .update(leagueTry)
      .set({
        combatsWon: input.combatsWon,
        members: held.members.map((member, at) => ({ species: member.species, fell: input.fell[at] ?? null })),
        editedBy: by,
        editedAt: new Date(),
      })
      .where(eq(leagueTry.id, id));
    return null;
  }),
);

league.delete("/:number/league/tries/:id", (c) =>
  changeTry(c, async (id) => {
    await db.delete(leagueTry).where(eq(leagueTry.id, id));
    return null;
  }),
);
