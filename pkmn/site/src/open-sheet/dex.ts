import { Dex, type Species, type StatID, type StatsTable } from "@pkmn/dex";
import { Icons, Sprites } from "@pkmn/img";
import type { SheetItem, SheetPokemon, SheetTm } from "@/open-sheet/schema";

const gen = Dex.forGen(9);

export const STATS: readonly StatID[] = ["hp", "atk", "def", "spa", "spd", "spe"];

export const STAT_LABELS: Record<StatID, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

const HAND_LABELS: Record<string, string> = {
  tinymushroom: "Mini Seta (Tiny Mushroom)",
};

export interface Named {
  id: string;
  name: string;
  known: boolean;
  marked: boolean;
}

export interface Ability extends Named {
  desc: string;
  hidden: boolean;
  current: boolean;
}

export interface Nature extends Named {
  plus: StatID | null;
  minus: StatID | null;
}

export interface StatLine {
  stat: StatID;
  base: number;
  iv: number | null;
  ev: number | null;
  current: number | null;
  fight: number | null;
  low: number;
  high: number;
}

export interface Mon {
  index: number;
  species: Named;
  nickname: string | null;
  level: number | null;
  gender: SheetPokemon["gender"];
  shiny: boolean;
  nature: Nature | null;
  types: string[];
  showdownTypes: string[] | null;
  mismatch: boolean;
  filterTypes: string[];
  abilities: Ability[];
  ivs: StatsTable | null;
  stats: StatLine[] | null;
  sprite: string | null;
  learnable: Learnable | null;
}

export interface Learnable {
  current: MoveInfo[];
  relearner: MoveInfo[];
  tms: MoveInfo[];
  levels: Record<string, number> | null;
}

export type Learn = "yes" | "no";

export type Pocket = "items" | "berries";

export interface BagItem extends Named {
  quantity: number;
  desc: string;
  pocket: Pocket;
  icon: { left: number; top: number; url: string } | null;
}

export interface BagTm {
  label: string;
  move: Named;
  type: string | null;
  category: string | null;
  power: number | null;
  accuracy: number | null;
  desc: string;
}

export function typeName(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
}

function named(id: string, entry: { exists: boolean; name: string }): Named {
  if (entry.exists) return { id, name: entry.name, known: true, marked: false };
  const label = HAND_LABELS[id];
  return { id, name: label ?? id, known: false, marked: label === undefined };
}

export function statAt(
  stat: StatID,
  species: Pick<Species, "baseStats" | "maxHP">,
  iv: number,
  nature: Nature | null,
  level = 50,
  ev = 1,
): number {
  if (stat === "hp" && species.maxHP !== undefined) return species.maxHP;
  const core = Math.floor(((2 * species.baseStats[stat] + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === "hp") return core + level + 10;
  const value = core + 5;
  if (nature?.plus === stat) return Math.floor(value * 1.1);
  if (nature?.minus === stat) return Math.floor(value * 0.9);
  return value;
}

function nature(id: string | null): Nature | null {
  if (id === null) return null;
  const entry = gen.natures.get(id);
  return {
    ...named(id, entry),
    plus: entry.exists && entry.plus ? entry.plus : null,
    minus: entry.exists && entry.minus ? entry.minus : null,
  };
}

function ability(id: string, hidden: boolean, current: string | null): Ability {
  const entry = gen.abilities.get(id);
  return {
    ...named(id, entry),
    desc: entry.exists ? entry.shortDesc || entry.desc : "",
    hidden,
    current: id === current,
  };
}

function abilities(p: SheetPokemon): Ability[] {
  const list = [
    ...(p.abilities?.base ?? []).map((id) => ability(id, false, p.ability)),
    ...(p.abilities?.hidden ?? []).map((id) => ability(id, true, p.ability)),
  ];
  if (p.ability !== null && !list.some((a) => a.id === p.ability)) list.unshift(ability(p.ability, false, p.ability));
  return list;
}

function learnable(p: SheetPokemon): Learnable | null {
  if (!p.moves) return null;
  return {
    current: p.moves.current.map(describeMove),
    relearner: p.moves.relearner.map(describeMove).sort((a, b) => (p.moves?.levels?.[a.id] ?? 0) - (p.moves?.levels?.[b.id] ?? 0)),
    tms: p.moves.tms.map(describeMove),
    levels: p.moves.levels ?? null,
  };
}

export function canLearn(mon: Mon, move: string): Learn | null {
  const l = mon.learnable;
  if (!l) return null;
  return [l.current, l.relearner, l.tms].some((list) => list.some((m) => m.id === move)) ? "yes" : "no";
}

export function learnCount(l: Learnable): number {
  return new Set([l.current, l.relearner, l.tms].flatMap((list) => list.map((m) => m.id))).size;
}

export function tmLabels(tms: readonly SheetTm[]): Map<string, string> {
  return new Map(tms.map((t) => [t.move, describeTm(t).label]));
}

export function describePokemon(p: SheetPokemon, index: number): Mon {
  const entry = gen.species.get(p.species);
  const types = p.types.map(typeName);
  const showdownTypes = entry.exists ? [...entry.types] : null;
  const nat = nature(p.nature);
  return {
    index,
    species: named(p.species, entry),
    nickname: p.nickname,
    level: p.level,
    gender: p.gender,
    shiny: p.shiny,
    nature: nat,
    types,
    showdownTypes,
    mismatch: showdownTypes !== null && showdownTypes.join("/") !== types.join("/"),
    filterTypes: showdownTypes ?? types,
    abilities: abilities(p),
    ivs: p.ivs,
    stats: entry.exists
      ? STATS.map((stat) => ({
          stat,
          base: entry.baseStats[stat],
          iv: p.ivs?.[stat] ?? null,
          ev: p.evs?.[stat] ?? null,
          current: p.stats?.[stat] ?? null,
          fight: p.ivs ? statAt(stat, entry, p.ivs[stat], nat) : null,
          low: statAt(stat, entry, 0, nat),
          high: statAt(stat, entry, 31, nat),
        }))
      : null,
    sprite: entry.exists
      ? Sprites.getPokemon(entry.name, {
          gen: "gen5",
          shiny: p.shiny,
          gender: p.gender === "F" ? "F" : undefined,
        }).url
      : null,
    learnable: learnable(p),
  };
}

export function describeItem(i: SheetItem): BagItem {
  const entry = gen.items.get(i.item);
  const icon = entry.exists ? Icons.getItem(entry.name) : null;
  return {
    ...named(i.item, entry),
    quantity: i.quantity,
    desc: entry.exists ? entry.shortDesc || entry.desc : "",
    pocket: entry.exists && entry.isBerry ? "berries" : "items",
    icon: icon && { left: icon.left, top: icon.top, url: icon.url },
  };
}

export function describeTm(t: SheetTm): BagTm {
  const entry = gen.moves.get(t.move);
  const label = /^tm\d+$/i.test(t.item) ? t.item.toUpperCase() : t.item;
  if (!entry.exists) {
    return { label, move: named(t.move, entry), type: null, category: null, power: null, accuracy: null, desc: "" };
  }
  return {
    label,
    move: named(t.move, entry),
    type: entry.type,
    category: entry.category,
    power: entry.basePower || null,
    accuracy: entry.accuracy === true ? null : entry.accuracy,
    desc: entry.shortDesc || entry.desc,
  };
}

export function fightStat(s: StatLine): string {
  return s.fight !== null ? String(s.fight) : `${s.low}–${s.high}`;
}

export function displayName(mon: Mon): string {
  return mon.nickname ?? mon.species.name;
}

export interface MoveInfo extends Named {
  type: string | null;
  category: string | null;
  power: number | null;
  accuracy: number | null;
  desc: string;
}

export function describeMove(id: string): MoveInfo {
  const entry = gen.moves.get(id);
  if (!entry.exists) return { ...named(id, entry), type: null, category: null, power: null, accuracy: null, desc: "" };
  return {
    ...named(id, entry),
    type: entry.type,
    category: entry.category,
    power: entry.basePower || null,
    accuracy: entry.accuracy === true ? null : entry.accuracy,
    desc: entry.shortDesc || entry.desc,
  };
}

export function moveStats(move: Pick<MoveInfo, "category" | "power" | "accuracy">): string {
  return [move.category, move.power, move.accuracy !== null ? `${move.accuracy}%` : null]
    .filter((part) => part !== null)
    .join(" · ");
}

export const MOVES: readonly MoveInfo[] = [
  ...new Map(
    gen.moves
      .all()
      .filter((move) => move.num > 0 && move.gen <= 5 && move.id !== "struggle")
      .map((move) => [move.id, describeMove(move.id)] as const),
  ).values(),
].sort((a, b) => a.name.localeCompare(b.name));

export function currentAbility(mon: Mon): string | null {
  return mon.abilities.find((a) => a.current)?.id ?? null;
}

export function describeMember(species: string | null, gameSpecies: string): { name: string; sprite: string | null } {
  const entry = species === null ? null : gen.species.get(species);
  if (!entry?.exists) return { name: gameSpecies, sprite: null };
  return { name: entry.name, sprite: Sprites.getPokemon(entry.name, { gen: "gen5" }).url };
}
