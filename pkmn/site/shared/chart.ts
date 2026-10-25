import { available, dexFor, effectiveness, type Gen } from "./dex.js";
import type { TypeName } from "./mon.js";

type Modifier = Partial<Record<TypeName, number>>;

export const MATCHUP_ABILITIES: Record<string, Modifier> = {
  levitate: { Ground: 0 },
  eartheater: { Ground: 0 },
  flashfire: { Fire: 0 },
  wellbakedbody: { Fire: 0 },
  waterabsorb: { Water: 0 },
  stormdrain: { Water: 0 },
  dryskin: { Water: 0, Fire: 1.25 },
  voltabsorb: { Electric: 0 },
  lightningrod: { Electric: 0 },
  motordrive: { Electric: 0 },
  sapsipper: { Grass: 0 },
  thickfat: { Fire: 0.5, Ice: 0.5 },
  heatproof: { Fire: 0.5 },
  waterbubble: { Fire: 0.5 },
  purifyingsalt: { Ghost: 0.5 },
  fluffy: { Fire: 2 },
};

const WONDER_GUARD = "wonderguard";

export const ATE_ABILITIES: Record<string, TypeName> = {
  pixilate: "Fairy",
  aerilate: "Flying",
  refrigerate: "Ice",
  galvanize: "Electric",
};

const SCRAPPY_ABILITIES = new Set(["scrappy", "mindseye"]);

export function abilityIn(gen: Gen, ability: string | null): string | null {
  if (!ability || gen < 3) return null;
  return available(dexFor(gen).abilities.get(ability)) ? ability : null;
}

export function typeMultiplier(gen: Gen, attack: string, types: readonly string[]): number {
  return types.reduce((m, t) => m * effectiveness(gen, attack, t), 1);
}

export function damageTaken(gen: Gen, attack: string, types: readonly string[], ability: string | null): number {
  const base = typeMultiplier(gen, attack, types);
  const active = abilityIn(gen, ability);
  if (active === WONDER_GUARD) return base > 1 ? base : 0;
  const modifier = active ? MATCHUP_ABILITIES[active]?.[attack as TypeName] : undefined;
  return modifier === undefined ? base : base * modifier;
}

export interface AttackingMove {
  id: string;
  type: string;
}

export function moveVsType(gen: Gen, move: AttackingMove, defend: string, ability: string | null): number {
  if (move.id === "freezedry" && defend === "Water") return 2;
  let m = effectiveness(gen, move.type, defend);
  if (move.id === "flyingpress") m *= effectiveness(gen, "Flying", defend);
  if (m === 0 && defend === "Ghost" && ability && SCRAPPY_ABILITIES.has(ability) && (move.type === "Normal" || move.type === "Fighting"))
    m = 1;
  if (m === 0 && move.id === "thousandarrows" && defend === "Flying") m = 1;
  return m;
}

export function moveVsMon(
  gen: Gen,
  move: AttackingMove,
  attackerAbility: string | null,
  types: readonly string[],
  defenderAbility: string | null,
): number {
  let m = types.reduce((p, t) => p * moveVsType(gen, move, t, attackerAbility), 1);
  const active = abilityIn(gen, defenderAbility);
  const modifier = active ? MATCHUP_ABILITIES[active]?.[move.type as TypeName] : undefined;
  if (modifier !== undefined) m *= modifier;
  if (active === WONDER_GUARD && m <= 1) m = 0;
  return m;
}
