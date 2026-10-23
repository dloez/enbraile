import * as z from "zod";

const count = z.int().nullable();

export const journeyRecord = z.object({
  playTime: z.number().nullable(),
  badges: z.int(),
  badgeSlots: z.int(),
  money: count,
  seen: z.int(),
  owned: z.int(),
  trainerBattlesWon: count,
  trainerBattlesLost: count,
  blackouts: count,
  fainted: z.int(),
});

export const journeyColumn = z.object({ milestone: z.string(), record: journeyRecord.nullable() });

export const fallenMon = z.object({
  species: z.string().nullable(),
  gameSpecies: z.string(),
  nickname: z.string().nullable(),
  level: z.int().nullable(),
  from: z.string().nullable(),
  to: z.string(),
});

export const journeyPage = z.object({
  player: z.object({ id: z.string(), name: z.string() }),
  series: z.object({ number: z.number().int(), name: z.string() }),
  columns: z.array(journeyColumn),
  latest: z.string().nullable(),
  fallen: z.array(fallenMon),
});

export type JourneyRecord = z.infer<typeof journeyRecord>;
export type FallenMon = z.infer<typeof fallenMon>;
export type JourneyPage = z.infer<typeof journeyPage>;

type Member = { species: string | null; gameSpecies: string; nickname: string | null; level: number | null; personalId: number | null };

export function fallenAcross(snapshots: { milestone: string; fainted: Member[] }[]): FallenMon[] {
  const fallen: FallenMon[] = [];
  const seen = new Set<number>();
  snapshots.forEach((snapshot, index) => {
    const before = index > 0 ? snapshots[index - 1]!.milestone : null;
    const last = index === snapshots.length - 1;
    for (const member of snapshot.fainted) {
      if (member.personalId === null) {
        if (last) fallen.push(fall(member, null, snapshot.milestone));
        continue;
      }
      if (seen.has(member.personalId)) continue;
      seen.add(member.personalId);
      fallen.push(fall(member, before, snapshot.milestone));
    }
  });
  return fallen;
}

function fall(member: Member, from: string | null, to: string): FallenMon {
  return { species: member.species, gameSpecies: member.gameSpecies, nickname: member.nickname, level: member.level, from, to };
}
