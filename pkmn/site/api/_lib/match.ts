import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  barredBan,
  covers,
  cupBans,
  decided,
  fits,
  type GameInput,
  gamesProblem,
  type LeagueMode,
  MATCH_GAMES,
  nextGame,
  pickProblem,
  tally,
} from "../../shared/league.js";
import { CupConflict, lockCup, settleCup } from "./cup.js";
import { db } from "./db.js";
import { cup, gameSide, leagueGame, leagueMatch, team } from "./schema.js";
import { revealed } from "./series-data.js";

export type Refusal =
  | "noMatch"
  | "winner"
  | "order"
  | "closed"
  | "noGame"
  | "past"
  | "score"
  | "later"
  | "notSide"
  | "noDraft"
  | "noBans"
  | "notOpen"
  | "banned"
  | "barred"
  | "slot"
  | "bansFirst"
  | "picked"
  | "pick";

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
    if (held && held.winnerId !== input.winner) await tx.delete(gameSide).where(and(eq(gameSide.matchId, matchId), gt(gameSide.number, after.length)));
    if (whole) {
      const sum = tally(sides, after.map(played));
      const result = decided(sum.gamesA, sum.gamesB) ? sum : { gamesA: null, gamesB: null, faintedA: null, faintedB: null };
      await tx.update(leagueMatch).set(result).where(eq(leagueMatch.id, matchId));
      if (match.gamesA === null && result.gamesA !== null) await tx.update(team).set({ lockedAt: new Date() }).where(and(eq(team.matchId, matchId), isNull(team.lockedAt)));
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

type Reader = Tx | typeof db;

export type SideRow = typeof gameSide.$inferSelect;

export async function cupModeOf(tx: Reader, match: Pick<MatchRow, "cupId">): Promise<LeagueMode | null> {
  if (!match.cupId) return null;
  const [held] = await tx.select({ mode: cup.mode }).from(cup).where(eq(cup.id, match.cupId));
  return held?.mode ?? null;
}

export async function matchTeamsOf(tx: Reader, matchId: string) {
  return tx
    .select({ ownerId: team.ownerId, slots: team.slots, lockedAt: team.lockedAt, revealed: sql<boolean>`(${revealed()})` })
    .from(team)
    .where(eq(team.matchId, matchId));
}

export function started(match: Pick<MatchRow, "playerA" | "playerB">, mode: LeagueMode, teams: Awaited<ReturnType<typeof matchTeamsOf>>): boolean {
  const both = [match.playerA, match.playerB].map((player) => teams.find((one) => one.ownerId === player));
  return both.every((one) => one?.lockedAt) && (!cupBans(mode) || both.every((one) => one?.revealed));
}

export async function sidesOf(tx: Reader, matchId: string): Promise<SideRow[]> {
  return tx.select().from(gameSide).where(eq(gameSide.matchId, matchId));
}

type Draft = { match: MatchRow; games: GameRow[]; mode: LeagueMode; teams: Awaited<ReturnType<typeof matchTeamsOf>>; sides: SideRow[]; other: string };

async function draftMove(matchId: string, number: number, player: string, by: string, make: (tx: Tx, draft: Draft) => Promise<Refusal | null>): Promise<Move> {
  if (!Number.isInteger(number) || number < 1 || number > MATCH_GAMES) return { done: false, refused: "noGame" };
  return db.transaction(async (tx): Promise<Move> => {
    const [match] = await tx.select().from(leagueMatch).where(eq(leagueMatch.id, matchId)).for("update");
    if (!match) return { done: false, refused: "noMatch" };
    if (player !== by || (player !== match.playerA && player !== match.playerB)) return { done: false, refused: "notSide" };
    const mode = await cupModeOf(tx, match);
    if (!mode) return { done: false, refused: "noDraft" };
    const games = await tx.select().from(leagueGame).where(eq(leagueGame.matchId, matchId)).orderBy(asc(leagueGame.number));
    const next = nextGame({ a: match.playerA, b: match.playerB, gamesA: match.gamesA, gamesB: match.gamesB }, games.map(played));
    const teams = await matchTeamsOf(tx, matchId);
    if (next !== number || !started(match, mode, teams)) return { done: false, refused: "notOpen" };
    const sides = (await sidesOf(tx, matchId)).filter((side) => side.number === number);
    const refused = await make(tx, { match, games, mode, teams, sides, other: player === match.playerA ? match.playerB : match.playerA });
    return refused ? { done: false, refused } : { done: true };
  });
}

async function writeSide(tx: Tx, matchId: string, number: number, player: string, set: Partial<Pick<SideRow, "ban" | "bannedAt" | "picks" | "pickedAt">>) {
  await tx
    .insert(gameSide)
    .values({ matchId, number, playerId: player, ...set })
    .onConflictDoUpdate({ target: [gameSide.matchId, gameSide.number, gameSide.playerId], set });
}

export function banIn(matchId: string, number: number, player: string, slot: number, by: string): Promise<Move> {
  return draftMove(matchId, number, player, by, async (tx, { games, mode, teams, sides, other }) => {
    if (!cupBans(mode)) return "noBans";
    const mine = sides.find((side) => side.playerId === player);
    if (mine?.ban !== null && mine?.ban !== undefined) return "banned";
    const theirs = teams.find((one) => one.ownerId === other);
    if (!theirs || slot >= theirs.slots.length || theirs.slots[slot] === null) return "slot";
    const before = await tx
      .select({ ban: gameSide.ban })
      .from(gameSide)
      .where(and(eq(gameSide.matchId, matchId), eq(gameSide.number, number - 1), eq(gameSide.playerId, player)));
    if (barredBan(player, number, games.map(played), () => before[0]?.ban ?? null) === slot) return "barred";
    await writeSide(tx, matchId, number, player, { ban: slot, bannedAt: new Date() });
    return null;
  });
}

export function pickSix(matchId: string, number: number, player: string, slots: readonly number[], by: string): Promise<Move> {
  return draftMove(matchId, number, player, by, async (tx, { mode, teams, sides, other }) => {
    const mine = sides.find((side) => side.playerId === player);
    const theirs = sides.find((side) => side.playerId === other);
    if (cupBans(mode) && (mine?.ban == null || theirs?.ban == null)) return "bansFirst";
    if (mine?.picks) return "picked";
    const own = teams.find((one) => one.ownerId === player);
    if (!own || pickProblem(own.slots.length, slots, cupBans(mode) ? (theirs?.ban ?? null) : null) || slots.some((at) => own.slots[at] === null)) return "pick";
    await writeSide(tx, matchId, number, player, { picks: [...slots], pickedAt: new Date() });
    return null;
  });
}
