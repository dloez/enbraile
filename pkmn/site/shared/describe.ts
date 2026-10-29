import { Dex, type Species } from "@pkmn/dex";
import { Icons, Sprites } from "@pkmn/img";
import { damageTaken } from "./chart.js";
import { packPc, STATS, tmLabel, TYPES, typeName, type Ability, type BagItem, type BagTm, type Learnable, type Mon, type MoveInfo, type Named, type Nature, type PcView, type StatID } from "./mon.js";
import { BERRY_POCKET, fightItems, setasOf } from "./items.js";
import type { AbilityHolder } from "./abilities.js";
import type { FaintedPokemon, Sheet, SheetPokemon, SheetTm, Snapshot } from "./snapshot.js";
import { dexDesc, dexName, type DexKind } from "./dex-text.js";
import { messages } from "./i18n.js";

const gen = Dex.forGen(9);

const HAND_LABELS = messages<Record<string, string>>({
  en: { tinymushroom: "Mini Seta (Tiny Mushroom)" },
  es: { tinymushroom: "Mini Seta" },
});

function named(kind: DexKind | null, id: string, entry: { exists: boolean; id: string; name: string }): Named {
  if (entry.exists) return { id, name: kind ? dexName(kind, entry.id, entry.name) : entry.name, known: true, marked: false };
  const label = HAND_LABELS[id];
  return { id, name: label ?? id, known: false, marked: label === undefined };
}

const dexId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, "");

function relabel<T extends Named>(kind: DexKind, n: T): T {
  if (!n.known) return HAND_LABELS[n.id] ? { ...n, name: HAND_LABELS[n.id] } : n;
  return { ...n, name: dexName(kind, dexId(n.id), n.name) };
}

function relabelDesc<T extends Named & { desc: string }>(kind: Exclude<DexKind, "natures">, n: T): T {
  return n.known ? { ...relabel(kind, n), desc: dexDesc(kind, dexId(n.id), n.desc) } : relabel(kind, n);
}

export function localizePc(view: PcView): PcView {
  return {
    ...view,
    mons: view.mons.map((m) => ({ ...m, nature: m.nature && relabel("natures", m.nature), abilities: m.abilities.map((a) => relabelDesc("abilities", a)) })),
    moves: Object.fromEntries(Object.entries(view.moves).map(([id, move]) => [id, relabelDesc("moves", move)])),
    items: view.items.map((item) => relabelDesc("items", item)),
    tms: view.tms.map((tm) => ({ ...tm, label: tmLabel(tm.label), move: relabel("moves", tm.move), desc: tm.move.known ? dexDesc("moves", dexId(tm.move.id), tm.desc) : tm.desc })),
  };
}

export function localizeHolders(holders: readonly AbilityHolder[]): AbilityHolder[] {
  return holders.map((h) => ({ ...h, abilities: h.abilities.map((a) => ({ ...a, name: dexName("abilities", dexId(a.id), a.name) })) }));
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

export function describeNature(id: string | null): Nature | null {
  if (id === null) return null;
  const entry = gen.natures.get(id);
  return {
    ...named("natures", id, entry),
    plus: entry.exists && entry.plus ? entry.plus : null,
    minus: entry.exists && entry.minus ? entry.minus : null,
  };
}

export function describeAbility(id: string, hidden = false, current: string | null = null): Ability {
  const entry = gen.abilities.get(id);
  return {
    ...named("abilities", id, entry),
    desc: entry.exists ? dexDesc("abilities", entry.id, entry.shortDesc || entry.desc) : "",
    hidden,
    current: id === current,
  };
}

function abilities(p: SheetPokemon): Ability[] {
  const list = [
    ...(p.abilities?.base ?? []).map((id) => describeAbility(id, false, p.ability)),
    ...(p.abilities?.hidden ?? []).map((id) => describeAbility(id, true, p.ability)),
  ];
  if (p.ability !== null && !list.some((a) => a.id === p.ability)) list.unshift(describeAbility(p.ability, false, p.ability));
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

export function defensesOf(types: readonly string[], abilities: readonly Ability[]): Record<string, number> {
  const current = abilities.find((a) => a.current) ?? abilities[0];
  return Object.fromEntries(TYPES.map((attack) => [attack, damageTaken(9, attack, types, current?.id ?? null)]));
}

export function describePokemon(p: SheetPokemon, index: number, fainted = false): Mon {
  const entry = gen.species.get(p.species);
  const types = p.types.map(typeName);
  const showdownTypes = entry.exists ? [...entry.types] : null;
  const nat = describeNature(p.nature);
  const list = abilities(p);
  return {
    index,
    species: named(null, p.species, entry),
    nickname: p.nickname,
    level: p.level,
    gender: p.gender,
    shiny: p.shiny,
    nature: nat,
    types,
    showdownTypes,
    mismatch: showdownTypes !== null && showdownTypes.join("/") !== types.join("/"),
    filterTypes: showdownTypes ?? types,
    abilities: list,
    defenses: defensesOf(types, list),
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
    free: false,
    fainted,
  };
}

export function describeHolders(pokemon: readonly SheetPokemon[]): AbilityHolder[] {
  return pokemon.map((p, index) => {
    const entry = gen.species.get(p.species);
    return {
      index,
      species: named(null, p.species, entry),
      nickname: p.nickname,
      level: p.level,
      shiny: p.shiny,
      filterTypes: entry.exists ? [...entry.types] : p.types.map(typeName),
      sprite: entry.exists ? Sprites.getPokemon(entry.name, { gen: "gen5", shiny: p.shiny, gender: p.gender === "F" ? "F" : undefined }).url : null,
      abilities: abilities(p).map((a) => ({ id: a.id, name: a.name, hidden: a.hidden, current: a.current })),
    };
  });
}

export function describeItem(i: { item: string; quantity: number; game?: string | null; pocket?: number | null }): BagItem {
  const entry = gen.items.get(i.item);
  const icon = entry.exists ? Icons.getItem(entry.name) : null;
  const berry = i.pocket === undefined || i.pocket === null ? entry.exists && entry.isBerry : i.pocket === BERRY_POCKET;
  return {
    ...named("items", i.item, entry),
    game: i.game ?? null,
    quantity: i.quantity,
    desc: entry.exists ? dexDesc("items", entry.id, entry.shortDesc || entry.desc) : "",
    pocket: berry ? "berries" : "items",
    icon: icon && { left: icon.left, top: icon.top, url: icon.url },
  };
}

export function describeTm(t: SheetTm): BagTm {
  const entry = gen.moves.get(t.move);
  const label = tmLabel(t.item);
  if (!entry.exists) {
    return { label, move: named("moves", t.move, entry), type: null, category: null, power: null, accuracy: null, desc: "" };
  }
  return {
    label,
    move: named("moves", t.move, entry),
    type: entry.type,
    category: entry.category,
    power: entry.basePower || null,
    accuracy: entry.accuracy === true ? null : entry.accuracy,
    desc: dexDesc("moves", entry.id, entry.shortDesc || entry.desc),
  };
}

export function describeMove(id: string): MoveInfo {
  const entry = gen.moves.get(id);
  if (!entry.exists) return { ...named("moves", id, entry), type: null, category: null, power: null, accuracy: null, desc: "" };
  return {
    ...named("moves", id, entry),
    type: entry.type,
    category: entry.category,
    power: entry.basePower || null,
    accuracy: entry.accuracy === true ? null : entry.accuracy,
    desc: dexDesc("moves", entry.id, entry.shortDesc || entry.desc),
  };
}

function describeFainted(list: readonly FaintedPokemon[], from: number): Mon[] {
  return list.flatMap((p, at) => (p.species === null ? [] : [describePokemon({ ...p, species: p.species }, from + at, true)]));
}

export function describePc(sheet: Sheet & { fainted?: readonly FaintedPokemon[]; trainer?: Snapshot["trainer"] }): PcView {
  const living = sheet.pokemon.map((p, index) => describePokemon(p, index));
  return packPc(
    [...living, ...describeFainted(sheet.fainted ?? [], living.length)],
    fightItems(sheet.items).map(describeItem),
    sheet.tms.map(describeTm),
    setasOf(sheet.items),
    sheet.trainer?.money ?? null,
  );
}
