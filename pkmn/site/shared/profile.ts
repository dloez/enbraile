import * as z from "zod";
import { scene, seriesState } from "./series.js";

const count = z.int().nullable();

export const careerTotals = z.object({
  series: z.int(),
  finished: z.int(),
  playTime: z.number().nullable(),
  badges: z.int(),
  badgeSlots: z.int(),
  bestPokedex: z.object({ owned: z.int(), series: z.string() }).nullable(),
  trainerBattlesWon: count,
  trainerBattlesLost: count,
  blackouts: count,
  fallen: z.int(),
});

export const profileSeries = z.object({
  number: z.int(),
  name: z.string(),
  scene,
  state: seriesState,
  game: z.string().nullable(),
  reached: z.string().nullable(),
  reachedEnd: z.boolean(),
  playTime: z.number().nullable(),
  fallen: count,
});

export const profilePage = z.object({
  player: z.object({ id: z.string(), name: z.string() }),
  since: z.string().nullable(),
  career: careerTotals,
  series: z.array(profileSeries),
});

export type CareerTotals = z.infer<typeof careerTotals>;
export type ProfileSeries = z.infer<typeof profileSeries>;
export type ProfilePage = z.infer<typeof profilePage>;

export type LatestRecord = {
  series: string;
  playTime: number | null;
  badges: number;
  badgeSlots: number;
  owned: number | null;
  trainerBattlesWon: number | null;
  trainerBattlesLost: number | null;
  blackouts: number | null;
  fallen: number;
};

function sum(values: (number | null)[]): number | null {
  const known = values.filter((v) => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

export function careerOf(played: { finished: boolean; latest: LatestRecord | null }[]): CareerTotals {
  const latest = played.flatMap((p) => (p.latest ? [p.latest] : []));
  const best = latest.reduce<(LatestRecord & { owned: number }) | null>(
    (top, r) => (r.owned !== null && (top === null || r.owned > top.owned) ? { ...r, owned: r.owned } : top),
    null,
  );
  return {
    series: played.length,
    finished: played.filter((p) => p.finished).length,
    playTime: sum(latest.map((r) => r.playTime)),
    badges: latest.reduce((a, r) => a + r.badges, 0),
    badgeSlots: latest.reduce((a, r) => a + r.badgeSlots, 0),
    bestPokedex: best && { owned: best.owned, series: best.series },
    trainerBattlesWon: sum(latest.map((r) => r.trainerBattlesWon)),
    trainerBattlesLost: sum(latest.map((r) => r.trainerBattlesLost)),
    blackouts: sum(latest.map((r) => r.blackouts)),
    fallen: latest.reduce((a, r) => a + r.fallen, 0),
  };
}
