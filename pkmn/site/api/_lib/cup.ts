import { asc, eq, inArray } from "drizzle-orm";
import { type CupMatch, cupDraw, type CupProblem, cupProblem } from "../../shared/league.js";
import { db } from "./db.js";
import { cup, cupEntrant, leagueGame, leagueMatch, series } from "./schema.js";

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
}

export async function lockCup(tx: Tx, cupId: string): Promise<void> {
  await tx.select({ id: cup.id }).from(cup).where(eq(cup.id, cupId)).for("update");
}

export function startCup(seriesId: string, standings: readonly string[], entrants: readonly string[], by: string | null): Promise<CupMove> {
  return db.transaction(async (tx) => {
    await tx.select({ id: series.id }).from(series).where(eq(series.id, seriesId)).for("update");
    const [held] = await tx.select({ id: cup.id }).from(cup).where(eq(cup.seriesId, seriesId));
    if (held) return { done: false, refused: "started" };
    const problem = cupProblem(standings, entrants);
    if (problem) return { done: false, refused: problem };
    const seeds = standings.filter((player) => entrants.includes(player));
    const id = crypto.randomUUID();
    await tx.insert(cup).values({ id, seriesId, startedBy: by });
    await tx.insert(cupEntrant).values(seeds.map((playerId, at) => ({ cupId: id, playerId, seed: at + 1 })));
    await settleCup(tx, id);
    return { done: true };
  });
}
