import * as z from "zod";
import type { MoveRule } from "./pool.js";

export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

export type StatID = (typeof STATS)[number];

export const STAT_LABELS: Record<StatID, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

export const TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
] as const;

export type TypeName = (typeof TYPES)[number];

const statId = z.enum(STATS);

const statsTable = z.object({ hp: z.number(), atk: z.number(), def: z.number(), spa: z.number(), spd: z.number(), spe: z.number() });

export const named = z.object({ id: z.string(), name: z.string(), known: z.boolean(), marked: z.boolean() });

export type Named = z.infer<typeof named>;

export const ability = named.extend({ desc: z.string(), hidden: z.boolean(), current: z.boolean() });

export type Ability = z.infer<typeof ability>;

export const nature = named.extend({ plus: statId.nullable(), minus: statId.nullable() });

export type Nature = z.infer<typeof nature>;

export const statLine = z.object({
  stat: statId,
  base: z.number(),
  iv: z.number().nullable(),
  ev: z.number().nullable(),
  current: z.number().nullable(),
  fight: z.number().nullable(),
  low: z.number(),
  high: z.number(),
});

export type StatLine = z.infer<typeof statLine>;

export const moveInfo = named.extend({
  type: z.string().nullable(),
  category: z.string().nullable(),
  power: z.number().nullable(),
  accuracy: z.number().nullable(),
  desc: z.string(),
});

export type MoveInfo = z.infer<typeof moveInfo>;

const learnableOf = <T extends z.ZodType>(move: T) =>
  z.object({ current: z.array(move), relearner: z.array(move), tms: z.array(move), levels: z.record(z.string(), z.number()).nullable() });

export const learnable = learnableOf(moveInfo);

export type Learnable = z.infer<typeof learnable>;

const monFields = {
  index: z.number().int(),
  species: named,
  nickname: z.string().nullable(),
  level: z.number().nullable(),
  gender: z.enum(["M", "F", "N"]).nullable(),
  shiny: z.boolean(),
  nature: nature.nullable(),
  types: z.array(z.string()),
  showdownTypes: z.array(z.string()).nullable(),
  mismatch: z.boolean(),
  filterTypes: z.array(z.string()),
  abilities: z.array(ability),
  defenses: z.record(z.string(), z.number()),
  ivs: statsTable.nullable(),
  stats: z.array(statLine).nullable(),
  sprite: z.string().nullable(),
  free: z.boolean(),
  fainted: z.boolean(),
};

export const mon = z.object({ ...monFields, learnable: learnable.nullable() });

export type Mon = z.infer<typeof mon>;

export type Learn = "yes" | "no";

export const POCKETS = ["items", "berries"] as const;

export type Pocket = (typeof POCKETS)[number];

export const bagItem = named.extend({
  game: z.string().nullable(),
  quantity: z.number(),
  desc: z.string(),
  pocket: z.enum(POCKETS),
  icon: z.object({ left: z.number(), top: z.number(), url: z.string() }).nullable(),
});

export type BagItem = z.infer<typeof bagItem>;

export const bagTm = z.object({
  label: z.string(),
  move: named,
  type: z.string().nullable(),
  category: z.string().nullable(),
  power: z.number().nullable(),
  accuracy: z.number().nullable(),
  desc: z.string(),
});

export type BagTm = z.infer<typeof bagTm>;

export const pcView = z.object({
  mons: z.array(z.object({ ...monFields, learnable: learnableOf(z.string()).nullable() })),
  moves: z.record(z.string(), moveInfo),
  items: z.array(bagItem),
  tms: z.array(bagTm),
  setas: z.int(),
  money: z.int().nullable(),
});

export type PcView = z.infer<typeof pcView>;

export function packPc(mons: readonly Mon[], items: BagItem[], tms: BagTm[], setas: number, money: number | null): PcView {
  const moves: Record<string, MoveInfo> = {};
  const ids = (list: readonly MoveInfo[]) =>
    list.map((move) => {
      moves[move.id] = move;
      return move.id;
    });
  return {
    mons: mons.map((m) => ({
      ...m,
      learnable: m.learnable && { current: ids(m.learnable.current), relearner: ids(m.learnable.relearner), tms: ids(m.learnable.tms), levels: m.learnable.levels },
    })),
    moves,
    items,
    tms,
    setas,
    money,
  };
}

export function unpackPc(view: PcView): Mon[] {
  const move = (id: string): MoveInfo => view.moves[id];
  return view.mons.map((m) => ({
    ...m,
    learnable: m.learnable && { current: m.learnable.current.map(move), relearner: m.learnable.relearner.map(move), tms: m.learnable.tms.map(move), levels: m.learnable.levels },
  }));
}

export function typeName(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
}

export function tmLabel(item: string): string {
  return /^tm\d+$/i.test(item) ? item.toUpperCase() : item;
}

export function tmLabels(tms: readonly { item: string; move: string }[]): Map<string, string> {
  return new Map(tms.map((t) => [t.move, tmLabel(t.item)]));
}

export function allowedMoves(mon: Mon, rule: MoveRule): Learnable | null {
  const l = mon.learnable;
  if (!l) return null;
  if (rule === "known") return { ...l, relearner: [], tms: [] };
  const cap = rule === "level" ? mon.level : rule === "fifty" ? 50 : null;
  if (cap === null || !l.levels) return l;
  const levels = l.levels;
  return { ...l, relearner: l.relearner.filter((m) => levels[m.id] === undefined || levels[m.id] <= cap) };
}

export function canLearn(mon: Mon, move: string, rule: MoveRule): Learn | null {
  const l = allowedMoves(mon, rule);
  if (!l) return null;
  return [l.current, l.relearner, l.tms].some((list) => list.some((m) => m.id === move)) ? "yes" : "no";
}

export function learnCount(l: Learnable): number {
  return new Set([l.current, l.relearner, l.tms].flatMap((list) => list.map((m) => m.id))).size;
}

export function fightStat(s: StatLine): string {
  return s.fight !== null ? String(s.fight) : `${s.low}–${s.high}`;
}

export function displayName(mon: Pick<Mon, "nickname" | "species">): string {
  return mon.nickname ?? mon.species.name;
}

export function moveStats(move: Pick<MoveInfo, "category" | "power" | "accuracy">): string {
  return [move.category, move.power, move.accuracy !== null ? `${move.accuracy}%` : null]
    .filter((part) => part !== null)
    .join(" · ");
}

export function currentAbility(mon: Mon): string | null {
  return mon.abilities.find((a) => a.current)?.id ?? null;
}
