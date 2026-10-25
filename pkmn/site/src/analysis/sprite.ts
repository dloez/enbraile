import { Sprites } from "@pkmn/img";
import type { Member } from "@/analysis/member";

export function spriteOf(member: Member): string {
  return Sprites.getPokemon(member.species, { gen: "gen5", gender: member.set.gender === "F" ? "F" : undefined }).url;
}

export function spriteOfName(name: string): string {
  return Sprites.getPokemon(name, { gen: "gen5" }).url;
}

export function knownSpriteOfName(name: string): string | null {
  const url = spriteOfName(name);
  return url.endsWith("/gen5/0.png") ? null : url;
}
