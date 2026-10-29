import { Dex } from "@pkmn/dex";
import { Sprites } from "@pkmn/img";

const gen = Dex.forGen(9);

export type SpeciesLook = { name: string; sprite: string | null };

export function describeMember(species: string | null, gameSpecies: string): SpeciesLook {
  const entry = species === null ? null : gen.species.get(species);
  if (!entry?.exists) return { name: gameSpecies, sprite: null };
  return { name: entry.name, sprite: Sprites.getPokemon(entry.name, { gen: "gen5" }).url };
}

export function speciesTypes(species: string): string[] {
  const entry = gen.species.get(species);
  return entry?.exists ? [...entry.types] : [];
}

export function itemName(id: string): string | null {
  const entry = gen.items.get(id);
  return entry?.exists ? entry.name : null;
}
