import { Dex, type Species } from "@pkmn/dex";
import { selectable } from "@/analysis/pool";
import { available, GENS } from "../../shared/dex";
import { MAX_BST, type FreePool } from "../../shared/pool";
import { describeAbility, describeItem, describeMove, describeNature, describePokemon, statAt } from "../../shared/describe";
import { STATS, type Ability, type BagItem, type Mon, type MoveInfo, type Nature } from "../../shared/mon";
import { isFree, spreadShown, type ShownFreeMember } from "../../shared/team";
import { ownMon, type Member, type Slots, type Stocks } from "@/teams/team";

const gen = Dex.forGen(9);

const MINI_SETA_ID = "tinymushroom";

const LAST_GEN = GENS[GENS.length - 1];

export interface AnySpecies {
  id: string;
  name: string;
  types: string[];
}

function fits(entry: Species, pool: FreePool): boolean {
  return (
    entry.gen <= pool.speciesGen &&
    !(pool.fullyEvolved && entry.nfe) &&
    !(pool.noLegendary && (entry.tags.includes("Restricted Legendary") || entry.tags.includes("Sub-Legendary"))) &&
    !(pool.noMythical && entry.tags.includes("Mythical")) &&
    (pool.maxBst >= MAX_BST || entry.bst <= pool.maxBst)
  );
}

const PICKABLE = gen.species
  .all()
  .filter((entry) => selectable(LAST_GEN, LAST_GEN, entry))
  .sort((a, b) => a.name.localeCompare(b.name));

const picked = new Map<string, readonly AnySpecies[]>();

export function freeSpecies(pool: FreePool): readonly AnySpecies[] {
  const key = JSON.stringify([pool.speciesGen, pool.fullyEvolved, pool.noLegendary, pool.noMythical, pool.maxBst]);
  let species = picked.get(key);
  if (!species) {
    species = PICKABLE.filter((entry) => fits(entry, pool)).map((entry) => ({ id: entry.id, name: entry.name, types: [...entry.types] }));
    picked.set(key, species);
  }
  return species;
}

export function inFreePool(species: string, pool: FreePool): boolean {
  const entry = gen.species.get(species);
  return entry.exists && fits(entry, pool);
}

export const ANY_SPECIES_IDS: ReadonlySet<string> = new Set(
  gen.species
    .all()
    .filter((entry) => available(entry))
    .map((entry) => entry.id),
);

export const NATURES: readonly Nature[] = gen.natures
  .all()
  .map((entry) => describeNature(entry.id) as Nature)
  .sort((a, b) => Number(a.plus === null) - Number(b.plus === null) || a.name.localeCompare(b.name));

export function speciesAbilities(species: string): { base: string[]; hidden: string[] } {
  const entry = gen.species.get(species);
  if (!entry.exists) return { base: [], hidden: [] };
  const id = (name: string | undefined): string | null => (name ? gen.abilities.get(name).id : null);
  const base = [id(entry.abilities[0]), id(entry.abilities[1])].filter((a): a is string => a !== null && a !== "");
  const hidden = [id(entry.abilities.H)].filter((a): a is string => a !== null && a !== "" && !base.includes(a));
  return { base, hidden };
}

export function freeMon(member: ShownFreeMember): Mon {
  const entry = gen.species.get(member.species);
  const shown = spreadShown(member);
  const mon = describePokemon(
    {
      species: member.species,
      nickname: null,
      gender: null,
      shiny: false,
      level: member.level,
      nature: member.nature,
      ability: member.ability,
      abilities: speciesAbilities(member.species),
      types: entry.exists ? entry.types.map((t) => t.toLowerCase()) : [],
      ivs: member.ivs,
      evs: member.evs,
      stats: null,
      moves: undefined,
    },
    -1,
    false,
    !shown,
  );
  if (!shown) return { ...mon, free: true };
  const nat = mon.nature;
  return {
    ...mon,
    free: true,
    stats: entry.exists
      ? STATS.map((stat) => {
          const fight = statAt(stat, entry, member.ivs[stat], nat, 50, member.evs[stat]);
          return {
            stat,
            base: entry.baseStats[stat],
            iv: member.ivs[stat],
            ev: member.evs[stat],
            current: statAt(stat, entry, member.ivs[stat], nat, member.level, member.evs[stat]),
            fight,
            low: fight,
            high: fight,
          };
        })
      : null,
  };
}

export function withNature(mon: Mon, id: string): Mon {
  const entry = gen.species.get(mon.species.id);
  const nat = describeNature(id);
  if (!entry.exists || !mon.stats) return { ...mon, nature: nat };
  return {
    ...mon,
    nature: nat,
    stats: mon.stats.map((line) => ({
      ...line,
      current: line.iv !== null && line.ev !== null && mon.level !== null ? statAt(line.stat, entry, line.iv, nat, mon.level, line.ev) : line.current,
      fight: line.iv !== null ? statAt(line.stat, entry, line.iv, nat) : null,
      low: statAt(line.stat, entry, 0, nat),
      high: statAt(line.stat, entry, 31, nat),
    })),
  };
}

export function memberMon(member: Member | null, stocks: Stocks): Mon | undefined {
  if (!member) return undefined;
  if (isFree(member)) {
    const mon = freeMon(member);
    return mon.species.known ? mon : undefined;
  }
  const mon = ownMon(member, stocks);
  return mon && member.nature !== null ? withNature(mon, member.nature) : mon;
}

export function liveSlots(slots: Slots, stocks: Stocks): Slots {
  return slots.map((member) => (memberMon(member, stocks) ? member : null));
}

export const ANY_ITEMS: readonly BagItem[] = gen.items
  .all()
  .filter((entry) => entry.exists && !entry.isNonstandard && entry.id !== MINI_SETA_ID)
  .map((entry) => describeItem({ item: entry.id, quantity: 1 }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const ANY_ABILITIES: readonly Ability[] = gen.abilities
  .all()
  .filter((entry) => entry.exists && entry.num > 0 && !entry.isNonstandard)
  .map((entry) => describeAbility(entry.id))
  .sort((a, b) => a.name.localeCompare(b.name));

const ALL_MOVES = gen.moves
  .all()
  .filter((move) => move.num > 0 && move.id !== "struggle" && !move.isZ && !move.isMax && !["CAP", "LGPE", "Custom", "Future"].includes(move.isNonstandard ?? ""))
  .sort((a, b) => a.name.localeCompare(b.name));

const movesByGen = new Map<number, readonly MoveInfo[]>();

export function movesUpTo(upTo: number): readonly MoveInfo[] {
  let moves = movesByGen.get(upTo);
  if (!moves) {
    moves = ALL_MOVES.filter((move) => move.gen <= upTo).map((move) => describeMove(move.id));
    movesByGen.set(upTo, moves);
  }
  return moves;
}

export function anyMoves(): readonly MoveInfo[] {
  return movesUpTo(LAST_GEN);
}

const oldGen = Dex.forGen(2);

export type Learnset = ReadonlyMap<string, ReadonlySet<string>>;

const learnsets = new Map<string, Promise<Learnset>>();

function addSources(into: Map<string, Set<string>>, learnset: Record<string, string[]> | undefined, keep: (source: string) => boolean) {
  for (const [move, sources] of Object.entries(learnset ?? {})) {
    const kept = sources.filter(keep);
    if (kept.length === 0) continue;
    const now = into.get(move) ?? new Set<string>();
    for (const source of kept) now.add(source);
    into.set(move, now);
  }
}

const early = (source: string) => source.startsWith("1") || source.startsWith("2");

async function learnsetOf(species: string): Promise<Learnset> {
  const moves = new Map<string, Set<string>>();
  const seen = new Set<string>();
  let entry = gen.species.get(species);
  while (entry.exists && !seen.has(entry.id)) {
    seen.add(entry.id);
    const own = (await gen.learnsets.get(entry.id))?.learnset;
    const base = !own && entry.baseSpecies !== entry.name ? (await gen.learnsets.get(entry.baseSpecies))?.learnset : undefined;
    addSources(moves, own ?? base, (source) => !early(source));
    if (entry.gen <= 2) addSources(moves, (await oldGen.learnsets.get(entry.id))?.learnset, early);
    entry = gen.species.get(entry.prevo || (entry.changesFrom ?? ""));
  }
  return moves;
}

export function learnset(species: string): Promise<Learnset> {
  const id = gen.species.get(species).id;
  let moves = learnsets.get(id);
  if (!moves) {
    moves = learnsetOf(id);
    learnsets.set(id, moves);
  }
  return moves;
}

export interface FreeMoves {
  gens: readonly number[];
  levelUp: ReadonlySet<string>;
  tms: ReadonlySet<string>;
}

export function freeMoves(learned: Learnset, pool: FreePool): FreeMoves | null {
  if (pool.tms === "any") return null;
  const machines = new Set(pool.tms.map((g) => `${g}M`));
  const levelUp = new Set<string>();
  const tms = new Set<string>();
  for (const [move, sources] of learned) {
    const codes = [...sources].map((source) => source.slice(0, 2));
    if (codes.some((code) => code[1] === "L")) levelUp.add(move);
    else if (codes.some((code) => machines.has(code))) tms.add(move);
  }
  return { gens: pool.tms, levelUp, tms };
}

export function freeMoveAllowed(moves: FreeMoves | null, move: string): boolean {
  return moves === null || moves.levelUp.has(move) || moves.tms.has(move);
}
