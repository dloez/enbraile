import { and, asc, eq, ne } from "drizzle-orm";
import { type AdminSeries, startChecklist } from "../../shared/series.js";
import { db } from "./db.js";
import { game, milestone, series, seriesPlayer, user } from "./schema.js";

export type SeriesRow = typeof series.$inferSelect;

export async function milestonesOf(seriesId: string) {
  return db
    .select({ name: milestone.name, mark: milestone.mark })
    .from(milestone)
    .where(eq(milestone.seriesId, seriesId))
    .orderBy(asc(milestone.position));
}

export async function trainersOf(seriesId: string) {
  return db
    .select({ id: user.id, name: user.name })
    .from(seriesPlayer)
    .innerJoin(user, eq(user.id, seriesPlayer.userId))
    .where(eq(seriesPlayer.seriesId, seriesId))
    .orderBy(asc(user.name));
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

export async function adminView(row: SeriesRow): Promise<AdminSeries> {
  const players = await db.select({ id: seriesPlayer.userId }).from(seriesPlayer).where(eq(seriesPlayer.seriesId, row.id));
  const milestones = await milestonesOf(row.id);
  const chosen = await gameOf(row);
  const running = await otherRunning(row);
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    gameId: row.gameId,
    scene: row.scene,
    ingestion: row.ingestion,
    rules: row.rules,
    state: row.state,
    playerIds: players.map((p) => p.id),
    milestones,
    checklist:
      row.state === "draft"
        ? startChecklist({ rules: row.rules, gameHasFile: chosen?.fileKey != null, players: players.length, milestones: milestones.length, otherRunning: running })
        : [],
    otherRunning: running,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
