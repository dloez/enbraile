import * as z from "zod";
import { teamSlots } from "./team.js";

export const POINTS_PER_WIN = 1;

export const POINTS_PER_COMBAT = 1;

export const LEAGUE_COMBATS = 5;

export const PARTY_SIZE = 6;

export const MATCH_GAMES = 3;

export const GAMES_TO_WIN = 2;

export const FAINTED_PER_GAME = 6;

export const LEAGUE_MODES = ["open", "closed"] as const;

export const leagueMode = z.enum(LEAGUE_MODES);

export const leaguePlayer = z.object({ id: z.string(), name: z.string() });

export const leagueMatch = z.object({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  gamesA: z.int().nullable(),
  gamesB: z.int().nullable(),
  faintedA: z.int().nullable(),
  faintedB: z.int().nullable(),
});

export const leagueRound = z.object({
  number: z.int(),
  milestone: z.string(),
  mode: leagueMode,
  bye: z.string().nullable(),
  started: z.boolean(),
  matches: z.array(leagueMatch),
});

export const standing = z.object({
  player: z.string(),
  place: z.int(),
  points: z.int(),
  wins: z.int(),
  losses: z.int(),
  gamesWon: z.int(),
  gamesLost: z.int(),
  fainted: z.int(),
  best: z.int().nullable(),
  tie: z.object({ beat: z.array(z.string()), lostTo: z.array(z.string()) }).nullable(),
});

export const tryMember = z.object({ species: z.string().min(1), fell: z.int().min(1).max(LEAGUE_COMBATS).nullable() });

export const leagueTry = z.object({
  id: z.string(),
  player: z.string(),
  number: z.int(),
  combatsWon: z.int(),
  members: z.array(tryMember.extend({ name: z.string(), sprite: z.string().nullable() })),
  team: z.string().nullable(),
  best: z.boolean(),
  at: z.string(),
});

export const leaguePage = z.object({
  number: z.int(),
  name: z.string(),
  roundMilestones: z.array(z.string()),
  players: z.array(leaguePlayer),
  rounds: z.array(leagueRound),
  next: z.object({ number: z.int(), milestone: z.string() }).nullable(),
  standings: z.array(standing),
  tries: z.array(leagueTry),
  admin: z.boolean(),
});

const combatsWon = z.int().min(0).max(LEAGUE_COMBATS);

const fellIn = z.array(z.int().min(1).max(LEAGUE_COMBATS).nullable()).min(1).max(PARTY_SIZE);

export const tryEdit = z.object({ combatsWon, fell: fellIn });

export const tryInput = tryEdit.extend({ team: z.union([z.object({ id: z.string().min(1) }), z.object({ slots: teamSlots })]) });

export const leagueGame = z.object({
  number: z.int(),
  winner: z.string(),
  faintedA: z.int(),
  faintedB: z.int(),
  replay: z.string().nullable(),
});

export const gameInput = z.object({
  winner: z.string(),
  faintedA: z.int().min(0).max(FAINTED_PER_GAME),
  faintedB: z.int().min(0).max(FAINTED_PER_GAME),
  replay: z.url({ protocol: /^https?$/ }).max(500).nullable(),
});

const matchSide = z.object({ id: z.string(), name: z.string(), place: z.int().nullable(), points: z.int() });

export const matchPage = z.object({
  id: z.string(),
  number: z.int(),
  name: z.string(),
  round: z.object({ number: z.int(), milestone: z.string() }),
  a: matchSide,
  b: matchSide,
  gamesA: z.int().nullable(),
  gamesB: z.int().nullable(),
  faintedA: z.int().nullable(),
  faintedB: z.int().nullable(),
  games: z.array(leagueGame),
  unrecorded: z.object({ a: z.int(), b: z.int() }),
  next: z.int().nullable(),
  admin: z.boolean(),
});

export const openInput = z.object({ mode: leagueMode });

export const pairsInput = z.object({
  pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).max(64),
  bye: z.string().min(1).nullable(),
});

export type LeagueMode = z.infer<typeof leagueMode>;
export type PairsInput = z.infer<typeof pairsInput>;
export type LeaguePlayer = z.infer<typeof leaguePlayer>;
export type LeagueMatch = z.infer<typeof leagueMatch>;
export type LeagueRound = z.infer<typeof leagueRound>;
export type Standing = z.infer<typeof standing>;
export type LeaguePage = z.infer<typeof leaguePage>;
export type LeagueGame = z.infer<typeof leagueGame>;
export type GameInput = z.infer<typeof gameInput>;
export type MatchPage = z.infer<typeof matchPage>;
export type TryMember = z.infer<typeof tryMember>;
export type LeagueTry = z.infer<typeof leagueTry>;
export type TryEdit = z.infer<typeof tryEdit>;
export type TryInput = z.infer<typeof tryInput>;

export type Result = Pick<LeagueMatch, "a" | "b" | "gamesA" | "gamesB" | "faintedA" | "faintedB">;

export function played(match: Pick<Result, "gamesA" | "gamesB">): boolean {
  if (match.gamesA === null || match.gamesB === null) return false;
  return Math.max(match.gamesA, match.gamesB) === GAMES_TO_WIN && Math.min(match.gamesA, match.gamesB) < GAMES_TO_WIN && match.gamesA + match.gamesB <= MATCH_GAMES;
}

export function winnerOf(match: Result): string | null {
  if (!played(match)) return null;
  return match.gamesA! > match.gamesB! ? match.a : match.b;
}

export function decided(gamesA: number, gamesB: number): boolean {
  return Math.max(gamesA, gamesB) >= GAMES_TO_WIN;
}

type Sides = Pick<Result, "a" | "b">;

export function wins(match: Sides, games: Pick<LeagueGame, "winner">[]) {
  return { gamesA: games.filter((g) => g.winner === match.a).length, gamesB: games.filter((g) => g.winner === match.b).length };
}

export function tally(match: Sides, games: Pick<LeagueGame, "winner" | "faintedA" | "faintedB">[]) {
  return {
    ...wins(match, games),
    faintedA: games.reduce((n, g) => n + g.faintedA, 0),
    faintedB: games.reduce((n, g) => n + g.faintedB, 0),
  };
}

export function gamesProblem(match: Sides, games: Pick<LeagueGame, "number" | "winner">[]): "winner" | "order" | "past" | null {
  const sorted = [...games].sort((x, y) => x.number - y.number);
  if (sorted.some((g) => g.winner !== match.a && g.winner !== match.b)) return "winner";
  if (sorted.length > MATCH_GAMES || sorted.some((g, index) => g.number !== index + 1)) return "order";
  const over = (index: number) => {
    const before = wins(match, sorted.slice(0, index));
    return decided(before.gamesA, before.gamesB);
  };
  return sorted.some((_, index) => index > 0 && over(index)) ? "past" : null;
}

export function covers(match: Pick<Result, "a" | "b" | "gamesA" | "gamesB">, games: Pick<LeagueGame, "winner">[]): boolean {
  if (match.gamesA === null || match.gamesB === null) return true;
  const won = wins(match, games);
  return won.gamesA === match.gamesA && won.gamesB === match.gamesB;
}

export function fits(match: Pick<Result, "a" | "b" | "gamesA" | "gamesB">, games: Pick<LeagueGame, "winner">[]): boolean {
  if (match.gamesA === null || match.gamesB === null) return true;
  const won = wins(match, games);
  return won.gamesA <= match.gamesA && won.gamesB <= match.gamesB;
}

export function nextGame(match: Pick<Result, "a" | "b" | "gamesA" | "gamesB">, games: Pick<LeagueGame, "winner">[]): number | null {
  if (match.gamesA !== null && match.gamesB !== null) return null;
  const won = wins(match, games);
  return decided(won.gamesA, won.gamesB) ? null : games.length + 1;
}

export function lastCombat(combatsWon: number): number {
  return Math.min(combatsWon + 1, LEAGUE_COMBATS);
}

export function fellProblem(combatsWon: number, fell: readonly (number | null)[]): boolean {
  return fell.some((combat) => combat !== null && combat > lastCombat(combatsWon));
}

export function bestTries<T extends { player: string; combatsWon: number }>(tries: readonly T[]): Map<string, T> {
  const best = new Map<string, T>();
  for (const one of tries) {
    const held = best.get(one.player);
    if (!held || one.combatsWon > held.combatsWon) best.set(one.player, one);
  }
  return best;
}

export function drawOrder(seed: string, player: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${seed}:${player}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

export function standings(players: string[], results: Result[], best: ReadonlyMap<string, number>, seed: string): Standing[] {
  const rows = new Map(players.map((player) => [player, { player, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, fainted: 0, beat: new Set<string>() }]));
  for (const match of results) {
    const winner = winnerOf(match);
    const a = rows.get(match.a);
    const b = rows.get(match.b);
    if (!winner || !a || !b) continue;
    const [won, lost] = winner === match.a ? [a, b] : [b, a];
    won.wins++;
    lost.losses++;
    won.beat.add(lost.player);
    a.gamesWon += match.gamesA!;
    a.gamesLost += match.gamesB!;
    b.gamesWon += match.gamesB!;
    b.gamesLost += match.gamesA!;
    a.fainted += match.faintedA ?? 0;
    b.fainted += match.faintedB ?? 0;
  }
  const points = (player: string) => rows.get(player)!.wins * POINTS_PER_WIN + (best.get(player) ?? 0) * POINTS_PER_COMBAT;
  const beat = (x: string, y: string) => rows.get(x)!.beat.has(y);
  const byDraw = (group: string[]) => [...group].sort((x, y) => drawOrder(seed, y) - drawOrder(seed, x));
  const settle = (group: string[]): string[] => {
    if (group.length < 2) return group;
    if (group.length === 2) {
      const [x, y] = group as [string, string];
      if (beat(x, y)) return [x, y];
      if (beat(y, x)) return [y, x];
      return byDraw(group);
    }
    const among = (player: string) => group.filter((other) => beat(player, other)).length;
    const levels = [...new Set(group.map(among))].sort((x, y) => y - x);
    return levels.flatMap((level) => byDraw(group.filter((player) => among(player) === level)));
  };
  const levels = [...new Set(players.map(points))].sort((x, y) => y - x);
  const order = levels.flatMap((level) => settle(players.filter((player) => points(player) === level)));
  return order.map((player, index) => {
    const row = rows.get(player)!;
    const tied = players.filter((other) => other !== player && points(other) === points(player));
    return {
      player,
      place: index + 1,
      points: points(player),
      wins: row.wins,
      losses: row.losses,
      gamesWon: row.gamesWon,
      gamesLost: row.gamesLost,
      fainted: row.fainted,
      best: best.get(player) ?? null,
      tie: tied.length === 0 ? null : { beat: tied.filter((other) => beat(player, other)), lostTo: tied.filter((other) => beat(other, player)) },
    };
  });
}

export type Pair = readonly [string, string];

export function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

export function metIn(rounds: readonly { number: number; matches: readonly { a: string; b: string }[] }[]): Map<string, number> {
  const met = new Map<string, number>();
  for (const round of rounds) for (const match of round.matches) if (!met.has(pairKey(match.a, match.b))) met.set(pairKey(match.a, match.b), round.number);
  return met;
}

export type PairsProblem = "player" | "same" | "twice" | "missing" | "bye" | "met";

export function pairsProblem(players: readonly string[], pairs: readonly Pair[], bye: string | null, met: ReadonlyMap<string, number>): PairsProblem | null {
  const known = new Set(players);
  const placed = [...pairs.flat(), ...(bye === null ? [] : [bye])];
  if (placed.some((player) => !known.has(player))) return "player";
  if (pairs.some(([x, y]) => x === y)) return "same";
  if (new Set(placed).size !== placed.length) return "twice";
  if (placed.length !== players.length) return "missing";
  if ((bye !== null) !== (players.length % 2 === 1)) return "bye";
  return pairs.some(([x, y]) => met.has(pairKey(x, y))) ? "met" : null;
}

const RESTS = "";

const DRAW_STEPS = 200_000;

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let at = out.length - 1; at > 0; at--) {
    const other = Math.floor(random() * (at + 1));
    [out[at], out[other]] = [out[other]!, out[at]!];
  }
  return out;
}

export function drawRound(
  players: readonly string[],
  met: ReadonlySet<string>,
  rested: ReadonlySet<string>,
  rounds: number,
  random: () => number,
): { pairs: Pair[]; bye: string | null } | null {
  const seats = players.length % 2 === 1 ? [...players, RESTS] : [...players];
  if (seats.length < 2) return null;
  const free = (x: string, y: string, used: ReadonlySet<string>) => {
    if (x === RESTS || y === RESTS) return !rested.has(x === RESTS ? y : x) && !used.has(pairKey(x, y));
    return !met.has(pairKey(x, y)) && !used.has(pairKey(x, y));
  };
  let steps = 0;
  const season = (left: number, used: Set<string>): Pair[][] | null => {
    if (left === 0) return [];
    const matching = (open: string[], taken: Pair[]): Pair[][] | null => {
      if (++steps > DRAW_STEPS) return null;
      if (open.length === 0) {
        for (const [x, y] of taken) used.add(pairKey(x, y));
        const rest = season(left - 1, used);
        for (const [x, y] of taken) used.delete(pairKey(x, y));
        return rest && [[...taken], ...rest];
      }
      const [first, ...others] = open as [string, ...string[]];
      for (const partner of shuffled(others, random)) {
        if (!free(first, partner, used)) continue;
        const found = matching(
          others.filter((seat) => seat !== partner),
          [...taken, [first, partner]],
        );
        if (found) return found;
        if (steps > DRAW_STEPS) return null;
      }
      return null;
    };
    return matching(shuffled(seats, random), []);
  };
  for (let depth = Math.max(1, rounds); depth >= 1; depth--) {
    steps = 0;
    const found = season(depth, new Set());
    if (!found) continue;
    const [round] = found as [Pair[]];
    const bye = round.find((pair) => pair.includes(RESTS));
    return {
      pairs: shuffled(round.filter((pair) => !pair.includes(RESTS)), random).map((pair) => (random() < 0.5 ? pair : [pair[1], pair[0]])),
      bye: bye ? (bye[0] === RESTS ? bye[1] : bye[0]) : null,
    };
  }
  return null;
}
