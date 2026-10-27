import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { Hono } from "hono";
import {
  backedBy,
  emptySlots,
  newTeamInput,
  nextTeamName,
  teamInput,
  type TeamPage,
  type TeamRow,
  type TeamSlots,
  type TeamSourceRow,
} from "../../shared/team.js";
import { DEFAULT_COSTS } from "../../shared/games.js";
import { DEFAULT_POOL, type TeamPool } from "../../shared/pool.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { game, milestone, save, series, snapshot, team, teamSource, user } from "./schema.js";
import { viewer } from "./series-data.js";

export const teams = new Hono();

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
  const [row] = await db.select({ id: team.id }).from(team).where(and(eq(team.id, id), eq(team.ownerId, ownerId)));
  return row !== undefined;
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

teams.get("/", async (c) => {
  const owner = c.req.query("owner");
  const rows = await db
    .select({ id: team.id, name: team.name, anyPokemon: team.anyPokemon, slots: team.slots, updatedAt: team.updatedAt, ownerId: user.id, ownerName: user.name })
    .from(team)
    .innerJoin(user, eq(user.id, team.ownerId))
    .where(owner ? eq(team.ownerId, owner) : undefined)
    .orderBy(desc(team.updatedAt));
  const ids = rows.map((row) => row.id);
  const sources = ids.length ? await sourcesQuery().where(inArray(teamSource.teamId, ids)).orderBy(asc(teamSource.position)) : [];
  const list: TeamRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    sources: sources.filter((s) => s.teamId === row.id).map(sourceOf),
    anyPokemon: row.anyPokemon,
    members: row.slots.map((member) => member?.species ?? null),
    updatedAt: row.updatedAt.toISOString(),
  }));
  return c.json(list);
});

teams.get("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const [row] = await db
    .select({ id: team.id, name: team.name, anyPokemon: team.anyPokemon, slots: team.slots, pool: team.pool, updatedAt: team.updatedAt, ownerId: user.id, ownerName: user.name })
    .from(team)
    .innerJoin(user, eq(user.id, team.ownerId))
    .where(eq(team.id, c.req.param("id")));
  if (!row) return c.json({ error: "No such team" }, 404);
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
  const page: TeamPage = {
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    canEdit: reader.id === row.ownerId,
    sources: sources.map((s) => ({
      ...sourceOf(s),
      gameId: s.gameId,
      snapshot: s.data,
      missing: s.missing,
      costs: s.abilitySetas === null || s.mintPrice === null ? DEFAULT_COSTS : { abilitySetas: s.abilitySetas, mintPrice: s.mintPrice },
    })),
    anyPokemon: row.anyPokemon,
    slots: row.slots,
    pool: row.pool,
    updatedAt: row.updatedAt.toISOString(),
  };
  return c.json(page);
});

teams.post("/", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  if (reader.admin) return c.json({ error: "Admins have no teams" }, 403);
  const input = await body(c.req.raw, newTeamInput);
  if (!input) return c.json({ error: "Not a team" }, 400);
  const anyPokemon = input.anyPokemon ?? false;
  const latest = input.sources || anyPokemon ? undefined : await latestSnapshot(reader.id);
  const sources = input.sources ?? (latest ? [latest] : []);
  if (sources.length === 0 && !anyPokemon) return c.json({ error: input.sources ? "A team needs a source" : "Upload a snapshot to the running series first" }, 400);
  if (!(await shownSnapshots(sources))) return c.json({ error: "No such snapshot" }, 400);
  const slots = input.slots ?? emptySlots();
  if (!backedBy(slots, sources, anyPokemon)) return c.json({ error: "A member comes from outside the team's sources" }, 400);
  const names = await db.select({ name: team.name }).from(team).where(eq(team.ownerId, reader.id));
  const pool = input.pool ?? (await seriesPool(sources));
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(team).values({ id, ownerId: reader.id, name: input.name ?? nextTeamName(names.map((n) => n.name)), size: slots.length, anyPokemon, slots, pool });
    if (sources.length > 0) await tx.insert(teamSource).values(sources.map((snapshotId, position) => ({ teamId: id, snapshotId, position })));
  });
  return c.json({ id });
});

teams.put("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const id = c.req.param("id");
  if (!(await owned(id, reader.id))) return c.json({ error: "Only the team's owner changes it" }, 403);
  const input = await body(c.req.raw, teamInput);
  if (!input) return c.json({ error: "Not a team" }, 400);
  const resourcing = input.sources !== undefined || input.anyPokemon !== undefined;
  const now = resourcing || input.slots ? await stored(id) : undefined;
  const sources = input.sources ?? (await sourceIds(id));
  const anyPokemon = input.anyPokemon ?? now?.anyPokemon ?? false;
  if (resourcing && sources.length === 0 && !anyPokemon) return c.json({ error: "A team needs a source" }, 400);
  if (input.sources && !(await shownSnapshots(input.sources))) return c.json({ error: "No such snapshot" }, 400);
  const slots = input.slots ?? (resourcing ? now?.slots : undefined);
  if (slots && !backedBy(slots, sources, anyPokemon)) return c.json({ error: "A member comes from outside the team's sources" }, 400);
  await db.transaction(async (tx) => {
    await tx
      .update(team)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.slots ? { size: input.slots.length, slots: input.slots } : {}),
        ...(input.anyPokemon !== undefined ? { anyPokemon: input.anyPokemon } : {}),
        ...(input.pool ? { pool: input.pool } : {}),
        updatedAt: new Date(),
      })
      .where(eq(team.id, id));
    if (input.sources) {
      await tx.delete(teamSource).where(eq(teamSource.teamId, id));
      if (input.sources.length > 0) await tx.insert(teamSource).values(input.sources.map((snapshotId, position) => ({ teamId: id, snapshotId, position })));
    }
  });
  return c.json({});
});

teams.delete("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const id = c.req.param("id");
  if (!(await owned(id, reader.id))) return c.json({ error: "Only the team's owner deletes it" }, 403);
  await db.delete(team).where(eq(team.id, id));
  return c.json({});
});
