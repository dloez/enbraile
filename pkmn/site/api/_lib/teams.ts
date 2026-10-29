import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { lockNeeds } from "../../shared/league.js";
import type { Snapshot } from "../../shared/snapshot.js";
import {
  backedBy,
  emptySlots,
  FREE_LEVEL,
  FREE_NATURE,
  isFree,
  MAX_EV,
  MAX_IV,
  MAX_LEVEL,
  newTeamInput,
  nextTeamName,
  teamInput,
  teamKind,
  type TeamLeague,
  type TeamPage,
  type TeamRow,
  type TeamSlots,
  type TeamSourceRow,
  TEAM_NAME_MAX,
  teamState,
  type TeamWait,
} from "../../shared/team.js";
import { DEFAULT_COSTS } from "../../shared/games.js";
import { DEFAULT_POOL, type FreePool, type TeamPool } from "../../shared/pool.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { requireAdmin } from "./admin.js";
import { cup, cupEntrant, game, gameSide, leagueGame, leagueMatch, leagueRound, leagueTry, milestone, save, series, snapshot, team, teamSource, user } from "./schema.js";
import { hiddenPairs, savesSeenBy, teamsSeenBy, type Viewer, viewer } from "./series-data.js";
import { seesSpreads, slotsWithoutSpreads, withoutSpreads } from "./spreads.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    signIn: "Sign in first",
    noTeam: "No such team",
    adminNoTeams: "Admins have no teams",
    notTeam: "Not a team",
    noSnapshot: "No such snapshot",
    outsideSources: "A member comes from outside the team's sources",
    ownerChanges: "Only the team's owner changes it",
    needSource: "A team needs a source",
    ownerDeletes: "Only the team's owner deletes it",
    uploadFirst: "Upload a snapshot to the running series first",
    team: "Team",
    locked: "This team is locked",
    notLocked: "This team is not locked",
    leagueSet: "A league team's sources, size and visibility are set by its match",
    leagueKept: "A league team stays with its match",
    ownerLocks: "Only the team's owner locks it in",
    notLeague: "Only a league team is locked in",
    fillFirst: (need: number, size: number) => (need === size ? `Fill all ${size} slots before locking in` : `Fill ${need} slots before locking in`),
    ownerClones: "Only the team's owner or an admin clones it",
    drafting: "A game of this team's match without a result has bans or picks in",
    copy: "(copy)",
  },
  es: {
    signIn: "Inicia sesión primero",
    noTeam: "Ese equipo no existe",
    adminNoTeams: "Los administradores no tienen equipos",
    notTeam: "No es un equipo",
    noSnapshot: "Esa captura no existe",
    outsideSources: "Un miembro viene de fuera de las fuentes del equipo",
    ownerChanges: "Solo el dueño del equipo puede cambiarlo",
    needSource: "Un equipo necesita una fuente",
    ownerDeletes: "Solo el dueño del equipo puede borrarlo",
    uploadFirst: "Sube antes una captura a la serie en curso",
    team: "Equipo",
    locked: "Este equipo está bloqueado",
    notLocked: "Este equipo no está bloqueado",
    leagueSet: "Las fuentes, el tamaño y la visibilidad de un equipo de liga los fija su enfrentamiento",
    leagueKept: "Un equipo de liga se queda con su enfrentamiento",
    ownerLocks: "Solo el dueño del equipo puede bloquearlo",
    notLeague: "Solo se bloquea un equipo de liga",
    fillFirst: (need: number, size: number) => (need === size ? `Llena los ${size} huecos antes de bloquearlo` : `Llena ${need} huecos antes de bloquearlo`),
    ownerClones: "Solo el dueño del equipo o un administrador lo clona",
    drafting: "Una partida sin resultado del combate de este equipo ya tiene vetos o elecciones",
    copy: "(copia)",
  },
});

export const teams = new Hono();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewTeam = { id: string; ownerId: string; name: string; anyPokemon: boolean; slots: TeamSlots; pool: TeamPool; freePool?: FreePool; sources: readonly string[]; matchId?: string; locked?: { at: Date; by: string | null }; private?: boolean };

export async function insertTeam(tx: Tx, made: NewTeam) {
  await tx.insert(team).values({
    id: made.id,
    ownerId: made.ownerId,
    name: made.name,
    size: made.slots.length,
    anyPokemon: made.anyPokemon,
    slots: made.slots,
    pool: made.pool,
    ...(made.freePool ? { freePool: made.freePool } : {}),
    ...(made.private !== undefined ? { private: made.private } : {}),
    matchId: made.matchId ?? null,
    lockedAt: made.locked?.at ?? null,
    lockedBy: made.locked?.by ?? null,
  });
  if (made.sources.length > 0) await tx.insert(teamSource).values(made.sources.map((snapshotId, position) => ({ teamId: made.id, snapshotId, position })));
}

const sourceColumns = {
  teamId: teamSource.teamId,
  id: snapshot.id,
  seriesId: series.id,
  milestoneId: snapshot.milestoneId,
  playerId: user.id,
  playerName: user.name,
  seriesNumber: series.number,
  seriesName: series.name,
  milestone: milestone.name,
};

function sourcesQuery() {
  return db
    .select(sourceColumns)
    .from(teamSource)
    .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(user, eq(user.id, save.userId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId));
}

type SourceRow = Omit<Awaited<ReturnType<typeof sourcesQuery>>[number], "teamId">;

function sourceOf(row: SourceRow): TeamSourceRow {
  return {
    id: row.id,
    player: { id: row.playerId, name: row.playerName },
    series: { number: row.seriesNumber, name: row.seriesName },
    milestone: row.milestone,
  };
}

async function owned(id: string, ownerId: string) {
  const [row] = await db
    .select({ matchId: team.matchId, cupId: leagueMatch.cupId, lockedAt: team.lockedAt, slots: team.slots })
    .from(team)
    .leftJoin(leagueMatch, eq(leagueMatch.id, team.matchId))
    .where(and(eq(team.id, id), eq(team.ownerId, ownerId)));
  return row;
}

async function livingOn(teamId: string): Promise<(readonly string[])[] | null> {
  const [row] = await db
    .select({ living: sql<string[]>`jsonb_path_query_array(${snapshot.data}->'pokemon', '$[*].species')` })
    .from(teamSource)
    .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
    .where(eq(teamSource.teamId, teamId))
    .orderBy(asc(teamSource.position))
    .limit(1);
  if (!row) return null;
  const { speciesTags } = await import("../../shared/dex.js");
  return row.living.map(speciesTags);
}

export async function lockTryTeam(tx: Tx, id: string, by: string) {
  await tx
    .update(team)
    .set({ lockedAt: new Date(), lockedBy: by })
    .where(and(eq(team.id, id), isNull(team.lockedAt)));
  await tx.update(team).set({ private: false }).where(eq(team.id, id));
}

function copyName(name: string, suffix: string): string {
  return `${name.slice(0, TEAM_NAME_MAX - suffix.length - 1).trimEnd()} ${suffix}`;
}

export function copySuffix(c: Context): string {
  return t(c).copy;
}

async function drafting(tx: Tx, matchId: string): Promise<boolean> {
  const [drafted] = await tx
    .select({ number: gameSide.number })
    .from(gameSide)
    .where(
      and(
        eq(gameSide.matchId, matchId),
        or(isNotNull(gameSide.ban), isNotNull(gameSide.picks)),
        sql`not exists (select 1 from ${leagueGame} where ${leagueGame.matchId} = ${gameSide.matchId} and ${leagueGame.number} = ${gameSide.number})`,
      ),
    )
    .limit(1);
  return drafted !== undefined;
}

export async function holdLeague(tx: Tx, seriesId: string): Promise<void> {
  await tx.select({ id: series.id }).from(series).where(eq(series.id, seriesId)).for("update");
  await tx.select({ id: cup.id }).from(cup).where(eq(cup.seriesId, seriesId)).for("update");
}

async function underWay(tx: Tx, matchId: string): Promise<boolean> {
  const [played] = await tx.select({ number: leagueGame.number }).from(leagueGame).where(eq(leagueGame.matchId, matchId)).limit(1);
  if (played) return true;
  const [drafted] = await tx
    .select({ number: gameSide.number })
    .from(gameSide)
    .where(and(eq(gameSide.matchId, matchId), or(isNotNull(gameSide.ban), isNotNull(gameSide.picks))))
    .limit(1);
  return drafted !== undefined;
}

export async function standsOn(tx: Tx, snapshotId: string, deleting: boolean): Promise<"underWay" | "played" | null> {
  const homes = await tx
    .selectDistinct({ matchId: team.matchId })
    .from(teamSource)
    .innerJoin(team, eq(team.id, teamSource.teamId))
    .where(and(eq(teamSource.snapshotId, snapshotId), isNotNull(team.matchId)));
  const matchIds = homes.flatMap((row) => (row.matchId ? [row.matchId] : [])).sort();
  if (matchIds.length === 0) return null;
  const matches = await tx
    .select({ id: leagueMatch.id, gamesA: leagueMatch.gamesA })
    .from(leagueMatch)
    .where(inArray(leagueMatch.id, matchIds))
    .orderBy(asc(leagueMatch.id))
    .for("update");
  let played = false;
  for (const match of matches) {
    if (match.gamesA !== null) played = true;
    else if (await underWay(tx, match.id)) return "underWay";
  }
  return deleting && played ? "played" : null;
}

type SnapshotMon = Snapshot["pokemon"][number];

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function spread(from: SnapshotMon["evs"], fallback: number, max: number) {
  const stat = (key: "hp" | "atk" | "def" | "spa" | "spd" | "spe") => clamp(from?.[key] ?? fallback, 0, max);
  return { hp: stat("hp"), atk: stat("atk"), def: stat("def"), spa: stat("spa"), spd: stat("spd"), spe: stat("spe") };
}

function freed(slots: TeamSlots, snapshotId: string, pokemon: readonly SnapshotMon[]): TeamSlots {
  return slots.map((member) => {
    if (member === null || isFree(member) || member.source !== snapshotId) return member;
    const mon = pokemon[member.index];
    if (!mon || mon.species !== member.species) return null;
    return {
      free: true as const,
      species: member.species,
      item: member.item,
      ability: member.ability ?? mon.ability,
      level: clamp(mon.level ?? FREE_LEVEL, 1, MAX_LEVEL),
      nature: member.nature ?? mon.nature ?? FREE_NATURE,
      evs: spread(mon.evs, 0, MAX_EV),
      ivs: spread(mon.ivs, MAX_IV, MAX_IV),
      moves: member.moves,
    };
  });
}

export async function startOver(tx: Tx, seriesId: string, snapshotId: string, suffix: string, movedTo: string | null): Promise<void> {
  const [sheet] = await tx.select({ data: snapshot.data }).from(snapshot).where(eq(snapshot.id, snapshotId));
  if (!sheet) return;
  const [tournament] = await tx
    .select({ id: milestone.id })
    .from(milestone)
    .where(and(eq(milestone.seriesId, seriesId), eq(milestone.mark, "tournament")))
    .orderBy(desc(milestone.position))
    .limit(1);
  const resting = await tx
    .select({ matchId: leagueMatch.id, round: leagueRound.milestoneId })
    .from(teamSource)
    .innerJoin(team, eq(team.id, teamSource.teamId))
    .innerJoin(leagueMatch, eq(leagueMatch.id, team.matchId))
    .leftJoin(leagueRound, eq(leagueRound.id, leagueMatch.roundId))
    .where(and(eq(teamSource.snapshotId, snapshotId), isNull(leagueMatch.gamesA)));
  const matchIds = [...new Set(resting.filter((row) => movedTo === null || (row.round ?? tournament?.id) !== movedTo).map((row) => row.matchId))].sort();
  for (const matchId of matchIds) {
    const held = await tx
      .select({ id: team.id, ownerId: team.ownerId, name: team.name, slots: team.slots, pool: team.pool, freePool: team.freePool })
      .from(team)
      .innerJoin(teamSource, eq(teamSource.teamId, team.id))
      .where(and(eq(team.matchId, matchId), eq(teamSource.snapshotId, snapshotId)))
      .for("update");
    for (const one of held) {
      if (one.slots.some((member) => member !== null)) {
        const sources = await sourceIds(one.id, tx);
        await insertTeam(tx, {
          id: crypto.randomUUID(),
          ownerId: one.ownerId,
          name: copyName(one.name, suffix),
          anyPokemon: true,
          slots: movedTo === null ? freed(one.slots, snapshotId, sheet.data.pokemon) : one.slots,
          pool: one.pool,
          freePool: one.freePool,
          sources: movedTo === null ? sources.filter((id) => id !== snapshotId) : sources,
          private: true,
        });
      }
      await tx.delete(team).where(eq(team.id, one.id));
    }
  }
}

async function sourceIds(teamId: string, tx: Tx | typeof db = db): Promise<string[]> {
  const rows = await tx.select({ id: teamSource.snapshotId }).from(teamSource).where(eq(teamSource.teamId, teamId)).orderBy(asc(teamSource.position));
  return rows.map((row) => row.id);
}

async function stored(id: string): Promise<{ slots: TeamSlots; anyPokemon: boolean }> {
  const [row] = await db.select({ slots: team.slots, anyPokemon: team.anyPokemon }).from(team).where(eq(team.id, id));
  return row ?? { slots: [], anyPokemon: false };
}

async function latestSnapshot(userId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: snapshot.id })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.userId, userId), eq(series.state, "running")))
    .orderBy(desc(milestone.position))
    .limit(1);
  return row?.id;
}

async function seriesPool(sources: readonly string[]): Promise<TeamPool> {
  const [first] = sources;
  const [row] = first
    ? await db
        .select({ pool: series.pool })
        .from(snapshot)
        .innerJoin(save, eq(save.id, snapshot.saveId))
        .innerJoin(series, eq(series.id, save.seriesId))
        .where(eq(snapshot.id, first))
    : await db.select({ pool: series.pool }).from(series).where(eq(series.state, "running"));
  return row?.pool ?? DEFAULT_POOL;
}

async function shownSnapshots(reader: Viewer, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await db
    .select({ seriesId: save.seriesId, owner: save.userId, milestoneId: snapshot.milestoneId })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .where(and(inArray(snapshot.id, [...ids]), ne(series.state, "draft")));
  const seen = await savesSeenBy(reader, rows.map((row) => row.seriesId));
  return rows.length === ids.length && rows.every((row) => seen(row.seriesId, row.owner, row.milestoneId));
}

teams.get("/snapshots", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const rows = await db
    .select({
      id: snapshot.id,
      seriesId: series.id,
      milestoneId: snapshot.milestoneId,
      playerId: user.id,
      playerName: user.name,
      seriesNumber: series.number,
      seriesName: series.name,
      milestone: milestone.name,
    })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(user, eq(user.id, save.userId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(ne(series.state, "draft"))
    .orderBy(desc(series.number), asc(user.name), desc(milestone.position));
  const seen = await savesSeenBy(reader, rows.map((row) => row.seriesId));
  const list: TeamSourceRow[] = rows.filter((row) => seen(row.seriesId, row.playerId, row.milestoneId)).map(sourceOf);
  return c.json(list);
});

async function tryTeams(ids: readonly string[]): Promise<Map<string, TeamLeague>> {
  if (ids.length === 0) return new Map();
  const numbered = db
    .select({
      id: leagueTry.id,
      teamId: leagueTry.teamId,
      seriesNumber: series.number,
      loggedAt: leagueTry.loggedAt,
      number: sql<number>`row_number() over (partition by ${leagueTry.seriesId}, ${leagueTry.playerId} order by ${leagueTry.loggedAt}, ${leagueTry.id})`.mapWith(Number).as("try_number"),
    })
    .from(leagueTry)
    .innerJoin(series, eq(series.id, leagueTry.seriesId))
    .as("numbered");
  const rows = await db
    .select()
    .from(numbered)
    .where(and(isNotNull(numbered.teamId), inArray(numbered.teamId, [...ids])))
    .orderBy(asc(numbered.loggedAt), asc(numbered.id));
  return new Map(rows.map((row) => [row.teamId ?? "", { kind: "try", series: row.seriesNumber, number: row.number, at: row.loggedAt.toISOString() }]));
}

async function cupTeams(ids: readonly string[]): Promise<Map<string, TeamLeague>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: team.id,
      ownerId: team.ownerId,
      match: leagueMatch.id,
      slot: leagueMatch.slot,
      a: leagueMatch.playerA,
      b: leagueMatch.playerB,
      series: series.number,
      entrants: sql<number>`(select count(*) from ${cupEntrant} where ${cupEntrant.cupId} = ${cup.id})`.mapWith(Number),
    })
    .from(team)
    .innerJoin(leagueMatch, eq(leagueMatch.id, team.matchId))
    .innerJoin(cup, eq(cup.id, leagueMatch.cupId))
    .innerJoin(series, eq(series.id, cup.seriesId))
    .where(inArray(team.id, [...ids]));
  const names = await namesOf(rows.map((row) => (row.ownerId === row.a ? row.b : row.a)));
  return new Map(
    rows.map((row) => [
      row.id,
      { kind: "cup", series: row.series, match: row.match, slot: row.slot ?? "", entrants: row.entrants, opponent: names.get(row.ownerId === row.a ? row.b : row.a) ?? "?" },
    ]),
  );
}

const roundNumber = sql<number>`(select count(*) from ${milestone} as round_mark where round_mark.series_id = ${milestone.seriesId} and round_mark.mark = 'round' and round_mark.position <= ${milestone.position})`.mapWith(Number);

async function roundTeams(ids: readonly string[], reader: Viewer): Promise<Map<string, TeamLeague>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: team.id, ownerId: team.ownerId, match: leagueMatch.id, a: leagueMatch.playerA, b: leagueMatch.playerB, series: series.number, round: roundNumber, milestone: milestone.name })
    .from(team)
    .innerJoin(leagueMatch, eq(leagueMatch.id, team.matchId))
    .innerJoin(leagueRound, eq(leagueRound.id, leagueMatch.roundId))
    .innerJoin(milestone, eq(milestone.id, leagueRound.milestoneId))
    .innerJoin(series, eq(series.id, leagueRound.seriesId))
    .where(inArray(team.id, [...ids]));
  const names = await namesOf(rows.map((row) => (row.ownerId === row.a ? row.b : row.a)));
  const hidden = await hiddenPairs(reader, rows.map((row) => row.match));
  return new Map(
    rows.map((row) => [
      row.id,
      {
        kind: "round",
        series: row.series,
        match: hidden.has(row.match) ? null : row.match,
        round: row.round,
        milestone: row.milestone,
        opponent: hidden.has(row.match) ? null : (names.get(row.ownerId === row.a ? row.b : row.a) ?? "?"),
      },
    ]),
  );
}

async function namesOf(players: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(players)];
  return new Map(unique.length ? (await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, unique))).map((p) => [p.id, p.name]) : []);
}

async function leaguesOf(ids: readonly string[], reader: Viewer): Promise<Map<string, TeamLeague>> {
  const [tries, cups, rounds] = await Promise.all([tryTeams(ids), cupTeams(ids), roundTeams(ids, reader)]);
  return new Map([...tries, ...cups, ...rounds]);
}

teams.get("/", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const owner = c.req.query("owner");
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      anyPokemon: team.anyPokemon,
      private: team.private,
      slots: team.slots,
      lockedAt: team.lockedAt,
      updatedAt: team.updatedAt,
      ownerId: user.id,
      ownerName: user.name,
    })
    .from(team)
    .innerJoin(user, eq(user.id, team.ownerId))
    .where(and(owner ? eq(team.ownerId, owner) : undefined, await teamsSeenBy(reader)))
    .orderBy(desc(team.updatedAt));
  const ids = rows.map((row) => row.id);
  const sources = ids.length ? await sourcesQuery().where(inArray(teamSource.teamId, ids)).orderBy(asc(teamSource.position)) : [];
  const leagues = await leaguesOf(ids, reader);
  const seen = await savesSeenBy(reader, sources.map((s) => s.seriesId));
  const list: TeamRow[] = rows.map((row) => {
    const held = sources.filter((s) => s.teamId === row.id);
    const own = held.map(sourceOf);
    const league = leagues.get(row.id) ?? null;
    return {
      id: row.id,
      name: row.name,
      owner: { id: row.ownerId, name: row.ownerName },
      series: league ? [league.series] : [...new Set(own.map((s) => s.series.number))].sort((a, b) => a - b),
      league,
      state: teamState(teamKind({ league }), row.lockedAt !== null),
      lockedAt: row.lockedAt?.toISOString() ?? null,
      sources: own,
      sourceHidden: held.some((s) => !seen(s.seriesId, s.playerId, s.milestoneId)),
      anyPokemon: row.anyPokemon,
      private: row.private,
      members: row.slots.map((member) => member?.species ?? null),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
  return c.json(list);
});

teams.get("/waiting", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const rows = await db
    .select({ match: leagueMatch.id, a: leagueMatch.playerA, b: leagueMatch.playerB, series: series.number, round: roundNumber, milestone: milestone.name })
    .from(leagueMatch)
    .innerJoin(leagueRound, eq(leagueRound.id, leagueMatch.roundId))
    .innerJoin(milestone, eq(milestone.id, leagueRound.milestoneId))
    .innerJoin(series, eq(series.id, leagueRound.seriesId))
    .where(
      and(
        isNull(leagueMatch.gamesA),
        or(eq(leagueMatch.playerA, reader.id), eq(leagueMatch.playerB, reader.id)),
        sql`not exists (select 1 from ${team} where ${team.matchId} = ${leagueMatch.id} and ${team.ownerId} = ${reader.id})`,
      ),
    )
    .orderBy(desc(series.number), asc(milestone.position));
  const names = await namesOf(rows.map((row) => (row.a === reader.id ? row.b : row.a)));
  const hidden = await hiddenPairs(reader, rows.map((row) => row.match));
  const list: TeamWait[] = rows.map((row) => ({
    series: row.series,
    match: row.match,
    round: row.round,
    milestone: row.milestone,
    opponent: hidden.has(row.match) ? null : (names.get(row.a === reader.id ? row.b : row.a) ?? "?"),
  }));
  return c.json(list);
});

teams.get("/to-build", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const rows = await db
    .select({ id: team.id })
    .from(team)
    .where(and(eq(team.ownerId, reader.id), isNull(team.lockedAt), isNotNull(team.matchId)));
  const leagues = await leaguesOf(rows.map((row) => row.id), reader);
  const count = rows.filter((row) => teamState(teamKind({ league: leagues.get(row.id) ?? null }), false) === "todo").length;
  return c.json({ count });
});

teams.get("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const [row] = await db
    .select({
      id: team.id,
      name: team.name,
      anyPokemon: team.anyPokemon,
      private: team.private,
      slots: team.slots,
      pool: team.pool,
      freePool: team.freePool,
      lockedAt: team.lockedAt,
      updatedAt: team.updatedAt,
      ownerId: user.id,
      ownerName: user.name,
    })
    .from(team)
    .innerJoin(user, eq(user.id, team.ownerId))
    .where(and(eq(team.id, c.req.param("id")), await teamsSeenBy(reader)));
  if (!row) return c.json({ error: t(c).noTeam }, 404);
  const sources = await db
    .select({
      ...sourceColumns,
      gameId: series.gameId,
      data: snapshot.data,
      missing: snapshot.missing,
      abilitySetas: game.abilitySetas,
      mintPrice: game.mintPrice,
    })
    .from(teamSource)
    .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(user, eq(user.id, save.userId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .leftJoin(game, eq(game.id, series.gameId))
    .where(eq(teamSource.teamId, row.id))
    .orderBy(asc(teamSource.position));
  const seen = await savesSeenBy(reader, sources.map((s) => s.seriesId));
  const league = (await leaguesOf([row.id], reader)).get(row.id) ?? null;
  const mine = reader.id === row.ownerId;
  const locked = row.lockedAt !== null;
  const cut = new Map(sources.filter((s) => !seen(s.seriesId, s.playerId, s.milestoneId)).map((s) => [s.id, membersOf(row.slots, s.id, s.data)] as const));
  const slots = cut.size === 0 ? row.slots : row.slots.map((member) => (member && !isFree(member) && cut.has(member.source) ? renumbered(member, cut.get(member.source)?.at) : member));
  const page: TeamPage = {
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    mine,
    league,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    canEdit: mine && !locked && cut.size === 0,
    canLock: mine && !locked && (league?.kind === "cup" || league?.kind === "round"),
    canUnlock: !!reader.admin && locked,
    canClone: locked && (mine || !!reader.admin),
    sources: sources.map((s) => {
      const shown = seesSpreads(reader, s.playerId);
      const data = cut.get(s.id)?.data ?? s.data;
      return {
        ...sourceOf(s),
        gameId: s.gameId,
        snapshot: shown ? data : withoutSpreads(data),
        missing: s.missing,
        costs: s.abilitySetas === null || s.mintPrice === null ? DEFAULT_COSTS : { abilitySetas: s.abilitySetas, mintPrice: s.mintPrice },
        spreadHidden: !shown,
      };
    }),
    anyPokemon: row.anyPokemon,
    private: row.private,
    slots: seesSpreads(reader, row.ownerId) ? slots : slotsWithoutSpreads(slots),
    pool: row.pool,
    freePool: row.freePool,
    updatedAt: row.updatedAt.toISOString(),
  };
  return c.json(page);
});

function renumbered<M extends { index: number }>(member: M, at: ReadonlyMap<number, number> | undefined): M | null {
  const index = at?.get(member.index);
  return index === undefined ? null : { ...member, index };
}

function membersOf(slots: TeamSlots, source: string, data: Snapshot): { data: Snapshot; at: Map<number, number> } {
  const kept = [...new Set(slots.flatMap((member) => (member && !isFree(member) && member.source === source && data.pokemon[member.index] ? [member.index] : [])))].sort((a, b) => a - b);
  return {
    data: {
      pokemon: kept.flatMap((index) => data.pokemon[index] ?? []),
      items: [],
      tms: [],
      fainted: [],
      bag: [],
      trainer: { name: null, id: null, publicId: null, money: null, badges: [] },
      playTime: null,
      pokedex: { seen: null, owned: null },
      records: { trainerBattlesWon: null, trainerBattlesLost: null, wildBattlesWon: null, wildBattlesLost: null, blackouts: null },
      hallOfFame: null,
      usedEncounters: [],
      saveSlot: null,
      randomlockeVersion: null,
      notices: [],
    },
    at: new Map(kept.map((index, position) => [index, position])),
  };
}

teams.post("/", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  if (reader.admin) return c.json({ error: t(c).adminNoTeams }, 403);
  const input = await body(c.req.raw, newTeamInput);
  if (!input) return c.json({ error: t(c).notTeam }, 400);
  const anyPokemon = input.anyPokemon ?? false;
  const latest = input.sources || anyPokemon ? undefined : await latestSnapshot(reader.id);
  const sources = input.sources ?? (latest ? [latest] : []);
  if (sources.length === 0 && !anyPokemon) return c.json({ error: input.sources ? t(c).needSource : t(c).uploadFirst }, 400);
  if (!(await shownSnapshots(reader, sources))) return c.json({ error: t(c).noSnapshot }, 400);
  const slots = input.slots ?? emptySlots();
  if (!backedBy(slots, sources, anyPokemon)) return c.json({ error: t(c).outsideSources }, 400);
  const names = await db.select({ name: team.name }).from(team).where(eq(team.ownerId, reader.id));
  const pool = input.pool ?? (await seriesPool(sources));
  const id = crypto.randomUUID();
  await db.transaction((tx) => insertTeam(tx, { id, ownerId: reader.id, name: input.name ?? nextTeamName(names.map((n) => n.name), t(c).team), anyPokemon, slots, pool, freePool: input.freePool, sources }));
  return c.json({ id });
});

teams.put("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const id = c.req.param("id");
  const held = await owned(id, reader.id);
  if (!held) return c.json({ error: t(c).ownerChanges }, 403);
  const input = await body(c.req.raw, teamInput);
  if (!input) return c.json({ error: t(c).notTeam }, 400);
  if (held.lockedAt) return c.json({ error: t(c).locked }, 409);
  if (held.matchId && (input.sources !== undefined || input.anyPokemon !== undefined || input.private !== undefined || (input.slots && input.slots.length !== held.slots.length))) {
    return c.json({ error: t(c).leagueSet }, 400);
  }
  const resourcing = input.sources !== undefined || input.anyPokemon !== undefined;
  const now = resourcing || input.slots ? await stored(id) : undefined;
  const sources = input.sources ?? (await sourceIds(id));
  const anyPokemon = input.anyPokemon ?? now?.anyPokemon ?? false;
  if (resourcing && sources.length === 0 && !anyPokemon) return c.json({ error: t(c).needSource }, 400);
  if ((input.sources || input.slots) && !(await shownSnapshots(reader, sources))) return c.json({ error: t(c).noSnapshot }, 400);
  const slots = input.slots ?? (resourcing ? now?.slots : undefined);
  if (slots && !backedBy(slots, sources, anyPokemon)) return c.json({ error: t(c).outsideSources }, 400);
  const written = await db.transaction(async (tx) => {
    const [changed] = await tx
      .update(team)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.slots ? { size: input.slots.length, slots: input.slots } : {}),
        ...(input.anyPokemon !== undefined ? { anyPokemon: input.anyPokemon } : {}),
        ...(input.pool ? { pool: input.pool } : {}),
        ...(input.freePool ? { freePool: input.freePool } : {}),
        ...(input.private !== undefined ? { private: input.private } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(team.id, id), isNull(team.lockedAt)))
      .returning({ id: team.id });
    if (!changed) return false;
    if (input.sources) {
      await tx.delete(teamSource).where(eq(teamSource.teamId, id));
      if (input.sources.length > 0) await tx.insert(teamSource).values(input.sources.map((snapshotId, position) => ({ teamId: id, snapshotId, position })));
    }
    return true;
  });
  if (!written) return c.json({ error: t(c).locked }, 409);
  return c.json({});
});

teams.delete("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const id = c.req.param("id");
  const held = await owned(id, reader.id);
  if (!held) return c.json({ error: t(c).ownerDeletes }, 403);
  if (held.lockedAt) return c.json({ error: t(c).locked }, 409);
  if (held.matchId) return c.json({ error: t(c).leagueKept }, 409);
  await db.delete(team).where(eq(team.id, id));
  return c.json({});
});

teams.post("/:id/lock", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const id = c.req.param("id");
  const held = await owned(id, reader.id);
  if (!held) return c.json({ error: t(c).ownerLocks }, 403);
  if (!held.matchId) return c.json({ error: t(c).notLeague }, 400);
  if (held.lockedAt) return c.json({ error: t(c).locked }, 409);
  const need = lockNeeds(held.cupId ? "cup" : "round", held.slots.length, held.cupId ? null : await livingOn(id));
  if (held.slots.filter((member) => member !== null).length < need) return c.json({ error: t(c).fillFirst(need, held.slots.length) }, 400);
  const [done] = await db
    .update(team)
    .set({ lockedAt: new Date(), lockedBy: reader.id })
    .where(and(eq(team.id, id), isNull(team.lockedAt)))
    .returning({ id: team.id });
  if (!done) return c.json({ error: t(c).locked }, 409);
  return c.json({});
});

teams.post("/:id/clone", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const id = c.req.param("id");
  const [held] = await db
    .select({ name: team.name, ownerId: team.ownerId, anyPokemon: team.anyPokemon, slots: team.slots, pool: team.pool, freePool: team.freePool, lockedAt: team.lockedAt })
    .from(team)
    .where(and(eq(team.id, id), await teamsSeenBy(reader)));
  if (!held) return c.json({ error: t(c).noTeam }, 404);
  if (!reader.admin && held.ownerId !== reader.id) return c.json({ error: t(c).ownerClones }, 403);
  if (!held.lockedAt) return c.json({ error: t(c).notLocked }, 409);
  const sources = await sourceIds(id);
  const made = crypto.randomUUID();
  await db.transaction((tx) =>
    insertTeam(tx, { id: made, ownerId: reader.id, name: copyName(held.name, t(c).copy), anyPokemon: held.anyPokemon, slots: held.slots, pool: held.pool, freePool: held.freePool, sources }),
  );
  return c.json({ id: made });
});

teams.post("/:id/unlock", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const refused = await db.transaction(async (tx) => {
    const [home] = await tx.select({ matchId: team.matchId }).from(team).where(eq(team.id, id));
    if (!home) return "noTeam" as const;
    if (home.matchId) await tx.select({ id: leagueMatch.id }).from(leagueMatch).where(eq(leagueMatch.id, home.matchId)).for("update");
    const [held] = await tx.select({ lockedAt: team.lockedAt }).from(team).where(eq(team.id, id)).for("update");
    if (!held) return "noTeam" as const;
    if (!held.lockedAt) return "notLocked" as const;
    if (home.matchId && (await drafting(tx, home.matchId))) return "drafting" as const;
    await tx.update(team).set({ lockedAt: null, lockedBy: null }).where(eq(team.id, id));
    return null;
  });
  if (refused === "noTeam") return c.json({ error: t(c).noTeam }, 404);
  if (refused) return c.json({ error: t(c)[refused] }, 409);
  return c.json({});
});
