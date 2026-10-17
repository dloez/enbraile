import { Dex, type ModdedDex } from "@pkmn/dex";

export type Gen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const GENS: readonly Gen[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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

export function dexFor(gen: Gen): ModdedDex {
  return Dex.forGen(gen);
}

export function available(entry: { exists: boolean; isNonstandard?: string | null }): boolean {
  return entry.exists && (entry.isNonstandard == null || entry.isNonstandard === "Past");
}

const typesByGen = new Map<Gen, readonly TypeName[]>();

export function typesIn(gen: Gen): readonly TypeName[] {
  let types = typesByGen.get(gen);
  if (!types) {
    const dex = dexFor(gen);
    types = TYPES.filter((t) => available(dex.types.get(t)));
    typesByGen.set(gen, types);
  }
  return types;
}

export function effectiveness(gen: Gen, attack: string, defend: string): number {
  const taken = dexFor(gen).types.get(defend);
  if (!taken.exists) return 1;
  const code = taken.damageTaken[attack];
  return code === 1 ? 2 : code === 2 ? 0.5 : code === 3 ? 0 : 1;
}
