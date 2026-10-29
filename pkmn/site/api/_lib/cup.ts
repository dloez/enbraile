import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { CUP_TEAM_SIZE, type CupMatch, cupDraw, type CupProblem, cupProblem, type LeagueMode } from "../../shared/league.js";
import { emptySlots } from "../../shared/team.js";
import { db } from "./db.js";
import { cup, cupEntrant, leagueGame, leagueMatch, milestone, save, series, snapshot, team, teamSource, user } from "./schema.js";
import { insertTeam } from "./teams.js";

export type CupRefusal = "started" | CupProblem;

export type CupMove = { done: true } | { done: false; refused: CupRefusal };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class CupConflict extends Error {}

export async function cupState(tx: Tx | typeof db, cupId: string) {
  const entrants = await tx.select({ player: cupEntrant.playerId }).from(cupEntrant).where(eq(cupEntrant.cupId, cupId)).orderBy(asc(cupEntrant.seed));
  const rows = await tx.select().from(leagueMatch).where(eq(leagueMatch.cupId, cupId)).orderBy(asc(leagueMatch.position));
  const seeds = entrants.map((e) => e.player);
  const played = new Map<string, CupMatch>(
    rows.map((row) => [row.slot!, { a: row.playerA, b: row.playerB, gamesA: row.gamesA, gamesB: row.gamesB, faintedA: row.faintedA, faintedB: row.faintedB }]),
  );
  return { seeds, rows, draw: cupDraw(seeds, played) };
}

export async function settleCup(tx: Tx, cupId: string): Promise<void> {
  const { rows, draw } = await cupState(tx, cupId);
  const ids = rows.map((row) => row.id);
  const withGames = new Set(ids.length ? (await tx.selectDistinct({ matchId: leagueGame.matchId }).from(leagueGame).where(inArray(leagueGame.matchId, ids))).map((g) => g.matchId) : []);
  const busy = (row: (typeof rows)[number]) => row.gamesA !== null || withGames.has(row.id);
  for (const [position, slot] of draw.slots.entries()) {
    const row = rows.find((r) => r.slot === slot.key);
    if (slot.a && slot.b) {
      if (!row) {
        await tx.insert(leagueMatch).values({ id: crypto.randomUUID(), cupId, slot: slot.key, position, playerA: slot.a, playerB: slot.b });
      } else if (row.playerA !== slot.a || row.playerB !== slot.b) {
        if (busy(row)) throw new CupConflict();
        await tx.update(leagueMatch).set({ playerA: slot.a, playerB: slot.b }).where(eq(leagueMatch.id, row.id));
      }
    } else if (row) {
      if (busy(row)) throw new CupConflict();
      await tx.delete(leagueMatch).where(eq(leagueMatch.id, row.id));
    }
  }
  const [home] = await tx.select({ seriesId: cup.seriesId }).from(cup).where(eq(cup.id, cupId));
  if (home) await giveCupTeams(tx, home.seriesId);
}

export async function tournamentSheets(tx: Tx | typeof db, seriesId: string): Promise<Map<string, string>> {
  const [at] = await tx
    .select({ id: milestone.id })
    .from(milestone)
    .where(and(eq(milestone.seriesId, seriesId), eq(milestone.mark, "tournament")))
    .orderBy(desc(milestone.position))
    .limit(1);
  if (!at) return new Map();
  const rows = await tx
    .select({ player: save.userId, id: snapshot.id })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .where(and(eq(save.seriesId, seriesId), eq(snapshot.milestoneId, at.id)));
  return new Map(rows.map((row) => [row.player, row.id]));
}

export async function giveCupTeams(tx: Tx, seriesId: string): Promise<void> {
  const [held] = await tx.select({ id: cup.id }).from(cup).where(eq(cup.seriesId, seriesId)).for("update");
  if (!held) return;
  const matches = await tx.select({ id: leagueMatch.id, a: leagueMatch.playerA, b: leagueMatch.playerB }).from(leagueMatch).where(eq(leagueMatch.cupId, held.id));
  const made = matches.length
    ? await tx
        .select({
          id: team.id,
          matchId: team.matchId,
          ownerId: team.ownerId,
          sources: sql<number>`(select count(*) from ${teamSource} where ${teamSource.teamId} = ${team.id})`.mapWith(Number),
        })
        .from(team)
        .where(inArray(team.matchId, matches.map((m) => m.id)))
    : [];
  const stale = made.filter((one) => !matches.some((m) => m.id === one.matchId && (m.a === one.ownerId || m.b === one.ownerId)));
  if (stale.length > 0) await tx.delete(team).where(inArray(team.id, stale.map((one) => one.id)));
  const sheets = await tournamentSheets(tx, seriesId);
  if (sheets.size === 0) return;
  const [row] = await tx.select({ pool: series.pool }).from(series).where(eq(series.id, seriesId));
  const players = [...new Set(matches.flatMap((m) => [m.a, m.b]))];
  const names = new Map(players.length ? (await tx.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, players))).map((p) => [p.id, p.name]) : []);
  for (const match of matches) {
    for (const [owner, other] of [
      [match.a, match.b],
      [match.b, match.a],
    ] as const) {
      const sheet = sheets.get(owner);
      if (!sheet) continue;
      const have = made.find((one) => one.matchId === match.id && one.ownerId === owner);
      if (have) {
        if (have.sources === 0) await tx.insert(teamSource).values({ teamId: have.id, snapshotId: sheet, position: 0 });
        continue;
      }
      await insertTeam(tx, {
        id: crypto.randomUUID(),
        ownerId: owner,
        name: `Cup v ${names.get(other) ?? "?"}`,
        anyPokemon: false,
        slots: emptySlots(CUP_TEAM_SIZE),
        pool: row!.pool,
        sources: [sheet],
        matchId: match.id,
      });
    }
  }
}

export async function lockCup(tx: Tx, cupId: string): Promise<void> {
  await tx.select({ id: cup.id }).from(cup).where(eq(cup.id, cupId)).for("update");
}

export function startCup(seriesId: string, standings: readonly string[], entrants: readonly string[], mode: LeagueMode, by: string | null): Promise<CupMove> {
  return db.transaction(async (tx) => {
    await tx.select({ id: series.id }).from(series).where(eq(series.id, seriesId)).for("update");
    const [held] = await tx.select({ id: cup.id }).from(cup).where(eq(cup.seriesId, seriesId));
    if (held) return { done: false, refused: "started" };
    const problem = cupProblem(standings, entrants);
    if (problem) return { done: false, refused: problem };
    const seeds = standings.filter((player) => entrants.includes(player));
    const id = crypto.randomUUID();
    await tx.insert(cup).values({ id, seriesId, mode, startedBy: by });
    await tx.insert(cupEntrant).values(seeds.map((playerId, at) => ({ cupId: id, playerId, seed: at + 1 })));
    await settleCup(tx, id);
    return { done: true };
  });
}
