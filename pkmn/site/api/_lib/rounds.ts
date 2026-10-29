import { and, asc, eq, inArray } from "drizzle-orm";
import { drawRound, type LeagueMode, metIn, type Pair, type PairsInput, pairsProblem, type PairsProblem } from "../../shared/league.js";
import { db } from "./db.js";
import { leagueGame, leagueMatch, leagueRound, milestone, series, seriesPlayer } from "./schema.js";

export type RoundRefusal = "noRound" | "allOpen" | "noDraw" | "notNewest" | "started" | PairsProblem;

export type RoundMove = { done: true } | { done: false; refused: RoundRefusal };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RoundRow = typeof leagueRound.$inferSelect;

function random(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

async function leagueOf(tx: Tx, seriesId: string) {
  await tx.select({ id: series.id }).from(series).where(eq(series.id, seriesId)).for("update");
  const milestones = await tx
    .select({ id: milestone.id })
    .from(milestone)
    .where(and(eq(milestone.seriesId, seriesId), eq(milestone.mark, "round")))
    .orderBy(asc(milestone.position));
  const rows = await tx.select().from(leagueRound).where(eq(leagueRound.seriesId, seriesId));
  const matches = rows.length ? await tx.select().from(leagueMatch).where(inArray(leagueMatch.roundId, rows.map((r) => r.id))) : [];
  const rounds = milestones.flatMap((m, index) => {
    const row = rows.find((r) => r.milestoneId === m.id);
    return row ? [{ number: index + 1, row, matches: matches.filter((match) => match.roundId === row.id).map((match) => ({ a: match.playerA, b: match.playerB })) }] : [];
  });
  const paired = new Set([...matches.flatMap((m) => [m.playerA, m.playerB]), ...rows.flatMap((r) => (r.byeId ? [r.byeId] : []))]);
  const players = rows.length
    ? [...paired]
    : (await tx.select({ id: seriesPlayer.userId }).from(seriesPlayer).where(eq(seriesPlayer.seriesId, seriesId))).map((p) => p.id);
  return { milestones, rounds, players: players.sort(), unopened: milestones.filter((m) => !rows.some((r) => r.milestoneId === m.id)) };
}

type League = Awaited<ReturnType<typeof leagueOf>>;

function before(league: League, except: RoundRow | null) {
  const others = league.rounds.filter((r) => r.row.id !== except?.id);
  const met = metIn(others);
  const rested = new Set(others.flatMap((r) => (r.row.byeId ? [r.row.byeId] : [])));
  return { met, rested };
}

async function writePairs(tx: Tx, roundId: string, pairs: readonly Pair[]) {
  await tx.delete(leagueMatch).where(eq(leagueMatch.roundId, roundId));
  if (pairs.length === 0) return;
  await tx.insert(leagueMatch).values(pairs.map(([a, b], position) => ({ id: crypto.randomUUID(), roundId, position, playerA: a, playerB: b })));
}

export function openRound(seriesId: string, mode: LeagueMode): Promise<RoundMove> {
  return db.transaction(async (tx) => {
    const league = await leagueOf(tx, seriesId);
    const [next] = league.unopened;
    if (!next) return { done: false, refused: "allOpen" };
    const { met, rested } = before(league, null);
    const drawn = drawRound(league.players, new Set(met.keys()), rested, league.unopened.length, random);
    if (!drawn) return { done: false, refused: "noDraw" };
    const id = crypto.randomUUID();
    await tx.insert(leagueRound).values({ id, seriesId, milestoneId: next.id, mode, byeId: drawn.bye });
    await writePairs(tx, id, drawn.pairs);
    return { done: true };
  });
}

async function newest(tx: Tx, league: League, number: number): Promise<RoundRow | RoundRefusal> {
  const round = league.rounds.find((r) => r.number === number);
  if (!round) return "noRound";
  if (round !== league.rounds.at(-1)) return "notNewest";
  const matches = await tx.select().from(leagueMatch).where(eq(leagueMatch.roundId, round.row.id));
  if (matches.some((m) => m.gamesA !== null)) return "started";
  const ids = matches.map((m) => m.id);
  const [game] = ids.length ? await tx.select({ id: leagueGame.id }).from(leagueGame).where(inArray(leagueGame.matchId, ids)).limit(1) : [];
  return game ? "started" : round.row;
}

export function redrawRound(seriesId: string, number: number): Promise<RoundMove> {
  return db.transaction(async (tx) => {
    const league = await leagueOf(tx, seriesId);
    const round = await newest(tx, league, number);
    if (typeof round === "string") return { done: false, refused: round };
    const { met, rested } = before(league, round);
    const drawn = drawRound(league.players, new Set(met.keys()), rested, league.unopened.length + 1, random);
    if (!drawn) return { done: false, refused: "noDraw" };
    await tx.update(leagueRound).set({ byeId: drawn.bye }).where(eq(leagueRound.id, round.id));
    await writePairs(tx, round.id, drawn.pairs);
    return { done: true };
  });
}

export function setPairs(seriesId: string, number: number, input: PairsInput): Promise<RoundMove> {
  return db.transaction(async (tx) => {
    const league = await leagueOf(tx, seriesId);
    const round = await newest(tx, league, number);
    if (typeof round === "string") return { done: false, refused: round };
    const { met } = before(league, round);
    const problem = pairsProblem(league.players, input.pairs, input.bye, met);
    if (problem) return { done: false, refused: problem };
    await tx.update(leagueRound).set({ byeId: input.bye }).where(eq(leagueRound.id, round.id));
    await writePairs(tx, round.id, input.pairs);
    return { done: true };
  });
}
