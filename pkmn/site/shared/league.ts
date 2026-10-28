import * as z from "zod";

export const POINTS_PER_WIN = 1;

export const MATCH_GAMES = 3;

export const GAMES_TO_WIN = 2;

export const leaguePlayer = z.object({ id: z.string(), name: z.string() });

export const leagueMatch = z.object({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  gamesA: z.int().nullable(),
  gamesB: z.int().nullable(),
  faintedA: z.int().nullable(),
  faintedB: z.int().nullable(),
  replays: z.array(z.string()),
});

export const leagueRound = z.object({
  number: z.int(),
  milestone: z.string(),
  bye: z.string().nullable(),
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
  tie: z.object({ beat: z.array(z.string()), lostTo: z.array(z.string()) }).nullable(),
});

export const leaguePage = z.object({
  number: z.int(),
  name: z.string(),
  roundMilestones: z.array(z.string()),
  players: z.array(leaguePlayer),
  rounds: z.array(leagueRound),
  standings: z.array(standing),
});

export type LeaguePlayer = z.infer<typeof leaguePlayer>;
export type LeagueMatch = z.infer<typeof leagueMatch>;
export type LeagueRound = z.infer<typeof leagueRound>;
export type Standing = z.infer<typeof standing>;
export type LeaguePage = z.infer<typeof leaguePage>;

export type Result = Pick<LeagueMatch, "a" | "b" | "gamesA" | "gamesB" | "faintedA" | "faintedB">;

export function played(match: Pick<Result, "gamesA" | "gamesB">): boolean {
  if (match.gamesA === null || match.gamesB === null) return false;
  return Math.max(match.gamesA, match.gamesB) === GAMES_TO_WIN && Math.min(match.gamesA, match.gamesB) < GAMES_TO_WIN && match.gamesA + match.gamesB <= MATCH_GAMES;
}

export function winnerOf(match: Result): string | null {
  if (!played(match)) return null;
  return match.gamesA! > match.gamesB! ? match.a : match.b;
}

export function drawOrder(seed: string, player: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${seed}:${player}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

export function standings(players: string[], results: Result[], seed: string): Standing[] {
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
  const points = (player: string) => rows.get(player)!.wins * POINTS_PER_WIN;
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
      tie: tied.length === 0 ? null : { beat: tied.filter((other) => beat(player, other)), lostTo: tied.filter((other) => beat(other, player)) },
    };
  });
}
