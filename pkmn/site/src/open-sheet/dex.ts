import { Dex, type StatID } from "@pkmn/dex";
import { Icons, Sprites } from "@pkmn/img";
import type { SheetItem, SheetPokemon, SheetTm } from "@/open-sheet/schema";

const gen = Dex.forGen(9);

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
  stats: StatLine[] | null;
  sprite: string | null;
}

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

export function statAt(stat: StatID, base: number, iv: number, nature: Nature | null, level = 50, ev = 1): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
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
    stats: entry.exists
      ? STATS.map((stat) => ({
          stat,
          base: entry.baseStats[stat],
          low: statAt(stat, entry.baseStats[stat], 0, nat),
          high: statAt(stat, entry.baseStats[stat], 31, nat),
        }))
      : null,
    sprite: entry.exists
      ? Sprites.getPokemon(entry.name, {
          gen: "gen5",
          shiny: p.shiny,
          gender: p.gender === "F" ? "F" : undefined,
        }).url
      : null,
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

export function displayName(mon: Mon): string {
  return mon.nickname ?? mon.species.name;
}
