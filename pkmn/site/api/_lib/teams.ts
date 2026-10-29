import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { CUP_TEAM_SIZE } from "../../shared/league.js";
import {
  backedBy,
  emptySlots,
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
} from "../../shared/team.js";
import { DEFAULT_COSTS } from "../../shared/games.js";
import { DEFAULT_POOL, type FreePool, type TeamPool } from "../../shared/pool.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { requireAdmin } from "./admin.js";
import { cup, cupEntrant, game, leagueMatch, leagueTry, milestone, save, series, snapshot, team, teamSource, user } from "./schema.js";
import { teamsSeenBy, viewer } from "./series-data.js";
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
    leagueSet: "A cup team's sources, size and visibility are set by its match",
    leagueKept: "A cup team stays with its match",
    ownerLocks: "Only the team's owner locks it in",
    notLeague: "Only a league team is locked in",
    fillFirst: (size: number) => `Fill all ${size} slots before locking in`,
    ownerClones: "Only the team's owner or an admin clones it",
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
    leagueSet: "Las fuentes, el tamaño y la visibilidad de un equipo de copa los fija su enfrentamiento",
    leagueKept: "Un equipo de copa se queda con su enfrentamiento",
    ownerLocks: "Solo el dueño del equipo puede bloquearlo",
    notLeague: "Solo se bloquea un equipo de liga",
    fillFirst: (size: number) => `Llena los ${size} huecos antes de bloquearlo`,
    ownerClones: "Solo el dueño del equipo o un administrador lo clona",
    copy: "(copia)",
  },
});

export const teams = new Hono();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewTeam = { id: string; ownerId: string; name: string; anyPokemon: boolean; slots: TeamSlots; pool: TeamPool; freePool?: FreePool; sources: readonly string[]; matchId?: string; locked?: { at: Date; by: string | null } };

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
    matchId: made.matchId ?? null,
    lockedAt: made.locked?.at ?? null,
    lockedBy: made.locked?.by ?? null,
  });
  if (made.sources.length > 0) await tx.insert(teamSource).values(made.sources.map((snapshotId, position) => ({ teamId: made.id, snapshotId, position })));
}

const sourceColumns = {
  teamId: teamSource.teamId,
  id: snapshot.id,
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
  const [row] = await db.select({ matchId: team.matchId, lockedAt: team.lockedAt, slots: team.slots }).from(team).where(and(eq(team.id, id), eq(team.ownerId, ownerId)));
  return row;
}

export async function lockTeam(tx: Tx, id: string, by: string) {
  await tx
    .update(team)
    .set({ lockedAt: new Date(), lockedBy: by })
    .where(and(eq(team.id, id), isNull(team.lockedAt)));
}

function copyName(name: string, suffix: string): string {
  return `${name.slice(0, TEAM_NAME_MAX - suffix.length - 1).trimEnd()} ${suffix}`;
}

async function sourceIds(teamId: string): Promise<string[]> {
  const rows = await db.select({ id: teamSource.snapshotId }).from(teamSource).where(eq(teamSource.teamId, teamId)).orderBy(asc(teamSource.position));
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

async function shownSnapshots(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await db
    .select({ id: snapshot.id })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .where(and(inArray(snapshot.id, [...ids]), ne(series.state, "draft")));
  return rows.length === ids.length;
}

teams.get("/snapshots", async (c) => {
  const rows = await db
    .select({ id: snapshot.id, playerId: user.id, playerName: user.name, seriesNumber: series.number, seriesName: series.name, milestone: milestone.name })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(user, eq(user.id, save.userId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(ne(series.state, "draft"))
    .orderBy(desc(series.number), asc(user.name), desc(milestone.position));
  const list: TeamSourceRow[] = rows.map(sourceOf);
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
  const others = [...new Set(rows.map((row) => (row.ownerId === row.a ? row.b : row.a)))];
  const names = new Map(others.length ? (await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, others))).map((p) => [p.id, p.name]) : []);
  return new Map(
    rows.map((row) => [
      row.id,
      { kind: "cup", series: row.series, match: row.match, slot: row.slot ?? "", entrants: row.entrants, opponent: names.get(row.ownerId === row.a ? row.b : row.a) ?? "?" },
    ]),
  );
}

async function leaguesOf(ids: readonly string[]): Promise<Map<string, TeamLeague>> {
  const [tries, cups] = await Promise.all([tryTeams(ids), cupTeams(ids)]);
  return new Map([...tries, ...cups]);
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
    .where(and(owner ? eq(team.ownerId, owner) : undefined, teamsSeenBy(reader)))
    .orderBy(desc(team.updatedAt));
  const ids = rows.map((row) => row.id);
  const sources = ids.length ? await sourcesQuery().where(inArray(teamSource.teamId, ids)).orderBy(asc(teamSource.position)) : [];
  const leagues = await leaguesOf(ids);
  const list: TeamRow[] = rows.map((row) => {
    const own = sources.filter((s) => s.teamId === row.id).map(sourceOf);
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
      anyPokemon: row.anyPokemon,
      private: row.private,
      members: row.slots.map((member) => member?.species ?? null),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
  return c.json(list);
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
    .where(and(eq(team.id, c.req.param("id")), teamsSeenBy(reader)));
  if (!row) return c.json({ error: t(c).noTeam }, 404);
  const sources = await db
    .select({ ...sourceColumns, gameId: series.gameId, data: snapshot.data, missing: snapshot.missing, abilitySetas: game.abilitySetas, mintPrice: game.mintPrice })
    .from(teamSource)
    .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(user, eq(user.id, save.userId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .leftJoin(game, eq(game.id, series.gameId))
    .where(eq(teamSource.teamId, row.id))
    .orderBy(asc(teamSource.position));
  const league = (await leaguesOf([row.id])).get(row.id) ?? null;
  const mine = reader.id === row.ownerId;
  const locked = row.lockedAt !== null;
  const page: TeamPage = {
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    mine,
    league,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    canEdit: mine && !locked,
    canLock: mine && !locked && league?.kind === "cup",
    canUnlock: !!reader.admin && locked,
    canClone: locked && (mine || !!reader.admin),
    sources: sources.map((s) => {
      const shown = seesSpreads(reader, s.playerId);
      return {
        ...sourceOf(s),
        gameId: s.gameId,
        snapshot: shown ? s.data : withoutSpreads(s.data),
        missing: s.missing,
        costs: s.abilitySetas === null || s.mintPrice === null ? DEFAULT_COSTS : { abilitySetas: s.abilitySetas, mintPrice: s.mintPrice },
        spreadHidden: !shown,
      };
    }),
    anyPokemon: row.anyPokemon,
    private: row.private,
    slots: seesSpreads(reader, row.ownerId) ? row.slots : slotsWithoutSpreads(row.slots),
    pool: row.pool,
    freePool: row.freePool,
    updatedAt: row.updatedAt.toISOString(),
  };
  return c.json(page);
});

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
  if (!(await shownSnapshots(sources))) return c.json({ error: t(c).noSnapshot }, 400);
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
  if (held.lockedAt) {
    const onlySeen = !held.matchId && input.private !== undefined && Object.keys(input).every((key) => key === "private");
    if (!onlySeen) return c.json({ error: t(c).locked }, 409);
    await db.update(team).set({ private: input.private, updatedAt: new Date() }).where(eq(team.id, id));
    return c.json({});
  }
  if (held.matchId && (input.sources !== undefined || input.anyPokemon !== undefined || input.private !== undefined || (input.slots && input.slots.length !== CUP_TEAM_SIZE))) {
    return c.json({ error: t(c).leagueSet }, 400);
  }
  const resourcing = input.sources !== undefined || input.anyPokemon !== undefined;
  const now = resourcing || input.slots ? await stored(id) : undefined;
  const sources = input.sources ?? (await sourceIds(id));
  const anyPokemon = input.anyPokemon ?? now?.anyPokemon ?? false;
  if (resourcing && sources.length === 0 && !anyPokemon) return c.json({ error: t(c).needSource }, 400);
  if (input.sources && !(await shownSnapshots(input.sources))) return c.json({ error: t(c).noSnapshot }, 400);
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
  if (held.slots.some((member) => member === null)) return c.json({ error: t(c).fillFirst(held.slots.length) }, 400);
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
    .where(and(eq(team.id, id), teamsSeenBy(reader)));
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
  const [held] = await db.select({ lockedAt: team.lockedAt }).from(team).where(eq(team.id, id));
  if (!held) return c.json({ error: t(c).noTeam }, 404);
  if (!held.lockedAt) return c.json({ error: t(c).notLocked }, 409);
  await db.update(team).set({ lockedAt: null, lockedBy: null }).where(eq(team.id, id));
  return c.json({});
});
