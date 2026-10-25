import { Dex } from "@pkmn/dex";
import { Sprites } from "@pkmn/img";

const gen = Dex.forGen(9);

export type SpeciesLook = { name: string; sprite: string | null };

export function describeMember(species: string | null, gameSpecies: string): SpeciesLook {
  const entry = species === null ? null : gen.species.get(species);
  if (!entry?.exists) return { name: gameSpecies, sprite: null };
  return { name: entry.name, sprite: Sprites.getPokemon(entry.name, { gen: "gen5" }).url };
}
