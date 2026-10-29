import * as z from "zod";
import { teamSlots } from "./team.js";

export const POINTS_PER_WIN = 1;

export const POINTS_PER_COMBAT = 1;

export const LEAGUE_COMBATS = 5;

export const PARTY_SIZE = 6;

export const MATCH_GAMES = 3;

export const GAMES_TO_WIN = 2;

export const FAINTED_PER_GAME = 6;

export const ROUND_TEAM_SIZE = 6;

export const CUP_TEAM_SIZE = 8;

export const CUP_BROUGHT = 6;

export const SHOWDOWN_FORMAT = "[Gen 9] Custom Game";

export const SHOWDOWN_CLAUSES = ["Species", "Sleep", "OHKO", "Evasion Moves"] as const;

export const EGGS_PER_WIN = 1;

export const EGGS_PER_COMBAT = 1;

export const LEAGUE_MODES = ["open", "closed"] as const;

export const leagueMode = z.enum(LEAGUE_MODES);

export const leaguePlayer = z.object({ id: z.string(), name: z.string() });

export const ROUND_TEAM_STATES = ["locked", "building", "save"] as const;

export const roundTeamState = z.enum(ROUND_TEAM_STATES);

export const leagueMatch = z.object({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  gamesA: z.int().nullable(),
  gamesB: z.int().nullable(),
  faintedA: z.int().nullable(),
  faintedB: z.int().nullable(),
  teamA: roundTeamState,
  teamB: roundTeamState,
});

export const leagueRound = z.object({
  number: z.int(),
  milestone: z.string(),
  mode: leagueMode,
  bye: z.string().nullable(),
  started: z.boolean(),
  matches: z.array(leagueMatch),
  hidden: z.object({ pairs: z.int(), toPlay: z.int(), yours: z.boolean() }).nullable(),
});

export type PairedRound = {
  mode: LeagueMode;
  bye: string | null;
  matches: readonly { id: string; a: string; b: string; decided: boolean; locked: readonly string[] }[];
};

export function pairsHidden(reader: string, round: PairedRound): { matches: Set<string>; bye: boolean; yours: boolean } {
  if (round.mode === "open") return { matches: new Set(), bye: false, yours: false };
  const mine = round.matches.find((match) => match.a === reader || match.b === reader);
  if (mine && !mine.decided && !mine.locked.includes(reader)) return { matches: new Set(round.matches.map((match) => match.id)), bye: round.bye !== null, yours: true };
  const matches = new Set(
    round.matches.filter((match) => match !== mine && !match.decided && !(match.locked.includes(match.a) && match.locked.includes(match.b))).map((match) => match.id),
  );
  return { matches, bye: round.bye !== null && round.bye !== reader && matches.size > 0, yours: false };
}

export const CUP_KINDS = ["first", "group", "bracket"] as const;

export const cupKind = z.enum(CUP_KINDS);

export const cupSlot = z.object({
  key: z.string(),
  kind: cupKind,
  left: z.int().nullable(),
  match: z.string().nullable(),
  a: z.string().nullable(),
  b: z.string().nullable(),
  gamesA: z.int().nullable(),
  gamesB: z.int().nullable(),
  faintedA: z.int().nullable(),
  faintedB: z.int().nullable(),
  wonA: z.int(),
  wonB: z.int(),
});

export const groupRow = z.object({
  player: z.string(),
  wins: z.int(),
  losses: z.int(),
  gameDiff: z.int(),
  monDiff: z.int(),
  through: z.boolean(),
});

export const leagueCup = z.object({
  mode: leagueMode,
  seeds: z.array(z.string()),
  slots: z.array(cupSlot),
  group: z.array(groupRow),
  champion: z.string().nullable(),
  at: z.string(),
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
  eggsWon: z.int(),
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

export const hatchedEggs = z.object({
  player: z.string(),
  count: z.int(),
  saved: z.int().nullable(),
  set: z.object({ by: z.string().nullable(), at: z.string() }).nullable(),
});

export const hatchedInput = z.object({ count: z.int().min(0).max(999) });

export const leaguePage = z.object({
  number: z.int(),
  name: z.string(),
  roundMilestones: z.array(z.string()),
  players: z.array(leaguePlayer),
  rounds: z.array(leagueRound),
  next: z.object({ number: z.int(), milestone: z.string() }).nullable(),
  standings: z.array(standing),
  tries: z.array(leagueTry),
  hatched: z.array(hatchedEggs),
  cup: leagueCup.nullable(),
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

const matchSide = z.object({ id: z.string(), name: z.string(), place: z.int().nullable(), points: z.int(), seed: z.int().nullable() });

export const matchCup = z.object({
  kind: cupKind,
  left: z.int().nullable(),
  group: z.int(),
  onward: z.object({ left: z.int(), opponent: z.string().nullable() }).nullable(),
});

export const matchMember = z.object({
  nickname: z.string().nullable(),
  species: z.string(),
  item: z.object({ id: z.string(), name: z.string() }).nullable(),
  types: z.array(z.string()),
  sprite: z.string().nullable(),
});

export const TEAM_REVEALS = ["all", "both", "result"] as const;

export const teamReveal = z.enum(TEAM_REVEALS);

export const matchTeam = z.discriminatedUnion("state", [
  z.object({ state: z.literal("none") }),
  z.object({ state: z.literal("waiting"), milestone: z.string() }),
  z.object({ state: z.literal("hidden"), locked: z.boolean(), reveal: teamReveal }),
  z.object({ state: z.literal("shown"), id: z.string(), name: z.string(), locked: z.boolean(), members: z.array(matchMember.nullable()) }),
]);

const cupSlotAt = z.int().min(0).max(CUP_TEAM_SIZE - 1);

export const gameSide = z.object({
  banned: z.boolean(),
  ban: cupSlotAt.nullable(),
  barred: cupSlotAt.nullable(),
  picked: z.boolean(),
  picks: z.array(cupSlotAt).nullable(),
});

export const gameDraft = z.object({
  number: z.int(),
  bans: z.boolean(),
  open: z.boolean(),
  a: gameSide,
  b: gameSide,
});

export const banInput = z.object({ player: z.string().min(1), slot: cupSlotAt });

export const pickInput = z.object({ player: z.string().min(1), slots: z.array(cupSlotAt).length(CUP_BROUGHT) });

export const matchPage = z.object({
  id: z.string(),
  number: z.int(),
  name: z.string(),
  round: z.object({ number: z.int(), milestone: z.string() }).nullable(),
  cup: matchCup.nullable(),
  a: matchSide,
  b: matchSide,
  teams: z.object({ a: matchTeam, b: matchTeam }),
  gamesA: z.int().nullable(),
  gamesB: z.int().nullable(),
  faintedA: z.int().nullable(),
  faintedB: z.int().nullable(),
  games: z.array(leagueGame),
  unrecorded: z.object({ a: z.int(), b: z.int() }),
  next: z.int().nullable(),
  draft: gameDraft.nullable(),
  admin: z.boolean(),
});

export const openInput = z.object({ mode: leagueMode });

export const cupInput = z.object({ players: z.array(z.string().min(1)).max(64), mode: leagueMode });

export const pairsInput = z.object({
  pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).max(64),
  bye: z.string().min(1).nullable(),
});

export type LeagueMode = z.infer<typeof leagueMode>;
export type PairsInput = z.infer<typeof pairsInput>;
export type CupKind = z.infer<typeof cupKind>;
export type CupSlotView = z.infer<typeof cupSlot>;
export type GroupRow = z.infer<typeof groupRow>;
export type LeagueCup = z.infer<typeof leagueCup>;
export type MatchCup = z.infer<typeof matchCup>;
export type CupInput = z.infer<typeof cupInput>;
export type LeaguePlayer = z.infer<typeof leaguePlayer>;
export type LeagueMatch = z.infer<typeof leagueMatch>;
export type RoundTeamState = z.infer<typeof roundTeamState>;
export type LeagueRound = z.infer<typeof leagueRound>;
export type Standing = z.infer<typeof standing>;
export type LeaguePage = z.infer<typeof leaguePage>;
export type LeagueGame = z.infer<typeof leagueGame>;
export type GameInput = z.infer<typeof gameInput>;
export type MatchPage = z.infer<typeof matchPage>;
export type MatchTeam = z.infer<typeof matchTeam>;
export type TeamReveal = z.infer<typeof teamReveal>;
export type MatchMember = z.infer<typeof matchMember>;
export type GameSide = z.infer<typeof gameSide>;
export type GameDraft = z.infer<typeof gameDraft>;
export type BanInput = z.infer<typeof banInput>;
export type PickInput = z.infer<typeof pickInput>;
export type TryMember = z.infer<typeof tryMember>;
export type LeagueTry = z.infer<typeof leagueTry>;
export type HatchedEggs = z.infer<typeof hatchedEggs>;
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

export function cupBans(mode: LeagueMode): boolean {
  return mode === "open";
}

export function barredBan(player: string, number: number, games: readonly Pick<LeagueGame, "number" | "winner">[], banOf: (number: number) => number | null): number | null {
  const before = games.find((g) => g.number === number - 1);
  return before && before.winner === player ? banOf(before.number) : null;
}

export function lockNeeds(kind: "round" | "cup", size: number, living: number | null): number {
  return kind === "cup" || living === null ? size : Math.max(1, Math.min(size, living));
}

export function pickProblem(size: number, slots: readonly number[], banned: number | null): boolean {
  return slots.length !== CUP_BROUGHT || new Set(slots).size !== slots.length || slots.some((at) => at < 0 || at >= size || at === banned);
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
      eggsWon: row.wins * EGGS_PER_WIN + (best.get(player) ?? 0) * EGGS_PER_COMBAT,
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

export const CUP_MIN = 2;

export const CUP_MAX = 6;

export const cupStarts = (entrants: number) => entrants >= CUP_MIN && entrants <= CUP_MAX && entrants % 2 === 0;

export type CupFeed = { seed: number } | { winner: string } | { loser: string } | { group: number };

export type CupSlot = { key: string; kind: CupKind; left: number | null; a: CupFeed; b: CupFeed };

export type CupProblem = "size" | "player" | "twice";

export function cupProblem(players: readonly string[], entrants: readonly string[]): CupProblem | null {
  const known = new Set(players);
  if (entrants.some((player) => !known.has(player))) return "player";
  if (new Set(entrants).size !== entrants.length) return "twice";
  return cupStarts(entrants.length) ? null : "size";
}

export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((seed) => [seed, next + 1 - seed]);
  }
  return order;
}

export function cupShape(entrants: number) {
  const half = entrants / 2;
  const plain = (entrants & (entrants - 1)) === 0;
  let size = 1;
  while (size < half) size *= 2;
  return { half, plain, size, rounds: Math.log2(size), qualifiers: plain ? 0 : size - half };
}

export function firstRound(entrants: number): [number, number][] {
  return Array.from({ length: Math.floor(entrants / 2) }, (_, at) => [at + 1, entrants - at]);
}

const firstKey = (k: number) => `f${k}`;

export function cupSlots(entrants: number): CupSlot[] {
  if (!cupStarts(entrants)) return [];
  const { half, plain, size, rounds, qualifiers } = cupShape(entrants);
  const winner = (k: number): CupFeed => ({ winner: firstKey(k) });
  let leaves: CupFeed[];
  if (plain) {
    leaves = seedOrder(half).map(winner);
  } else {
    const pairs: [number, CupFeed, CupFeed][] = [];
    for (let k = 1; k <= qualifiers; k++) pairs.push([k + 1, winner(k + 1), { group: k }]);
    const rest = [1, ...Array.from({ length: half - qualifiers - 1 }, (_, at) => qualifiers + 2 + at)];
    for (let at = 0; at < rest.length / 2; at++) pairs.push([rest[at]!, winner(rest[at]!), winner(rest[rest.length - 1 - at]!)]);
    pairs.sort((x, y) => x[0] - y[0]);
    leaves = seedOrder(size / 2).flatMap((place) => [pairs[place - 1]![1], pairs[place - 1]![2]]);
  }
  const first: CupSlot[] = leaves.flatMap((feed) => {
    if (!("winner" in feed)) return [];
    const k = Number(feed.winner.slice(1));
    const [a, b] = firstRound(entrants)[k - 1]!;
    return [{ key: feed.winner, kind: "first" as const, left: plain ? rounds : null, a: { seed: a }, b: { seed: b } }];
  });
  const group: CupSlot[] = [];
  for (let i = 1; i <= (plain ? 0 : half); i++) {
    for (let j = i + 1; j <= half; j++) group.push({ key: `g${i}-${j}`, kind: "group", left: null, a: { loser: firstKey(i) }, b: { loser: firstKey(j) } });
  }
  const bracket: CupSlot[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (let at = 1; at <= size / 2 ** round; at++) {
      const [a, b]: [CupFeed, CupFeed] = round === 1 ? [leaves[2 * at - 2]!, leaves[2 * at - 1]!] : [{ winner: `b${round - 1}-${2 * at - 1}` }, { winner: `b${round - 1}-${2 * at}` }];
      bracket.push({ key: `b${round}-${at}`, kind: "bracket", left: rounds - round, a, b });
    }
  }
  return [...first, ...group, ...bracket];
}

export type CupMatch = { a: string; b: string } & Pick<Result, "gamesA" | "gamesB" | "faintedA" | "faintedB">;

export function groupTable(seeds: readonly string[], players: readonly string[], matches: readonly CupMatch[], qualifiers: number): GroupRow[] {
  const rows = new Map(players.map((player) => [player, { player, wins: 0, losses: 0, gameDiff: 0, monDiff: 0, beat: new Set<string>() }]));
  let decided = 0;
  for (const match of matches) {
    const winner = winnerOf(match);
    const a = rows.get(match.a);
    const b = rows.get(match.b);
    if (!winner || !a || !b) continue;
    decided++;
    const [won, lost] = winner === match.a ? [a, b] : [b, a];
    won.wins++;
    lost.losses++;
    won.beat.add(lost.player);
    a.gameDiff += match.gamesA! - match.gamesB!;
    b.gameDiff += match.gamesB! - match.gamesA!;
    a.monDiff += (match.faintedB ?? 0) - (match.faintedA ?? 0);
    b.monDiff += (match.faintedA ?? 0) - (match.faintedB ?? 0);
  }
  const list = [...rows.values()];
  const headToHead = (row: (typeof list)[number]) => list.filter((other) => other.wins === row.wins && row.beat.has(other.player)).length;
  list.sort(
    (x, y) => y.wins - x.wins || headToHead(y) - headToHead(x) || y.gameDiff - x.gameDiff || y.monDiff - x.monDiff || seeds.indexOf(x.player) - seeds.indexOf(y.player),
  );
  const settled = decided === (players.length * (players.length - 1)) / 2;
  return list.map(({ beat: _beat, ...row }, index) => ({ ...row, through: settled && index < qualifiers }));
}

export type CupReach = { kind: CupKind; left: number | null; group: number; champion: boolean };

export function cupReach(cup: Pick<LeagueCup, "seeds" | "slots" | "champion">, player: string): CupReach | null {
  const at = cup.slots.findLast((slot) => slot.a === player || slot.b === player);
  return at ? { kind: at.kind, left: at.left, group: cupShape(cup.seeds.length).half, champion: cup.champion === player } : null;
}

export type DrawnSlot = Omit<CupSlot, "a" | "b"> & { a: string | null; b: string | null; winner: string | null };

export type CupDraw = { slots: DrawnSlot[]; group: GroupRow[]; champion: string | null };

export function cupDraw(seeds: readonly string[], played: ReadonlyMap<string, CupMatch>): CupDraw {
  const { qualifiers } = cupShape(seeds.length);
  const drawn = new Map<string, DrawnSlot>();
  const loserOf = (key: string) => {
    const at = drawn.get(key);
    return at?.winner ? (at.winner === at.a ? at.b : at.a) : null;
  };
  let group: GroupRow[] = [];
  const feed = (from: CupFeed): string | null => {
    if ("seed" in from) return seeds[from.seed - 1] ?? null;
    if ("winner" in from) return drawn.get(from.winner)?.winner ?? null;
    if ("loser" in from) return loserOf(from.loser);
    const row = group[from.group - 1];
    return row?.through ? row.player : null;
  };
  const slots = cupSlots(seeds.length);
  for (const slot of slots) {
    if (slot.kind === "bracket" && qualifiers > 0 && group.length === 0) {
      const losers = slots.filter((s) => s.kind === "first").map((s) => loserOf(s.key));
      if (losers.every((player) => player !== null)) {
        const results = [...drawn.values()].flatMap((s) => (s.kind === "group" && s.winner ? [played.get(s.key)!] : []));
        group = groupTable(seeds, losers as string[], results, qualifiers);
      }
    }
    const a = feed(slot.a);
    const b = feed(slot.b);
    const result = played.get(slot.key);
    const winner = a && b && result && result.a === a && result.b === b ? winnerOf(result) : null;
    const one = { ...slot, a, b, winner };
    drawn.set(slot.key, one);
  }
  const all = [...drawn.values()];
  return { slots: all, group, champion: all.at(-1)?.winner ?? null };
}
