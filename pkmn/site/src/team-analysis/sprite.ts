import { Sprites } from "@pkmn/img";
import type { Member } from "@/analysis/member";

export function spriteOf(member: Member): string {
  return Sprites.getPokemon(member.species, { gen: "gen5", gender: member.set.gender === "F" ? "F" : undefined }).url;
}

export function spriteOfName(name: string): string {
  return Sprites.getPokemon(name, { gen: "gen5" }).url;
}
