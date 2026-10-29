import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type Context, Hono } from "hono";
import type * as z from "zod";
import {
  banInput,
  barredBan,
  bestTries,
  covers,
  CUP_BROUGHT,
  CUP_MAX,
  CUP_MIN,
  CUP_TEAM_SIZE,
  cupBans,
  cupInput,
  cupShape,
  cupSlots,
  type LeagueCup,
  type MatchCup,
  FAINTED_PER_GAME,
  fellProblem,
  type GameInput,
  gameInput,
  type HatchedEggs,
  type LeaguePage,
  type LeagueTry,
  type MatchMember,
  type MatchPage,
  type LeagueMode,
  type MatchTeam,
  type RoundTeamState,
  type GameDraft,
  type GameSide,
  type LeagueGame,
  LEAGUE_COMBATS,
  MATCH_GAMES,
  nextGame,
  openInput,
  pairsHidden,
  pairsInput,
  PARTY_SIZE,
  pickInput,
  standings,
  storyMilestones,
  tryChange,
  type TryInput,
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
import { banIn, fixGame, matchTeamsOf, type Move, pickSix, recordGame, type Refusal, sidesOf, started } from "./match.js";
import { openRound, redrawRound, type RoundMove, type RoundRefusal, setPairs } from "./rounds.js";
import { cup, leagueGame, leagueMatch, leagueRound, leagueTry, milestone, save, seriesPlayer, snapshot, team, teamSource, user } from "./schema.js";
import { findShown, leaguesSeenBy, type SeriesRow, teamsSeenBy, type Viewer, viewer } from "./series-data.js";
import { insertTeam, lockTryTeam } from "./teams.js";

const gameNumbers = Array.from({ length: MATCH_GAMES }, (_, at) => at + 1).join(", ");

const t = says({
  en: {
    signIn: "Sign in first",
    noSeries: "No such series",
    noMatch: "No such match",
    badGame: `A winner of the two, each side's fainted from 0 to ${FAINTED_PER_GAME} and a replay link or none`,
    winner: "The winner must be one of the match's two players",
    closed: "The match is decided; fix one of its games instead",
    noGame: "No such game",
    past: "That would leave a game after the match is won",
    order: `The games must run ${gameNumbers} with none missing`,
    score: "That would not fit the score the match keeps from the Trainer League app",
    badTry: `Combats won from 0 to ${LEAGUE_COMBATS}, and where each Pokémon fell`,
    notPlayer: "Only the league's players log their Pokémon League tries, and an admin for any of them",
    noTeam: "No such team of the try's player",
    partySize: `A Pokémon League team brings 1 to ${PARTY_SIZE} Pokémon`,
    notFree: "A pasted team holds only Any Pokémon members",
    fell: "A Pokémon can only fall in a combat the try reached",
    noTry: "No such try",
    notYours: "Only the try's player or an admin changes it",
    teamByAdmin: "Only an admin changes the team a try was played with",
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
    cupSize: `The cup needs an even number of players, from ${CUP_MIN} to ${CUP_MAX}`,
    badCup: "The players who enter the cup and its mode, open or closed",
    badBan: `The player who bans and one of the other's ${CUP_TEAM_SIZE}`,
    badPick: (n: number) => `The player who picks and ${n} of their team`,
    notSide: "Only a player bans and picks, and only for themselves",
    noDraft: "Only a cup match's games have bans and picks",
    noBans: "A closed cup's games have no bans",
    notOpen: "That game is not open for bans and picks",
    banned: "Your ban for this game is in",
    barred: "You won the last game, so you cannot ban the Pokémon you banned in it again",
    slot: "That is not one of the other player's Pokémon",
    bansFirst: "Both bans go in before the picks",
    picked: `Your ${CUP_BROUGHT} for this game are in`,
    pick: (n: number) => `Pick ${n} of your Pokémon, none of them banned`,
  },
  es: {
    signIn: "Inicia sesión primero",
    noSeries: "Esa serie no existe",
    noMatch: "Ese combate no existe",
    badGame: `Un ganador de los dos, los debilitados de cada lado de 0 a ${FAINTED_PER_GAME} y un enlace a la repetición o ninguno`,
    winner: "El ganador tiene que ser uno de los dos jugadores del combate",
    closed: "El combate está decidido; corrige una de sus partidas",
    noGame: "Esa partida no existe",
    past: "Quedaría una partida después de ganado el combate",
    order: `Las partidas tienen que ir ${gameNumbers} sin huecos`,
    score: "No encajaría con el resultado que el combate conserva de la app de la Liga",
    badTry: `Combates ganados de 0 a ${LEAGUE_COMBATS}, y dónde cayó cada Pokémon`,
    notPlayer: "Solo los jugadores de la liga anotan sus intentos de la Liga Pokémon, y un administrador los de cualquiera de ellos",
    noTeam: "El jugador del intento no tiene ese equipo",
    partySize: `Un equipo de la Liga Pokémon lleva de 1 a ${PARTY_SIZE} Pokémon`,
    notFree: "Un equipo pegado solo lleva miembros de Cualquier Pokémon",
    fell: "Un Pokémon solo puede caer en un combate al que llegó el intento",
    noTry: "Ese intento no existe",
    notYours: "Solo el jugador del intento o un administrador puede cambiarlo",
    teamByAdmin: "Solo un administrador cambia el equipo con el que se jugó un intento",
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
    cupSize: `La copa necesita un número par de jugadores, de ${CUP_MIN} a ${CUP_MAX}`,
    badCup: "Los jugadores que entran en la copa y su modo, abierta o cerrada",
    badBan: `El jugador que veta y uno de los ${CUP_TEAM_SIZE} del otro`,
    badPick: (n: number) => `El jugador que elige y ${n} de su equipo`,
    notSide: "Solo un jugador veta y elige, y solo por sí mismo",
    noDraft: "Solo las partidas de un combate de copa tienen vetos y elecciones",
    noBans: "Las partidas de una copa cerrada no tienen vetos",
    notOpen: "Esa partida no está abierta para vetos y elecciones",
    banned: "Tu veto para esta partida ya está",
    barred: "Ganaste la partida anterior, así que no puedes volver a vetar el Pokémon que vetaste en ella",
    slot: "Ese no es uno de los Pokémon del otro jugador",
    bansFirst: "Primero van los dos vetos y luego las elecciones",
    picked: `Tus ${CUP_BROUGHT} para esta partida ya están`,
    pick: (n: number) => `Elige ${n} de tus Pokémon, ninguno vetado`,
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
  const games = rows.length
    ? await db.select({ matchId: leagueGame.matchId, winner: leagueGame.winnerId }).from(leagueGame).where(inArray(leagueGame.matchId, rows.map((r) => r.id)))
    : [];
  const won = (match: string | undefined, player: string | null) => games.filter((g) => g.matchId === match && g.winner === player).length;
  return {
    mode: held.mode,
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
        wonA: won(row?.id, slot.a),
        wonB: won(row?.id, slot.b),
      };
    }),
    group: draw.group,
    champion: draw.champion,
    at: held.startedAt.toISOString(),
  };
}

async function finishedOf(seriesId: string, players: string[]): Promise<string[]> {
  const milestones = await db.select({ id: milestone.id, mark: milestone.mark }).from(milestone).where(eq(milestone.seriesId, seriesId)).orderBy(asc(milestone.position));
  const story = storyMilestones(milestones);
  if (story.length === 0 || players.length === 0) return [];
  const done = await db
    .selectDistinct({ player: save.userId })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .where(and(eq(save.seriesId, seriesId), inArray(save.userId, players), inArray(snapshot.milestoneId, story)));
  return players.filter((player) => done.some((row) => row.player === player));
}

export async function leagueOf(row: SeriesRow, reader: Viewer): Promise<LeaguePage> {
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
  const roundTeams = matches.length ? await db.select({ matchId: team.matchId, ownerId: team.ownerId, lockedAt: team.lockedAt }).from(team).where(inArray(team.matchId, matches.map((m) => m.id))) : [];
  const teamState = (matchId: string, player: string): RoundTeamState => {
    const one = roundTeams.find((held) => held.matchId === matchId && held.ownerId === player);
    return one ? (one.lockedAt ? "locked" : "building") : "save";
  };
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
  const seen = new Set(linked.length ? (await db.select({ id: team.id }).from(team).where(and(inArray(team.id, linked), await teamsSeenBy(reader)))).map((r) => r.id) : []);
  const others = (await leaguesSeenBy(reader, [row.id]))(row.id);
  const counted = new Map<string, number>();
  const tries = logged
    .filter((one) => known.has(one.playerId))
    .map((one) => {
      const number = (counted.get(one.playerId) ?? 0) + 1;
      counted.set(one.playerId, number);
      const members = others || one.playerId === reader.id ? one.members.map((member) => ({ ...member, ...describeMember(member.species, member.species) })) : null;
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
    rounds: ordered.map(({ number, milestone: m, round }) => {
      const own = matches.filter((match) => match.roundId === round!.id);
      const hidden = reader.admin
        ? null
        : pairsHidden(reader.id, {
            mode: round!.mode,
            bye: round!.byeId,
            matches: own.map((match) => ({
              id: match.id,
              a: match.playerA,
              b: match.playerB,
              decided: match.gamesA !== null,
              locked: roundTeams.filter((held) => held.matchId === match.id && held.lockedAt !== null).map((held) => held.ownerId),
            })),
          });
      const unseen = own.filter((match) => hidden?.matches.has(match.id));
      const mine = own.find((match) => match.playerA === reader.id || match.playerB === reader.id);
      const heldBack = hidden?.yours && mine ? (teamState(mine.id, reader.id) === "save" ? "upload" : "lock") : null;
      return {
        number,
        milestone: m.name,
        mode: round!.mode,
        bye: hidden?.bye ? null : round!.byeId,
        started: own.some((match) => match.gamesA !== null || withGames.has(match.id)),
        matches: own
          .filter((match) => !hidden?.matches.has(match.id))
          .map((match) => ({
            id: match.id,
            a: match.playerA,
            b: match.playerB,
            gamesA: match.gamesA,
            gamesB: match.gamesB,
            faintedA: match.faintedA,
            faintedB: match.faintedB,
            teamA: teamState(match.id, match.playerA),
            teamB: teamState(match.id, match.playerB),
          })),
        hidden: hidden && unseen.length > 0 ? { pairs: unseen.length, toPlay: unseen.filter((match) => match.gamesA === null).length, yours: heldBack } : null,
      };
    }),
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
    finished: reader.admin ? await finishedOf(row.id, players.map((p) => p.id)) : null,
    enrolled: enrolled.some((p) => p.id === reader.id),
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

async function matchTeams(
  row: SeriesRow,
  matchId: string,
  players: { a: string; b: string },
  round: { milestone: string; unplayed: boolean } | null,
  mode: LeagueMode,
  reader: Viewer,
): Promise<{ a: MatchTeam; b: MatchTeam }> {
  const inCup = round === null;
  const seen = await teamsSeenBy(reader);
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
  const sheet = inCup ? tournament?.name : round.unplayed ? round.milestone : undefined;
  const side = (player: string): MatchTeam => {
    const one = held.find((h) => h.ownerId === player);
    if (!one) return sheet ? { state: "waiting", milestone: sheet } : { state: "none" };
    if (!one.seen) return { state: "hidden", locked: one.lockedAt !== null, reveal: mode === "closed" ? "result" : inCup ? "all" : "both" };
    return { state: "shown", id: one.id, name: one.name, locked: one.lockedAt !== null, members: one.slots.map((member) => matchMember(member, sheets)) };
  };
  return { a: side(players.a), b: side(players.b) };
}

async function matchOf(row: SeriesRow, matchId: string, reader: Viewer): Promise<MatchPage | null> {
  const page = await leagueOf(row, reader);
  const round = page.rounds.find((r) => r.matches.some((m) => m.id === matchId));
  const slot = page.cup?.slots.find((s) => s.match === matchId);
  const match = round?.matches.find((m) => m.id === matchId) ?? (slot?.a && slot.b ? { ...slot, id: matchId, a: slot.a, b: slot.b } : undefined);
  const mode = round?.mode ?? page.cup?.mode;
  if (!match || !mode) return null;
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
  const teams = await matchTeams(row, matchId, match, round ? { milestone: round.milestone, unplayed: match.gamesA === null } : null, mode, reader);
  return {
    id: match.id,
    number: page.number,
    name: page.name,
    round: round ? { number: round.number, milestone: round.milestone } : null,
    cup: round ? null : cupPlace(page, matchId),
    a: side(match.a),
    b: side(match.b),
    teams,
    gamesA: match.gamesA,
    gamesB: match.gamesB,
    faintedA: match.faintedA,
    faintedB: match.faintedB,
    games: played,
    unrecorded: whole ? { a: 0, b: 0 } : { a: (match.gamesA ?? 0) - won.gamesA, b: (match.gamesB ?? 0) - won.gamesB },
    next: nextGame(match, played),
    draft: round ? null : await draftOf(matchId, match, played, mode, teams, reader),
    admin: !!reader.admin,
  };
}

async function draftOf(
  matchId: string,
  match: { a: string; b: string; gamesA: number | null; gamesB: number | null },
  games: LeagueGame[],
  mode: LeagueMode,
  teams: { a: MatchTeam; b: MatchTeam },
  reader: Viewer,
): Promise<GameDraft | null> {
  const next = nextGame(match, games);
  const number = next ?? games.at(-1)?.number ?? null;
  if (number === null) return null;
  const held = await matchTeamsOf(db, matchId);
  const sides = await sidesOf(db, matchId);
  const at = (player: string, n: number) => sides.find((side) => side.playerId === player && side.number === n);
  const bans = cupBans(mode);
  const bothBanned = [match.a, match.b].every((player) => at(player, number)?.ban != null);
  const bothPicked = [match.a, match.b].every((player) => at(player, number)?.picks != null);
  const side = (player: string, shown: boolean): GameSide => {
    const mine = at(player, number);
    const own = reader.id === player;
    return {
      banned: mine?.ban != null,
      ban: own || bothBanned ? (mine?.ban ?? null) : null,
      barred: own && bans ? barredBan(player, number, games, (n) => at(player, n)?.ban ?? null) : null,
      picked: mine?.picks != null,
      picks: own || (bothPicked && shown) ? (mine?.picks ?? null) : null,
    };
  };
  return {
    number,
    bans,
    open: next !== null && started({ playerA: match.a, playerB: match.b }, mode, held),
    a: side(match.a, teams.a.state === "shown"),
    b: side(match.b, teams.b.state === "shown"),
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

const refusalStatus: Record<Refusal, 400 | 403 | 404 | 409> = {
  noMatch: 404,
  winner: 400,
  order: 409,
  closed: 409,
  noGame: 404,
  past: 409,
  score: 409,
  later: 409,
  notSide: 403,
  noDraft: 409,
  noBans: 409,
  notOpen: 409,
  banned: 409,
  barred: 409,
  slot: 400,
  bansFirst: 409,
  picked: 409,
  pick: 400,
};

function refusalText(c: Context, refused: Refusal): string {
  const said = t(c);
  return refused === "pick" ? said.pick(CUP_BROUGHT) : said[refused];
}

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
  if (!moved.done) return c.json({ error: refusalText(c, moved.refused) }, refusalStatus[moved.refused]);
  return c.json(await matchOf(row, matchId, reader));
}

async function draftOn<S extends z.ZodType>(c: Context, schema: S, bad: string, make: (matchId: string, number: number, input: z.infer<S>, by: string) => Promise<Move>) {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const matchId = c.req.param("id") ?? "";
  if (!(await matchOf(row, matchId, reader))) return c.json({ error: t(c).noMatch }, 404);
  const input = await body(c.req.raw, schema);
  if (!input) return c.json({ error: bad }, 400);
  const moved = await make(matchId, Number(c.req.param("game")), input, reader.id);
  if (!moved.done) return c.json({ error: refusalText(c, moved.refused) }, refusalStatus[moved.refused]);
  return c.json(await matchOf(row, matchId, reader));
}

league.post("/:number/league/matches/:id/games/:game/ban", (c) => draftOn(c, banInput, t(c).badBan, (matchId, number, input, by) => banIn(matchId, number, input.player, input.slot, by)));

league.post("/:number/league/matches/:id/games/:game/pick", (c) =>
  draftOn(c, pickInput, t(c).badPick(CUP_BROUGHT), (matchId, number, input, by) => pickSix(matchId, number, input.player, input.slots, by)),
);

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
  const moved = await startCup(row.id, page.standings.map((s) => s.player), input.players, input.mode, reader.id);
  if (!moved.done) return c.json({ error: t(c)[cupRefusal[moved.refused].say] }, cupRefusal[moved.refused].status);
  return c.json(await leagueOf(row, reader));
});

const filled = (slots: TeamSlots) => slots.filter((member) => member !== null);

type TryTeam = TryInput["team"];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function tryMembers(c: Context, player: string, picked: TryTeam): Promise<{ slots: TeamSlots } | Response> {
  let slots: TeamSlots;
  if ("id" in picked) {
    const [held] = await db.select({ slots: team.slots }).from(team).where(and(eq(team.id, picked.id), eq(team.ownerId, player), isNull(team.matchId)));
    if (!held) return c.json({ error: t(c).noTeam }, 404);
    slots = held.slots;
  } else {
    slots = picked.slots;
    if (!backedBy(slots, [], true)) return c.json({ error: t(c).notFree }, 400);
  }
  const members = filled(slots);
  if (members.length === 0 || members.length > PARTY_SIZE) return c.json({ error: t(c).partySize }, 400);
  return { slots };
}

async function placeTryTeam(c: Context, tx: Tx, picked: TryTeam, player: string, pool: SeriesRow["pool"], by: string): Promise<string> {
  if ("id" in picked) {
    await lockTryTeam(tx, picked.id, by);
    return picked.id;
  }
  const names = await tx.select({ name: team.name }).from(team).where(eq(team.ownerId, player));
  const id = crypto.randomUUID();
  await insertTeam(tx, {
    id,
    ownerId: player,
    name: nextTeamName(names.map((n) => n.name), t(c).tryTeam),
    anyPokemon: true,
    slots: picked.slots,
    pool,
    sources: [],
    locked: { at: new Date(), by },
    private: false,
  });
  return id;
}

league.post("/:number/league/tries", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const page = await leagueOf(row, reader);
  if (!reader.admin && !page.players.some((p) => p.id === reader.id)) return c.json({ error: t(c).notPlayer }, 403);
  const input = await body(c.req.raw, tryInput);
  if (!input) return c.json({ error: t(c).badTry }, 400);
  const player = reader.admin ? input.player : reader.id;
  if (!player || (input.player !== undefined && input.player !== player) || !page.players.some((p) => p.id === player)) return c.json({ error: t(c).notPlayer }, 403);
  const read = await tryMembers(c, player, input.team);
  if (read instanceof Response) return read;
  const members = filled(read.slots);
  if (input.fell.length !== members.length) return c.json({ error: t(c).badTry }, 400);
  if (fellProblem(input.combatsWon, input.fell)) return c.json({ error: t(c).fell }, 400);
  await db.transaction(async (tx) => {
    const teamId = await placeTryTeam(c, tx, input.team, player, row.pool, reader.id);
    await tx.insert(leagueTry).values({
      id: crypto.randomUUID(),
      seriesId: row.id,
      playerId: player,
      teamId,
      combatsWon: input.combatsWon,
      members: members.map((member, at) => ({ species: member.species, fell: input.fell[at] ?? null })),
      loggedBy: reader.id,
    });
  });
  return c.json(await leagueOf(row, reader));
});

async function changeTry(c: Context, change: (id: string, reader: Viewer, row: SeriesRow) => Promise<Response | null>) {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const id = c.req.param("id") ?? "";
  const [held] = await db.select({ playerId: leagueTry.playerId }).from(leagueTry).where(and(eq(leagueTry.id, id), eq(leagueTry.seriesId, row.id)));
  if (!held) return c.json({ error: t(c).noTry }, 404);
  if (!reader.admin && held.playerId !== reader.id) return c.json({ error: t(c).notYours }, 403);
  const refused = await change(id, reader, row);
  return refused ?? c.json(await leagueOf(row, reader));
}

league.put("/:number/league/tries/:id", (c) =>
  changeTry(c, async (id, reader, row) => {
    const input = await body(c.req.raw, tryChange);
    if (!input) return c.json({ error: t(c).badTry }, 400);
    if (input.team && !reader.admin) return c.json({ error: t(c).teamByAdmin }, 403);
    const [held] = await db.select({ members: leagueTry.members, playerId: leagueTry.playerId, teamId: leagueTry.teamId }).from(leagueTry).where(eq(leagueTry.id, id));
    if (!held) return c.json({ error: t(c).noTry }, 404);
    const picked = input.team;
    let species = held.members.map((member) => member.species);
    if (picked) {
      const read = await tryMembers(c, held.playerId, picked);
      if (read instanceof Response) return read;
      species = filled(read.slots).map((member) => member.species);
    }
    if (input.fell.length !== species.length) return c.json({ error: t(c).badTry }, 400);
    if (fellProblem(input.combatsWon, input.fell)) return c.json({ error: t(c).fell }, 400);
    await db.transaction(async (tx) => {
      let teamId = held.teamId;
      if (picked) {
        teamId = await placeTryTeam(c, tx, picked, held.playerId, row.pool, reader.id);
        if (held.teamId && held.teamId !== teamId) {
          const [other] = await tx
            .select({ id: leagueTry.id })
            .from(leagueTry)
            .where(and(eq(leagueTry.teamId, held.teamId), ne(leagueTry.id, id)))
            .limit(1);
          if (!other) await tx.update(team).set({ lockedAt: null, lockedBy: null, private: true }).where(eq(team.id, held.teamId));
        }
      }
      await tx
        .update(leagueTry)
        .set({
          teamId,
          combatsWon: input.combatsWon,
          members: species.map((one, at) => ({ species: one, fell: input.fell[at] ?? null })),
          editedBy: reader.id,
          editedAt: new Date(),
        })
        .where(eq(leagueTry.id, id));
    });
    return null;
  }),
);

league.delete("/:number/league/tries/:id", (c) =>
  changeTry(c, async (id) => {
    await db.delete(leagueTry).where(eq(leagueTry.id, id));
    return null;
  }),
);
