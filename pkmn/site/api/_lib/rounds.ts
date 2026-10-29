import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drawRound, type LeagueMode, metIn, type Pair, type PairsInput, pairsProblem, type PairsProblem, ROUND_TEAM_SIZE } from "../../shared/league.js";
import { emptySlots } from "../../shared/team.js";
import { db } from "./db.js";
import { leagueGame, leagueMatch, leagueRound, milestone, save, series, seriesPlayer, snapshot, team, teamSource } from "./schema.js";
import { insertTeam } from "./teams.js";

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
  const old = await tx.select({ id: leagueMatch.id }).from(leagueMatch).where(eq(leagueMatch.roundId, roundId));
  const kept = old.length
    ? await tx
        .update(team)
        .set({ matchId: null })
        .where(inArray(team.matchId, old.map((m) => m.id)))
        .returning({ id: team.id, ownerId: team.ownerId })
    : [];
  await tx.delete(leagueMatch).where(eq(leagueMatch.roundId, roundId));
  const made = pairs.map(([a, b], position) => ({ id: crypto.randomUUID(), roundId, position, playerA: a, playerB: b }));
  if (made.length > 0) await tx.insert(leagueMatch).values(made);
  for (const one of kept) {
    const home = made.find((m) => m.playerA === one.ownerId || m.playerB === one.ownerId);
    if (home) await tx.update(team).set({ matchId: home.id }).where(eq(team.id, one.id));
    else await tx.delete(team).where(eq(team.id, one.id));
  }
  const [held] = await tx.select({ seriesId: leagueRound.seriesId }).from(leagueRound).where(eq(leagueRound.id, roundId));
  if (held) await giveRoundTeams(tx, held.seriesId);
}

export async function giveRoundTeams(tx: Tx, seriesId: string): Promise<void> {
  const [row] = await tx.select({ pool: series.pool }).from(series).where(eq(series.id, seriesId)).for("update");
  if (!row) return;
  const rounds = await tx
    .select({ id: leagueRound.id, milestoneId: leagueRound.milestoneId, milestone: milestone.name })
    .from(leagueRound)
    .innerJoin(milestone, eq(milestone.id, leagueRound.milestoneId))
    .where(eq(leagueRound.seriesId, seriesId));
  if (rounds.length === 0) return;
  const matches = await tx
    .select({ id: leagueMatch.id, roundId: leagueMatch.roundId, a: leagueMatch.playerA, b: leagueMatch.playerB })
    .from(leagueMatch)
    .where(and(inArray(leagueMatch.roundId, rounds.map((r) => r.id)), isNull(leagueMatch.gamesA)));
  if (matches.length === 0) return;
  const made = await tx
    .select({
      id: team.id,
      matchId: team.matchId,
      ownerId: team.ownerId,
      anyPokemon: team.anyPokemon,
      sources: sql<number>`(select count(*) from ${teamSource} where ${teamSource.teamId} = ${team.id})`.mapWith(Number),
    })
    .from(team)
    .where(inArray(team.matchId, matches.map((m) => m.id)));
  const sheets = await tx
    .select({ player: save.userId, milestoneId: snapshot.milestoneId, id: snapshot.id })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .where(and(eq(save.seriesId, seriesId), inArray(snapshot.milestoneId, rounds.map((r) => r.milestoneId))));
  for (const match of matches) {
    const round = rounds.find((r) => r.id === match.roundId)!;
    for (const owner of [match.a, match.b]) {
      const sheet = sheets.find((one) => one.player === owner && one.milestoneId === round.milestoneId);
      if (!sheet) continue;
      const have = made.find((one) => one.matchId === match.id && one.ownerId === owner);
      if (have) {
        if (have.sources === 0 && !have.anyPokemon) await tx.insert(teamSource).values({ teamId: have.id, snapshotId: sheet.id, position: 0 });
        continue;
      }
      await insertTeam(tx, {
        id: crypto.randomUUID(),
        ownerId: owner,
        name: `${round.milestone} team`,
        anyPokemon: false,
        slots: emptySlots(ROUND_TEAM_SIZE),
        pool: row.pool,
        sources: [sheet.id],
        matchId: match.id,
      });
    }
  }
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
