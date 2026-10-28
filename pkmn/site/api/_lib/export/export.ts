import { randomInt } from "node:crypto";
import type { Messages } from "../../../shared/i18n.js";
import type { FaintedPokemon, Json, PokemonDetails, SaveDetails, SheetItem, SheetPokemon, SheetTm, Snapshot, SnapshotMember } from "../../../shared/snapshot.js";
import DATA from "./data.json" with { type: "json" };
import { hashGet, isHash, isInt, MarshalError, MarshalReader, MarshalWriter, type RubyHash, RubyObject, RubySymbol, text, truthy } from "./marshal.js";
import { plain, plainIvars, rubyTime, type Shaper } from "./plain.js";

type ExportData = {
  randomlocke_version: number;
  showdown: Record<"species" | "abilities" | "items" | "moves" | "natures", Record<string, string>>;
  types: Record<string, string[]>;
  fixed_abilities: Record<string, { base: string[]; hidden: string[] }>;
  pockets: Record<string, number>;
  tm_moves: Record<string, string>;
  move_types: Record<string, string>;
  evolutions: Record<string, [string, string, string | number | null][]>;
};

const data: ExportData = DATA as unknown as ExportData;

const showdown = data.showdown;

export class ExportError extends Error {
  constructor(readonly texts: Messages<string>) {
    super(texts.en);
  }
}

const GENDERS: Record<number, "M" | "F" | "N"> = { 0: "M", 1: "F", 2: "N" };
const SHINY_CHANCE = 65;
const TM_POCKET = 4;
const SAME_TYPE_TM_CHANCE = 70;
const OTHER_TYPE_TM_CHANCE = 40;
const MAX_IV = 31;
const POCKETS = 8;
const SAVE_STATS = { hp: "HP", atk: "ATTACK", def: "DEFENSE", spa: "SPECIAL_ATTACK", spd: "SPECIAL_DEFENSE", spe: "SPEED" } as const;
const STAT_FIELDS = { hp: "totalhp", atk: "attack", def: "defense", spa: "spatk", spd: "spdef", spe: "speed" } as const;

type Spread = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };

type Save = Map<unknown, unknown>;

export type Compatibility = Map<string, [string, boolean][]>;

export type TmRolls = [string, [string, boolean][]][];

type MovesContext = {
  learnsets: unknown;
  perForm: boolean;
  compatibility: Compatibility;
  bagTms: string[];
  tmMap: unknown;
};

function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

function object(value: unknown): RubyObject | undefined {
  return value instanceof RubyObject ? value : undefined;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function intOrNull(value: unknown): number | null {
  return isInt(value) ? value : null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function readSave(bytes: Uint8Array, label: string): Save {
  let save: unknown;
  try {
    save = new MarshalReader(bytes).load();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ExportError({
      en: `Could not read ${label} (${reason}). If the game was saving, let it finish and upload again.`,
      es: `No se pudo leer ${label} (${reason}). Si el juego estaba guardando, espera a que termine y vuelve a subirla.`,
    });
  }
  if (!isHash(save) || !(save.get("player") instanceof RubyObject)) throw new ExportError({ en: `${label} is not a Pokémon Añil save.`, es: `${label} no es una partida de Pokémon Añil.` });
  return save;
}

function player(save: Save): RubyObject {
  return save.get("player") as RubyObject;
}

function metadataOf(save: Save): RubyObject {
  return object(save.get("global_metadata")) ?? new RubyObject("PokemonGlobalMetadata");
}

function speciesForm(pokemon: RubyObject): string {
  let form = pokemon.get("forced_form");
  if (form === null || form === undefined) form = truthy(pokemon.get("form")) ? pokemon.get("form") : 0;
  const species = text(pokemon.get("species"));
  return truthy(form) ? `${species}_${text(form)}` : species;
}

function isShiny(pokemon: RubyObject): boolean {
  const shiny = pokemon.get("shiny");
  if (shiny !== null && shiny !== undefined) return truthy(shiny);
  const ownerId = object(pokemon.get("owner"))?.get("id");
  const personal = pokemon.get("personalID");
  if (!isInt(ownerId) || !isInt(personal)) return false;
  const mixed = Number((BigInt(personal) ^ BigInt(ownerId)) & 0xffffffffn);
  return ((mixed & 0xffff) ^ ((mixed >>> 16) & 0xffff)) < SHINY_CHANCE;
}

function capsuleList(pokemon: RubyObject, capsules: unknown): unknown[][] | null {
  if (!isHash(capsules)) return null;
  const key = pokemon.get("id");
  const rolled = hashGet(capsules, key);
  return key !== null && key !== undefined && Array.isArray(rolled) ? (rolled as unknown[][]) : null;
}

function abilityLists(gameId: string, pokemon: RubyObject, table: RubyHash, capsules: unknown): { base: string[]; hidden: string[] } | null {
  const rolled = capsuleList(pokemon, capsules);
  if (rolled !== null) {
    return {
      base: rolled.filter((entry) => (entry[1] as number) < 2).map((entry) => text(entry[0])),
      hidden: rolled.filter((entry) => (entry[1] as number) >= 2).map((entry) => text(entry[0])),
    };
  }
  const fixed = own(data.fixed_abilities, gameId);
  if (fixed) return fixed;
  const entry = hashGet(table, gameId);
  if (!isHash(entry)) return null;
  return {
    base: list(entry.get("base")).filter(truthy).map(text),
    hidden: list(entry.get("hidden")).filter(truthy).map(text),
  };
}

function currentAbility(pokemon: RubyObject, lists: { base: string[]; hidden: string[] } | null, capsules: unknown): string | null {
  const rolled = capsuleList(pokemon, capsules);
  if (rolled && rolled.length > 0) {
    const index = pokemon.get("ability_index");
    if (index !== null && index !== undefined) {
      for (const [ability, slot] of rolled) if (slot === index) return text(ability);
    }
    return text(rolled[0][0]);
  }
  if (truthy(pokemon.get("forced_ability"))) return text(pokemon.get("forced_ability"));
  if (truthy(pokemon.get("ability"))) return text(pokemon.get("ability"));
  if (lists === null) return null;
  const personal = pokemon.get("personalID");
  const personalBit = isInt(personal) ? personal % 2 : 0;
  const stored = pokemon.get("ability_index");
  let index = isInt(stored) ? stored : personalBit;
  if (index >= 2) {
    if (index - 2 < lists.hidden.length) return lists.hidden[index - 2];
    index = personalBit;
  }
  if (index < lists.base.length) return lists.base[index];
  return lists.base[0] ?? null;
}

function missedEvolutions(gameId: string, pokemon: RubyObject, level: unknown, gender: unknown): Map<string, string[]> {
  const personal = isInt(pokemon.get("personalID")) ? (pokemon.get("personalID") as number) : 0;
  const attack = isInt(pokemon.get("attack")) ? (pokemon.get("attack") as number) : 0;
  const defense = isInt(pokemon.get("defense")) ? (pokemon.get("defense") as number) : 0;
  const high = Math.floor(personal / 65536) % 65536;
  const checks: Record<string, boolean> = {
    LevelMale: gender === 0,
    LevelFemale: gender === 1,
    ItemMale: gender === 0,
    ItemFemale: gender === 1,
    AttackGreater: attack > defense,
    AtkDefEqual: attack === defense,
    DefenseGreater: attack < defense,
    Silcoon: high % 10 < 5,
    Cascoon: high % 10 >= 5,
  };
  const missed = new Map<string, string[]>();
  for (const [target, method, needed] of own(data.evolutions, gameId) ?? []) {
    if (Object.hasOwn(checks, method) && !checks[method]) continue;
    const ways = missed.get(target) ?? [];
    if (typeof needed === "number") {
      if (isInt(level) && level >= needed) {
        ways.push(`level ${needed}`);
        missed.set(target, ways);
      }
    } else {
      ways.push(needed ? `${method} ${needed}` : method);
      missed.set(target, ways);
    }
  }
  return missed;
}

function statTable(values: Record<keyof Spread, unknown>): Spread | null {
  return Object.values(values).every(isInt) ? (values as Spread) : null;
}

function spreads(pokemon: RubyObject): [Spread | null, Spread | null, Spread | null] {
  const iv = isHash(pokemon.get("iv")) ? (pokemon.get("iv") as RubyHash) : new Map();
  const ev = isHash(pokemon.get("ev")) ? (pokemon.get("ev") as RubyHash) : new Map();
  const maxed = isHash(pokemon.get("ivMaxed")) ? (pokemon.get("ivMaxed") as RubyHash) : new Map();
  const keys = Object.keys(SAVE_STATS) as (keyof Spread)[];
  const by = (pick: (stat: keyof Spread) => unknown) => Object.fromEntries(keys.map((stat) => [stat, pick(stat)])) as Record<keyof Spread, unknown>;
  return [
    statTable(by((stat) => (truthy(maxed.get(SAVE_STATS[stat])) ? MAX_IV : iv.get(SAVE_STATS[stat])))),
    statTable(by((stat) => ev.get(SAVE_STATS[stat]))),
    statTable(by((stat) => pokemon.get(STAT_FIELDS[stat]))),
  ];
}

function hatched(pokemon: unknown): pokemon is RubyObject {
  if (!(pokemon instanceof RubyObject)) return false;
  const steps = pokemon.get("steps_to_hatch");
  return !truthy(steps) || (steps as number) <= 0;
}

function boxesOf(save: Save): unknown[] {
  const storage = object(save.get("storage_system"));
  return storage ? list(storage.get("boxes")) : [];
}

function dayCareSlots(save: Save): RubyObject[] {
  return list(object(metadataOf(save).get("day_care"))?.get("slots")).filter((slot): slot is RubyObject => slot instanceof RubyObject);
}

function storedPokemon(save: Save): RubyObject[] {
  const found: unknown[] = [...list(player(save).get("party"))];
  for (const box of boxesOf(save)) found.push(...list(object(box)?.get("pokemon")));
  for (const slot of dayCareSlots(save)) found.push(slot.get("pokemon"));
  return found.filter(hatched);
}

function shuffled<T>(values: T[]): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fainted(pokemon: RubyObject): boolean {
  return truthy(pokemon.get("perma_faint"));
}

function moveId(move: unknown): string | null {
  const value = move instanceof RubyObject ? move.get("id") : move;
  return truthy(value) ? text(value) : null;
}

function tmMove(gameId: string, tmMap: unknown): string | null {
  const rolled = isHash(tmMap) ? hashGet(tmMap, gameId) : undefined;
  if (rolled instanceof RubyObject && truthy(rolled.get("id"))) return text(rolled.get("id"));
  return own(data.tm_moves, gameId) ?? null;
}

function pockets(save: Save): unknown[] {
  const bag = object(save.get("bag"));
  return bag ? list(bag.get("pockets")) : [];
}

function itemEntries(value: unknown): [string, number][] {
  return list(value)
    .filter((entry): entry is unknown[] => Array.isArray(entry) && entry.length === 2 && truthy(entry[0]) && isInt(entry[1]))
    .map((entry) => [text(entry[0]), entry[1] as number]);
}

function bagEntries(save: Save): [string, number][] {
  return pockets(save).flatMap(itemEntries);
}

function heldItems(stored: RubyObject[]): [string, number][] {
  return stored.filter((pokemon) => truthy(pokemon.get("item"))).map((pokemon) => [text(pokemon.get("item")), 1]);
}

function pcItems(save: Save): [string, number][] {
  return itemEntries(object(metadataOf(save).get("pcItemStorage"))?.get("items"));
}

function bagTms(save: Save): string[] {
  const all = pockets(save);
  const pocket = all.length > TM_POCKET && Array.isArray(all[TM_POCKET]) ? (all[TM_POCKET] as unknown[]) : [];
  return pocket
    .filter((entry): entry is unknown[] => Array.isArray(entry) && entry.length > 0 && own(data.tm_moves, text(entry[0])) !== undefined)
    .map((entry) => text(entry[0]));
}

function sheetItem(gameId: string, quantity: number): SheetItem {
  return { item: gameId, showdown: own(showdown.items, gameId) ?? null, pocket: own(data.pockets, gameId) ?? null, quantity };
}

const showdownItems = new Map<string, string>();
for (const [gameId, id] of Object.entries(showdown.items)) if (!showdownItems.has(id)) showdownItems.set(id, gameId);

export function itemFromShowdown(id: string, quantity: number): SheetItem {
  const gameId = showdownItems.get(id);
  return gameId ? sheetItem(gameId, quantity) : { item: id.toUpperCase(), showdown: id, pocket: null, quantity };
}

function exportItems(save: Save, stored: RubyObject[]): SheetItem[] {
  const counts = new Map<string, number>();
  for (const [gameId, quantity] of [...bagEntries(save), ...heldItems(stored), ...pcItems(save)]) {
    if (quantity > 0) counts.set(gameId, (counts.get(gameId) ?? 0) + quantity);
  }
  return [...counts].map(([gameId, quantity]) => sheetItem(gameId, quantity));
}

function exportTms(save: Save, stored: RubyObject[], tmMap: unknown, notices: string[]): SheetTm[] {
  const tms = new Map<string, string>();
  const unnamedMoves: string[] = [];
  for (const [gameId] of [...bagEntries(save), ...heldItems(stored), ...pcItems(save)]) {
    if (own(data.pockets, gameId) !== TM_POCKET || own(data.tm_moves, gameId) === undefined) continue;
    const item = own(showdown.items, gameId);
    if (item === undefined || tms.has(item) || unnamedMoves.includes(gameId)) continue;
    const move = tmMove(gameId, tmMap);
    const named = move ? own(showdown.moves, move) : undefined;
    if (named === undefined) {
      unnamedMoves.push(gameId);
      notices.push(`Left out ${gameId}: its move ${text(move)} has no Showdown ID.`);
      continue;
    }
    tms.set(item, named);
  }
  return [...tms].map(([item, move]) => ({ item, move }));
}

export function sideFileName(save: Save): string {
  const slot = player(save).get("save_slot");
  return truthy(slot) ? `tm_compatibility_${text(slot).replace(/[^a-zA-Z0-9]/g, "_")}.dat` : "tm_compatibility.dat";
}

function tmCompatibility(side: Uint8Array | null, label: string, metadata: RubyObject, notices: string[]): Compatibility {
  let raw = metadata.get("tm_compatibility_random");
  if (side !== null) {
    try {
      raw = new MarshalReader(side).load();
    } catch (error) {
      const reason = error instanceof MarshalError || error instanceof Error ? error.message : String(error);
      notices.push(`Could not read ${label} (${reason}); TM compatibility comes from the save instead.`);
    }
  }
  const compatibility: Compatibility = new Map();
  if (!isHash(raw)) return compatibility;
  for (const [species, pairs] of raw) {
    if (!Array.isArray(pairs)) continue;
    const kept: [string, boolean][] = [];
    for (const entry of pairs) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const move = moveId(entry[0]);
      if (move) kept.push([move, truthy(entry[1])]);
    }
    compatibility.set(text(species), kept);
  }
  return compatibility;
}

export function storedRolls(compatibility: Compatibility): TmRolls {
  return [...compatibility].map(([species, pairs]) => [species, pairs.map(([move, compatible]) => [move, compatible] as [string, boolean])]);
}

function seeded(rolls: TmRolls): Compatibility {
  return new Map(rolls.map(([species, pairs]) => [species, pairs.map(([move, compatible]) => [move, compatible] as [string, boolean])]));
}

export function sideFile(compatibility: Compatibility): Uint8Array {
  return new MarshalWriter().dump(
    new Map([...compatibility].map(([species, pairs]) => [new RubySymbol(species), pairs.map(([move, compatible]) => [new RubySymbol(move), compatible])])),
  );
}

function rollTms(compatibility: Compatibility, pokemon: RubyObject[], save: Save, tmMap: unknown): number {
  let rolled = 0;
  const tms = bagTms(save);
  for (const member of pokemon) {
    const types = data.types[speciesForm(member)];
    const species = text(member.get("species"));
    const pairs = compatibility.get(species) ?? [];
    compatibility.set(species, pairs);
    const checked = new Set(pairs.map(([move]) => move));
    for (const gameId of tms) {
      const move = tmMove(gameId, tmMap);
      if (move === null || checked.has(move)) continue;
      const moveType = own(data.move_types, move);
      const chance = moveType !== undefined && types.includes(moveType) ? SAME_TYPE_TM_CHANCE : OTHER_TYPE_TM_CHANCE;
      pairs.push([move, Math.floor(Math.random() * 100) < chance]);
      checked.add(move);
      rolled += 1;
    }
  }
  return rolled;
}

function relearnerMoves(pokemon: RubyObject, learnsets: unknown, perForm: boolean, label: string, notices: string[]): { moves: string[]; levels: Map<string, number> } {
  const found: (string | null)[] = list(pokemon.get("first_moves")).map(moveId);
  let form = pokemon.get("forced_form");
  if (form === null || form === undefined) form = truthy(pokemon.get("form")) ? pokemon.get("form") : 0;
  const forms = isHash(learnsets) ? hashGet(learnsets, text(pokemon.get("species"))) : undefined;
  let learnset = isHash(forms) ? hashGet(forms, perForm ? form : 0) : undefined;
  if (!Array.isArray(learnset)) {
    notices.push(`The learnset of ${label} has not been rolled yet; its relearner moves are its first moves only.`);
    learnset = [];
  }
  const levels = new Map<string, number>();
  for (const entry of learnset as unknown[]) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const move = moveId(entry[1]);
    found.push(move);
    if (move && isInt(entry[0]) && !(levels.get(move)! <= entry[0])) levels.set(move, entry[0]);
  }
  return { moves: unique(found.filter((move): move is string => !!move)), levels };
}

function learnableMoves(pokemon: RubyObject, context: MovesContext, label: string, notices: string[]): NonNullable<SheetPokemon["moves"]> {
  const { moves: relearner, levels } = relearnerMoves(pokemon, context.learnsets, context.perForm, label, notices);
  const species = text(pokemon.get("species"));
  const rolled = new Map(context.compatibility.get(species) ?? []);
  const current = unique(
    list(pokemon.get("moves"))
      .filter((move): move is RubyObject => move instanceof RubyObject)
      .map((move) => moveId(move.get("id"))),
  ).filter((move): move is string => !!move);
  const known = new Set(current);
  const tms: string[] = [];
  for (const gameId of context.bagTms) {
    const move = tmMove(gameId, context.tmMap);
    if (move === null || relearner.includes(move) || tms.includes(move)) continue;
    if (known.has(move) || rolled.get(move)) tms.push(move);
  }
  const names = showdown.moves;
  for (const move of unique([...current, ...relearner, ...tms])) {
    if (own(names, move) === undefined) notices.push(`Left out the move ${move} of ${label}: it has no Showdown ID.`);
  }
  const named = (moves: string[]) => moves.filter((move) => own(names, move) !== undefined).map((move) => names[move]);
  const learnedAt = Object.fromEntries(relearner.filter((move) => levels.has(move) && own(names, move) !== undefined).map((move) => [names[move], levels.get(move)!]));
  return { current: named(current), relearner: named(relearner), tms: named(tms), levels: learnedAt };
}

function gameIdOrNull(value: unknown): string | null {
  return truthy(value) ? text(value) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

const SITTING = ["hp", "status", "statusCount", "expshare", "legacy_data", "last_update_time"];

function sitting(pokemon: RubyObject): Json {
  return { personalId: intOrNull(pokemon.get("personalID")), gameSpecies: speciesForm(pokemon), ...plainIvars(pokemon, new Set([...pokemon.ivars.keys()].map((key) => key.replace(/^@/, "")).filter((key) => !SITTING.includes(key)))) };
}

const DETAILED = new Set([
  "species", "form", "forced_form", "name", "level", "gender", "shiny", "nature", "nature_for_stats", "iv", "ivMaxed", "ev",
  "totalhp", "attack", "defense", "spatk", "spdef", "speed", "moves", "first_moves", "personalID", "item", "hp", "status", "exp",
  "happiness", "poke_ball", "ability_index", "owner", "obtain_method", "obtain_map", "obtain_level", "obtain_text", "timeReceived",
  "hatched_map", "timeEggHatched", "pokerus", "markings", "ribbons", "cool", "beauty", "cute", "smart", "tough", "sheen", "expshare",
  "super_shiny", ...SITTING,
]);

function details(pokemon: RubyObject): PokemonDetails {
  const item = gameIdOrNull(pokemon.get("item"));
  const owner = object(pokemon.get("owner"));
  const minted = truthy(pokemon.get("nature_for_stats")) ? gameIdOrNull(pokemon.get("nature")) : null;
  return {
    gameSpecies: speciesForm(pokemon),
    form: intOrNull(pokemon.get("forced_form") ?? pokemon.get("form")),
    heldItem: item ? { item, showdown: own(showdown.items, item) ?? null } : null,
    exp: intOrNull(pokemon.get("exp")),
    happiness: intOrNull(pokemon.get("happiness")),
    ball: gameIdOrNull(pokemon.get("poke_ball")),
    mintedFrom: minted ? (own(showdown.natures, minted) ?? null) : null,
    abilityIndex: intOrNull(pokemon.get("ability_index")),
    moveSlots: list(pokemon.get("moves"))
      .filter((move): move is RubyObject => move instanceof RubyObject && moveId(move.get("id")) !== null)
      .map((move) => {
        const id = moveId(move.get("id")) as string;
        return { move: id, showdown: own(showdown.moves, id) ?? null, pp: intOrNull(move.get("pp")), ppUp: intOrNull(move.get("ppup")) };
      }),
    firstMoves: list(pokemon.get("first_moves"))
      .map(moveId)
      .filter((move): move is string => move !== null),
    owner: owner ? { name: stringOrNull(owner.get("name")), id: intOrNull(owner.get("id")), gender: intOrNull(owner.get("gender")) } : null,
    obtained: {
      method: intOrNull(pokemon.get("obtain_method")),
      map: intOrNull(pokemon.get("obtain_map")),
      level: intOrNull(pokemon.get("obtain_level")),
      text: stringOrNull(pokemon.get("obtain_text")),
      at: intOrNull(pokemon.get("timeReceived")),
      hatchedMap: intOrNull(pokemon.get("hatched_map")),
      hatchedAt: intOrNull(pokemon.get("timeEggHatched")),
    },
    pokerus: intOrNull(pokemon.get("pokerus")),
    markings: list(pokemon.get("markings")).filter(isInt),
    ribbons: list(pokemon.get("ribbons")).filter(truthy).map(text),
    contest: {
      cool: intOrNull(pokemon.get("cool")),
      beauty: intOrNull(pokemon.get("beauty")),
      cute: intOrNull(pokemon.get("cute")),
      smart: intOrNull(pokemon.get("smart")),
      tough: intOrNull(pokemon.get("tough")),
      sheen: intOrNull(pokemon.get("sheen")),
    },
    superShiny: pokemon.get("super_shiny") === true,
    rest: plainIvars(pokemon, DETAILED),
  };
}

function exportPokemon(pokemon: RubyObject, table: RubyHash, capsules: unknown, moves: MovesContext, notices: string[]): SheetPokemon | null {
  const gameId = speciesForm(pokemon);
  const level = pokemon.get("level");
  const label = `${gameId} (level ${text(level)})`;
  const species = own(showdown.species, gameId);
  if (species === undefined) {
    notices.push(`Left out ${label}: ${gameId} has no Showdown species.`);
    return null;
  }
  return { species, ...pokemonFields(pokemon, gameId, label, table, capsules, moves, notices), details: details(pokemon) };
}

function exportFainted(pokemon: RubyObject, table: RubyHash, capsules: unknown, moves: MovesContext): FaintedPokemon {
  const gameId = speciesForm(pokemon);
  const unshown: string[] = [];
  return {
    species: own(showdown.species, gameId) ?? null,
    gameSpecies: gameId,
    ...pokemonFields(pokemon, gameId, gameId, table, capsules, moves, unshown),
    details: details(pokemon),
  };
}

function pokemonFields(
  pokemon: RubyObject,
  gameId: string,
  label: string,
  table: RubyHash,
  capsules: unknown,
  moves: MovesContext,
  notices: string[],
): Omit<SheetPokemon, "species" | "details" | "personalId"> & { personalId: number | null } {
  const level = pokemon.get("level");
  const lists = abilityLists(gameId, pokemon, table, capsules);
  const ability = currentAbility(pokemon, lists, capsules);
  let named: { base: string[]; hidden: string[] } | null = null;
  if (lists !== null) {
    const base = lists.base.map((id) => own(showdown.abilities, id));
    const hidden = lists.hidden.map((id) => own(showdown.abilities, id));
    if (!base.includes(undefined) && !hidden.includes(undefined)) named = { base: base as string[], hidden: hidden as string[] };
  }
  if (named === null) notices.push(`No rolled abilities found for ${label}; exported without them.`);
  const current = ability ? (own(showdown.abilities, ability) ?? null) : null;
  if (current === null) {
    const reason = ability ? `${ability} has no Showdown ID` : "it could not be worked out";
    notices.push(`The current ability of ${label} was not exported: ${reason}.`);
  }
  const gender = pokemon.get("gender");
  const nature = truthy(pokemon.get("nature_for_stats")) ? pokemon.get("nature_for_stats") : pokemon.get("nature");
  for (const [field, value] of [["level", level], ["gender", gender], ["nature", nature]] as const) {
    if (value === null || value === undefined) notices.push(`The save has not filled in the ${field} of ${label}; exported without it.`);
  }
  const [ivs, evs, stats] = spreads(pokemon);
  for (const [field, value] of [["IVs", ivs], ["EVs", evs], ["stats", stats]] as const) {
    if (value === null) notices.push(`The save has not filled in the ${field} of ${label}; exported without them.`);
  }
  for (const [target, ways] of missedEvolutions(gameId, pokemon, level, gender)) {
    notices.push(`${label} has not evolved into ${target} (${ways.join(", ")}).`);
  }
  const nickname = pokemon.get("name");
  return {
    nickname: truthy(nickname) ? text(nickname) : null,
    gender: isInt(gender) ? (GENDERS[gender] ?? null) : null,
    shiny: isShiny(pokemon),
    level: intOrNull(level),
    nature: nature !== null && nature !== undefined ? (own(showdown.natures, text(nature)) ?? null) : null,
    ability: current,
    abilities: named,
    types: data.types[gameId] ?? [],
    ivs,
    evs,
    stats,
    moves: learnableMoves(pokemon, moves, label, notices),
    personalId: intOrNull(pokemon.get("personalID")),
  };
}

function member(pokemon: RubyObject): SnapshotMember {
  const gameId = speciesForm(pokemon);
  const nickname = pokemon.get("name");
  return {
    species: own(showdown.species, gameId) ?? null,
    gameSpecies: gameId,
    nickname: truthy(nickname) ? text(nickname) : null,
    level: intOrNull(pokemon.get("level")),
    personalId: intOrNull(pokemon.get("personalID")),
  };
}

function bag(save: Save): Snapshot["bag"] {
  const all = pockets(save);
  return Array.from({ length: POCKETS }, (_, index) => {
    const pocket = index + 1;
    const entries = Array.isArray(all[pocket]) ? (all[pocket] as unknown[]) : [];
    return {
      pocket,
      items: entries
        .filter((entry): entry is unknown[] => Array.isArray(entry) && entry.length === 2 && isInt(entry[1]))
        .map((entry) => ({ item: text(entry[0]), showdown: own(showdown.items, text(entry[0])) ?? null, quantity: entry[1] as number })),
    };
  });
}

function countTrue(value: unknown): number {
  if (!isHash(value)) return 0;
  let count = 0;
  for (const flag of value.values()) if (flag === true) count += 1;
  return count;
}

function stat(stats: RubyObject | undefined, name: string): number | null {
  return intOrNull(stats?.get(name));
}

function marked(value: unknown): string[] {
  return isHash(value) ? [...value].filter(([, flag]) => flag === true).map(([key]) => text(key)) : [];
}

function plainHash(value: unknown): { [key: string]: Json } {
  const converted = isHash(value) ? plain(value) : null;
  return converted !== null && typeof converted === "object" && !Array.isArray(converted) ? converted : {};
}

function counts(value: unknown): Record<string, number> {
  return isHash(value) ? Object.fromEntries([...value].filter(([, count]) => isInt(count)).map(([key, count]) => [text(key), count as number])) : {};
}

function saveDetails(save: Save, metadata: RubyObject, stats: RubyObject | undefined): SaveDetails {
  const trainer = player(save);
  const factory = object(save.get("map_factory"));
  const maps = factory ? list(factory.get("maps")) : [];
  const mapIndex = factory?.get("mapIndex");
  const map = object(maps[isInt(mapIndex) ? mapIndex : 0]);
  const walker = object(save.get("game_player"));
  const pokedex = object(trainer.get("pokedex"));
  const system = object(save.get("game_system"));
  const state = metadata.get("challenge_state");
  const charges = metadata.get("vial_charges");
  const log = object(save.get("item_log"));
  return {
    trainer: {
      gender: intOrNull(trainer.get("gender")),
      trainerType: gameIdOrNull(trainer.get("trainer_type")),
      coins: intOrNull(trainer.get("coins")),
      battlePoints: intOrNull(trainer.get("battle_points")),
      soot: intOrNull(trainer.get("soot")),
    },
    boxes: boxesOf(save).map((box) => ({ name: stringOrNull(object(box)?.get("name")), size: list(object(box)?.get("pokemon")).length })),
    position: {
      map: intOrNull(map?.get("map_id")),
      x: intOrNull(walker?.get("x")),
      y: intOrNull(walker?.get("y")),
      direction: intOrNull(walker?.get("direction")),
    },
    startedAt: rubyTime(metadata.get("startTime")),
    savedAt: rubyTime(trainer.get("last_time_saved")),
    steps: intOrNull(metadata.get("stepcount")),
    saveCount: intOrNull(system?.get("save_count")),
    gameVersion: stringOrNull(save.get("game_version")),
    pokedex: {
      seen: marked(pokedex?.get("seen")),
      owned: marked(pokedex?.get("owned")),
      seenForms: plainHash(pokedex?.get("seen_forms")),
      lastSeenForms: plainHash(pokedex?.get("last_seen_forms")),
      seenEggs: marked(pokedex?.get("seen_eggs")),
      caughtCounts: counts(pokedex?.get("caught_counts")),
      defeatedCounts: counts(pokedex?.get("defeated_counts")),
      ownedShadow: marked(pokedex?.get("owned_shadow")),
      unlockedDexes: list(pokedex?.get("unlocked_dexes")).map((flag) => flag === true),
      accessibleDexes: list(pokedex?.get("accessible_dexes")).filter(isInt),
    },
    gameStats: Object.fromEntries(
      [...(stats?.ivars ?? [])].filter(([, value]) => typeof value === "number" && Number.isFinite(value)).map(([key, value]) => [key.replace(/^@/, ""), value as number]),
    ),
    challenge: {
      rules: list(metadata.get("challenge_rules")).filter(truthy).map(text),
      outcomes: isHash(state) ? [...state.values()].map((entry) => (Array.isArray(entry) && truthy(entry[0]) ? text(entry[0]) : "None")) : [],
    },
    vial: isInt(charges) ? { charges, max: intOrNull(metadata.get("max_vial_charges")) } : null,
    hallOfFame: list(metadata.get("hallOfFame")).map((team) => list(team).filter((pokemon): pokemon is RubyObject => pokemon instanceof RubyObject).map(member)),
    itemsFound: log ? list(log.get("found_items")).filter(truthy).map(text) : [],
  };
}

const SHOWN_POKEMON = new Set(["species", "form", "forced_form", "name", "level", "gender", "shiny", "ability", "ability_index", "forced_ability", "nature", "nature_for_stats", "item", "iv", "ev", "personalID", "perma_faint"]);

const compactPokemon: Shaper = (object) => {
  if (object.cls !== "Pokemon") return undefined;
  return {
    ...plainIvars(object, new Set([...object.ivars.keys()].map((key) => key.replace(/^@/, "")).filter((key) => !SHOWN_POKEMON.has(key)))),
    moves: list(object.get("moves"))
      .map((move) => (move instanceof RubyObject ? moveId(move.get("id")) : null))
      .filter((move): move is string => move !== null),
  };
};

const SAVED_ELSEWHERE = new Set(["random_moves", "random_trainer_teams", "random_encounter_table", "tm_compatibility_random", "tm_move_map", "pokeapi_cache"]);

export type World = { [key: string]: Json };

function worldOf(save: Save, metadata: RubyObject, stored: RubyObject[]): World {
  const randomized = save.get("randomized_data");
  const storage = object(save.get("storage_system"));
  const dataOf = (key: string) => plain(object(save.get(key))?.get("data"));
  return {
    randomizer: {
      abilities: plain(isHash(randomized) ? randomized.get("abilities") : null),
      learnsets: plain(metadata.get("random_moves")),
      encounters: plain(metadata.get("random_encounter_table")),
      trainers: plain(metadata.get("random_trainer_teams"), compactPokemon),
      tmMoves: plain(metadata.get("tm_move_map")),
    },
    pokemon: stored.map(sitting),
    metadata: plainIvars(metadata, SAVED_ELSEWHERE, compactPokemon),
    player: plainIvars(player(save), new Set(["party", "pokedex"]), compactPokemon),
    bag: plainIvars(object(save.get("bag")), new Set(["pockets"])),
    storage: {
      unlockedWallpapers: plain(storage?.get("unlockedWallpapers")),
      backgrounds: boxesOf(save).map((box) => intOrNull(object(box)?.get("background"))),
    },
    switches: dataOf("switches"),
    variables: plain(object(save.get("variables"))?.get("data"), compactPokemon),
    selfSwitches: dataOf("self_switches"),
    mapMetadata: plainIvars(object(save.get("map_metadata")), new Set()),
    options: plainIvars(object(save.get("pokemon_system")), new Set()),
    frameCount: intOrNull(save.get("frame_count")),
    essentialsVersion: stringOrNull(save.get("essentials_version")),
  };
}

export type Exported = { snapshot: Snapshot; world: World; rolled: number; compatibility: Compatibility };

export function exportSave(save: Save, side: Uint8Array | null, sideLabel: string, kept: TmRolls | null): Exported {
  const metadata = metadataOf(save);
  const randomized = save.get("randomized_data");
  const abilityTable = isHash(randomized) ? randomized.get("abilities") : undefined;
  const table: RubyHash = isHash(abilityTable) ? abilityTable : new Map();
  const capsules = metadata.get("random_abs_pokes");
  const notices: string[] = [];
  const tmMap = metadata.get("tm_move_map");
  const compatibility = kept ? seeded(kept) : tmCompatibility(side, sideLabel, metadata, notices);
  const stored = shuffled(storedPokemon(save));
  const seen = stored.filter((pokemon) => own(showdown.species, speciesForm(pokemon)) !== undefined);
  const rolled = rollTms(compatibility, seen, save, tmMap);
  const moves: MovesContext = {
    learnsets: metadata.get("random_moves"),
    perForm: truthy(metadata.get("different_movesets_per_form")),
    compatibility,
    bagTms: bagTms(save),
    tmMap,
  };
  const exported = stored
    .filter((pokemon) => !fainted(pokemon))
    .map((pokemon) => exportPokemon(pokemon, table, capsules, moves, notices))
    .filter((entry): entry is SheetPokemon => entry !== null);
  const items = exportItems(save, stored);
  const tms = exportTms(save, stored, tmMap, notices);
  const version = metadata.get("randomlocke_version");
  if (version !== data.randomlocke_version) {
    notices.push(
      `The save is Randomlocke version ${text(version)}, but the site's data is for version ${data.randomlocke_version}; some of what it read may be wrong.`,
    );
  }
  const trainer = player(save);
  const id = intOrNull(trainer.get("id"));
  const stats = object(save.get("stats"));
  const pokedex = object(trainer.get("pokedex"));
  const encounters = metadata.get("challenge_encs");
  const playTime = stats?.get("play_time");
  const snapshot: Snapshot = {
    pokemon: exported,
    items,
    tms,
    fainted: stored.filter(fainted).map((pokemon) => exportFainted(pokemon, table, capsules, moves)),
    bag: bag(save),
    trainer: {
      name: truthy(trainer.get("name")) ? text(trainer.get("name")) : null,
      id,
      publicId: id === null ? null : id % 65536,
      money: intOrNull(trainer.get("money")),
      badges: list(trainer.get("badges")).map((badge) => badge === true),
    },
    playTime: typeof playTime === "number" && Number.isFinite(playTime) ? playTime : null,
    pokedex: { seen: countTrue(pokedex?.get("seen")), owned: countTrue(pokedex?.get("owned")) },
    records: {
      trainerBattlesWon: stat(stats, "trainer_battles_won"),
      trainerBattlesLost: stat(stats, "trainer_battles_lost"),
      wildBattlesWon: stat(stats, "wild_battles_won"),
      wildBattlesLost: stat(stats, "wild_battles_lost"),
      blackouts: stat(stats, "blacked_out_count"),
    },
    hallOfFame: list(metadata.get("hallOfFame")).length,
    usedEncounters: isHash(encounters)
      ? [...encounters]
          .filter(([map, used]) => isInt(map) && used === true)
          .map(([map]) => map as number)
          .sort((a, b) => a - b)
      : [],
    saveSlot: truthy(trainer.get("save_slot")) ? text(trainer.get("save_slot")) : null,
    randomlockeVersion: intOrNull(version),
    notices,
    details: saveDetails(save, metadata, stats),
  };
  return { snapshot, world: worldOf(save, metadata, stored), rolled, compatibility };
}

export function progressOf(save: Save): { badges: number; hallOfFame: number } {
  return {
    badges: list(player(save).get("badges")).filter((badge) => badge === true).length,
    hallOfFame: list(metadataOf(save).get("hallOfFame")).length,
  };
}

