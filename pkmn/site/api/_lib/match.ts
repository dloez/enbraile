import { asc, eq } from "drizzle-orm";
import { covers, decided, fits, type GameInput, gamesProblem, nextGame, tally } from "../../shared/league.js";
import { CupConflict, lockCup, settleCup } from "./cup.js";
import { db } from "./db.js";
import { leagueGame, leagueMatch } from "./schema.js";

export type Refusal = "noMatch" | "winner" | "order" | "closed" | "noGame" | "past" | "score" | "later";

export type Move = { done: true } | { done: false; refused: Refusal };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type MatchRow = typeof leagueMatch.$inferSelect;

type GameRow = Pick<typeof leagueGame.$inferSelect, "number" | "winnerId" | "faintedA" | "faintedB">;

const played = (g: GameRow) => ({ number: g.number, winner: g.winnerId, faintedA: g.faintedA, faintedB: g.faintedB });

function refusalOf(match: Pick<MatchRow, "playerA" | "playerB" | "gamesA" | "gamesB">, games: GameRow[]): Refusal | null {
  const sides = { a: match.playerA, b: match.playerB };
  const problem = gamesProblem(sides, games.map(played));
  if (problem) return problem;
  return fits({ ...sides, gamesA: match.gamesA, gamesB: match.gamesB }, games.map(played)) ? null : "score";
}

async function move(matchId: string, input: GameInput, by: string | null, place: (match: MatchRow, games: GameRow[]) => number | Refusal): Promise<Move> {
  return db.transaction(async (tx): Promise<Move> => {
    const [home] = await tx.select({ cupId: leagueMatch.cupId }).from(leagueMatch).where(eq(leagueMatch.id, matchId));
    if (home?.cupId) await lockCup(tx, home.cupId);
    const [match] = await tx.select().from(leagueMatch).where(eq(leagueMatch.id, matchId)).for("update");
    if (!match) return { done: false, refused: "noMatch" };
    if (input.winner !== match.playerA && input.winner !== match.playerB) return { done: false, refused: "winner" };
    const games = await tx.select().from(leagueGame).where(eq(leagueGame.matchId, matchId)).orderBy(asc(leagueGame.number));
    const number = place(match, games);
    if (typeof number !== "number") return { done: false, refused: number };
    const written = { winnerId: input.winner, faintedA: input.faintedA, faintedB: input.faintedB, replay: input.replay, recordedBy: by, recordedAt: new Date() };
    const after = [...games.filter((g) => g.number !== number), { number, ...written }];
    const sides = { a: match.playerA, b: match.playerB };
    const whole = covers({ ...sides, gamesA: match.gamesA, gamesB: match.gamesB }, games.map(played));
    const refused = refusalOf(whole ? { ...match, gamesA: null, gamesB: null } : match, after);
    if (refused) return { done: false, refused };
    const held = games.find((g) => g.number === number);
    if (held) await tx.update(leagueGame).set(written).where(eq(leagueGame.id, held.id));
    else await tx.insert(leagueGame).values({ id: crypto.randomUUID(), matchId, number, ...written });
    if (whole) {
      const sum = tally(sides, after.map(played));
      const result = decided(sum.gamesA, sum.gamesB) ? sum : { gamesA: null, gamesB: null, faintedA: null, faintedB: null };
      await tx.update(leagueMatch).set(result).where(eq(leagueMatch.id, matchId));
    }
    if (match.cupId) await settleCup(tx, match.cupId);
    return { done: true };
  }).catch(cupRefusal);
}

function cupRefusal(error: unknown): Move {
  if (error instanceof CupConflict) return { done: false, refused: "later" };
  throw error;
}

export function recordGame(matchId: string, input: GameInput, by: string | null): Promise<Move> {
  return move(matchId, input, by, (match, games) => nextGame({ a: match.playerA, b: match.playerB, gamesA: match.gamesA, gamesB: match.gamesB }, games.map(played)) ?? "closed");
}

export function fixGame(matchId: string, number: number, input: GameInput, by: string | null): Promise<Move> {
  return move(matchId, input, by, (_, games) => (games.some((g) => g.number === number) ? number : "noGame"));
}

export async function importMatch(tx: Tx, match: typeof leagueMatch.$inferInsert, games: (typeof leagueGame.$inferInsert)[]): Promise<Move> {
  const row = { gamesA: null, gamesB: null, faintedA: null, faintedB: null, ...match };
  if (games.some((g) => g.matchId !== row.id)) return { done: false, refused: "noMatch" };
  if (games.some((g) => g.winnerId !== row.playerA && g.winnerId !== row.playerB)) return { done: false, refused: "winner" };
  const refused = refusalOf(row, games);
  if (refused) return { done: false, refused };
  await tx.insert(leagueMatch).values(row);
  if (games.length > 0) await tx.insert(leagueGame).values(games);
  return { done: true };
}
