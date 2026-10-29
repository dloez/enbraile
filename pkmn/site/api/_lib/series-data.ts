import { and, asc, count, eq, inArray, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import { alias, type AnyPgTable } from "drizzle-orm/pg-core";
import { type AdminSeries, CHECKLIST_TEXT, startChecklist } from "../../shared/series.js";
import { auth } from "./auth.js";
import { db } from "./db.js";
import { cup, game, leagueMatch, leagueRound, milestone, save, series, seriesPlayer, snapshot, team, user } from "./schema.js";

export type SeriesRow = typeof series.$inferSelect;

export type Viewer = { id: string; admin?: boolean | null };

const aliased = <T extends AnyPgTable>(table: T, name: string) => ({ as: sql`${table} ${sql.identifier(name)}`, columns: alias(table, name) });

const shownMatch = aliased(leagueMatch, "shown_match");
const shownCup = aliased(cup, "shown_cup");
const shownRound = aliased(leagueRound, "shown_round");
const fellowMatch = aliased(leagueMatch, "fellow_match");
const lockedTeam = aliased(team, "locked_team");

function lockedOn(match: typeof shownMatch.columns): SQL {
  const locked = lockedTeam.columns;
  return sql`(select count(*) from ${lockedTeam.as} where ${locked.matchId} = ${match.id} and ${locked.lockedAt} is not null)`;
}

function revealed(): SQL {
  const [m, c, r, f] = [shownMatch.columns, shownCup.columns, shownRound.columns, fellowMatch.columns];
  return sql`exists (select 1 from ${shownMatch.as}
    left join ${shownCup.as} on ${c.id} = ${m.cupId}
    left join ${shownRound.as} on ${r.id} = ${m.roundId}
    where ${m.id} = ${team.matchId} and (
      ${m.gamesA} is not null
      or (${r.mode} = 'open' and ${lockedOn(m)} = 2)
      or (${c.mode} = 'open' and not exists (select 1 from ${fellowMatch.as}
        where ${f.cupId} = ${m.cupId} and ${f.createdAt} <= ${m.createdAt} and ${f.gamesA} is null and ${lockedOn(f)} < 2))))`;
}

export function teamsSeenBy(reader: Viewer): SQL | undefined {
  return reader.admin ? undefined : or(eq(team.ownerId, reader.id), and(isNull(team.matchId), eq(team.private, false)), revealed());
}

export async function viewer(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user;
}

export async function findShown(param: string, admin: boolean): Promise<SeriesRow | undefined> {
  const number = Number(param);
  if (!Number.isInteger(number)) return undefined;
  const [row] = await db.select().from(series).where(eq(series.number, number));
  if (!row || (row.state === "draft" && !admin)) return undefined;
  return row;
}

export function mayUpload(reader: Viewer, row: SeriesRow, playerId: string): boolean {
  if (row.state === "draft") return false;
  if (reader.admin) return true;
  return reader.id === playerId && row.ingestion === "manual" && row.state === "running";
}

export async function milestonesOf(seriesId: string) {
  return db
    .select({ id: milestone.id, name: milestone.name, mark: milestone.mark })
    .from(milestone)
    .where(eq(milestone.seriesId, seriesId))
    .orderBy(asc(milestone.position));
}

export async function trainersOf(seriesId: string, reader: Viewer) {
  const players = await db
    .select({ id: user.id, name: user.name })
    .from(seriesPlayer)
    .innerJoin(user, eq(user.id, seriesPlayer.userId))
    .where(eq(seriesPlayer.seriesId, seriesId))
    .orderBy(asc(user.name));
  const saves = await db
    .select({ userId: save.userId, progress: milestone.name, progressSetBy: save.progressSetBy, progressSetAt: save.progressSetAt })
    .from(save)
    .leftJoin(milestone, eq(milestone.id, save.progressId))
    .where(eq(save.seriesId, seriesId));
  const taken = await db
    .select({
      userId: save.userId,
      milestone: milestone.name,
      pokemon: snapshot.pokemon,
      fainted: snapshot.fainted,
      faintedSet: snapshot.faintedSet,
      faintedSetBy: snapshot.faintedSetBy,
      faintedSetAt: snapshot.faintedSetAt,
      movedBy: snapshot.movedBy,
      movedAt: snapshot.movedAt,
      playTime: sql<number | null>`(${snapshot.data}->>'playTime')::float8`,
      rolledKey: snapshot.rolledKey,
      missing: snapshot.missing,
    })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(eq(save.seriesId, seriesId))
    .orderBy(asc(milestone.position));
  const teamCounts = players.length
    ? await db
        .select({ ownerId: team.ownerId, teams: count() })
        .from(team)
        .where(and(inArray(team.ownerId, players.map((p) => p.id)), teamsSeenBy(reader)))
        .groupBy(team.ownerId)
    : [];
  const names = reader.admin
    ? await namesOf([...saves.map((s) => s.progressSetBy), ...taken.flatMap((t) => [t.faintedSetBy, t.movedBy])])
    : new Map<string, string>();
  const byHand = (by: string | null, at: Date | null) => (by && at ? { by: names.get(by) ?? by, at: at.toISOString() } : null);
  return players.map((player) => {
    const own = saves.find((s) => s.userId === player.id);
    const snapshots = taken
      .filter((row) => row.userId === player.id)
      .map((row) => ({
        milestone: row.milestone,
        pokemon: row.pokemon,
        fainted: row.faintedSet ?? row.fainted,
        playTime: row.playTime,
        zip: row.rolledKey !== null && (!!reader.admin || reader.id === player.id),
        missing: row.missing,
        ...(reader.admin
          ? { sources: { savedFainted: row.fainted, fainted: row.faintedSet === null ? null : byHand(row.faintedSetBy, row.faintedSetAt), moved: byHand(row.movedBy, row.movedAt) } }
          : {}),
      }));
    const handProgress = own?.progress ?? null;
    return {
      ...player,
      progress: handProgress ?? snapshots.at(-1)?.milestone ?? null,
      teams: teamCounts.find((t) => t.ownerId === player.id)?.teams ?? 0,
      snapshots,
      ...(reader.admin ? { sources: { progress: handProgress === null ? null : byHand(own?.progressSetBy ?? null, own?.progressSetAt ?? null) } } : {}),
    };
  });
}

async function namesOf(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) return new Map();
  const rows = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, wanted));
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function plays(seriesId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: seriesPlayer.userId })
    .from(seriesPlayer)
    .where(and(eq(seriesPlayer.seriesId, seriesId), eq(seriesPlayer.userId, userId)));
  return row !== undefined;
}

export async function gameOf(row: SeriesRow) {
  if (!row.gameId) return undefined;
  const [found] = await db.select().from(game).where(eq(game.id, row.gameId));
  return found;
}

async function otherRunning(row: SeriesRow): Promise<string | null> {
  const [running] = await db
    .select({ name: series.name })
    .from(series)
    .where(and(eq(series.state, "running"), ne(series.id, row.id)));
  return running?.name ?? null;
}

export async function adminView(row: SeriesRow, text: (typeof CHECKLIST_TEXT)["en"] = CHECKLIST_TEXT.en): Promise<AdminSeries> {
  const players = await db.select({ id: seriesPlayer.userId }).from(seriesPlayer).where(eq(seriesPlayer.seriesId, row.id));
  const milestones = await milestonesOf(row.id);
  const chosen = await gameOf(row);
  const running = await otherRunning(row);
  const [taken] = await db.select({ snapshots: count() }).from(snapshot).innerJoin(save, eq(save.id, snapshot.saveId)).where(eq(save.seriesId, row.id));
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    gameId: row.gameId,
    scene: row.scene,
    ingestion: row.ingestion,
    rules: row.rules,
    rulesEs: row.rulesEs,
    pool: row.pool,
    state: row.state,
    playerIds: players.map((p) => p.id),
    milestones,
    snapshots: taken?.snapshots ?? 0,
    checklist:
      row.state === "draft"
        ? startChecklist({ rules: row.rules, rulesEs: row.rulesEs, gameHasFile: chosen?.fileKey != null, milestones: milestones.length, otherRunning: running }, text)
        : [],
    otherRunning: running,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
