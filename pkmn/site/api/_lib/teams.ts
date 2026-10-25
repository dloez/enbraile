import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { Hono } from "hono";
import {
  emptySlots,
  newTeamInput,
  nextTeamName,
  teamInput,
  type TeamPage,
  type TeamRow,
  type TeamSlots,
  type TeamSourceRow,
} from "../../shared/team.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { milestone, save, series, snapshot, team, teamSource, user } from "./schema.js";
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

type SourceRow = Awaited<ReturnType<typeof sourcesQuery>>[number];

function sourceOf(row: SourceRow): TeamSourceRow {
  return {
    id: row.id,
    player: { id: row.playerId, name: row.playerName },
    series: { number: row.seriesNumber, name: row.seriesName },
    milestone: row.milestone,
  };
}

function backed(slots: TeamSlots, sources: readonly string[]): boolean {
  return slots.every((member) => member === null || sources.includes(member.source));
}

async function owned(id: string, ownerId: string) {
  const [row] = await db.select({ id: team.id }).from(team).where(and(eq(team.id, id), eq(team.ownerId, ownerId)));
  return row !== undefined;
}

async function sourceIds(teamId: string): Promise<string[]> {
  const rows = await db.select({ id: teamSource.snapshotId }).from(teamSource).where(eq(teamSource.teamId, teamId)).orderBy(asc(teamSource.position));
  return rows.map((row) => row.id);
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

async function ownSnapshot(snapshotId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: snapshot.id })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .where(and(eq(snapshot.id, snapshotId), eq(save.userId, userId), ne(series.state, "draft")));
  return row !== undefined;
}

teams.get("/", async (c) => {
  const owner = c.req.query("owner");
  const rows = await db
    .select({ id: team.id, name: team.name, slots: team.slots, updatedAt: team.updatedAt, ownerId: user.id, ownerName: user.name })
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
    members: row.slots.map((member) => member?.species ?? null),
    updatedAt: row.updatedAt.toISOString(),
  }));
  return c.json(list);
});

teams.get("/:id", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const [row] = await db
    .select({ id: team.id, name: team.name, slots: team.slots, updatedAt: team.updatedAt, ownerId: user.id, ownerName: user.name })
    .from(team)
    .innerJoin(user, eq(user.id, team.ownerId))
    .where(eq(team.id, c.req.param("id")));
  if (!row) return c.json({ error: "No such team" }, 404);
  const sources = await db
    .select({ ...sourceColumns, data: snapshot.data, missing: snapshot.missing })
    .from(teamSource)
    .innerJoin(snapshot, eq(snapshot.id, teamSource.snapshotId))
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(user, eq(user.id, save.userId))
    .innerJoin(series, eq(series.id, save.seriesId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(eq(teamSource.teamId, row.id))
    .orderBy(asc(teamSource.position));
  const page: TeamPage = {
    id: row.id,
    name: row.name,
    owner: { id: row.ownerId, name: row.ownerName },
    canEdit: reader.id === row.ownerId,
    sources: sources.map((s) => ({ ...sourceOf(s), snapshot: s.data, missing: s.missing })),
    slots: row.slots,
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
  const source = input.snapshot ?? (await latestSnapshot(reader.id));
  if (!source) return c.json({ error: "Upload a snapshot to the running series first" }, 400);
  if (!(await ownSnapshot(source, reader.id))) return c.json({ error: "Build only from your own snapshots" }, 403);
  const slots = input.slots ?? emptySlots();
  if (!backed(slots, [source])) return c.json({ error: "A member comes from outside the team's snapshot" }, 400);
  const names = await db.select({ name: team.name }).from(team).where(eq(team.ownerId, reader.id));
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(team).values({ id, ownerId: reader.id, name: input.name ?? nextTeamName(names.map((n) => n.name)), size: slots.length, slots });
    await tx.insert(teamSource).values({ teamId: id, snapshotId: source, position: 0 });
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
  if (input.slots && !backed(input.slots, await sourceIds(id))) return c.json({ error: "A member comes from outside the team's snapshot" }, 400);
  await db
    .update(team)
    .set({ ...(input.name ? { name: input.name } : {}), ...(input.slots ? { size: input.slots.length, slots: input.slots } : {}), updatedAt: new Date() })
    .where(eq(team.id, id));
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
