import * as z from "zod";
import { messages } from "./i18n.js";

const t = messages({
  en: {
    rules: { known: "Known", level: "Its level", fifty: "Lv 50", any: "Any level" },
    gen: (n: number) => `Gen ${n}`,
    species: (n: number) => `species ≤ Gen ${n}`,
    moves: (n: number) => `moves ≤ Gen ${n}`,
    fullyEvolved: "fully evolved",
    noLegendary: "no legendaries",
    noMythical: "no mythicals",
    bst: (n: number) => `BST ≤ ${n}`,
  },
  es: {
    rules: { known: "Conocidos", level: "Su nivel", fifty: "Nv. 50", any: "Cualquier nivel" },
    gen: (n: number) => `Gen ${n}`,
    species: (n: number) => `especies ≤ Gen ${n}`,
    moves: (n: number) => `movimientos ≤ Gen ${n}`,
    fullyEvolved: "evolución final",
    noLegendary: "sin legendarios",
    noMythical: "sin singulares",
    bst: (n: number) => `BST ≤ ${n}`,
  },
});

export const POOL_GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const MIN_BST = 150;

export const MAX_BST = 800;

const poolGen = z.literal(POOL_GENS);

export const MOVE_RULES = ["known", "level", "fifty", "any"] as const;

export type MoveRule = (typeof MOVE_RULES)[number];

export const MOVE_RULE_LABELS: Record<MoveRule, string> = t.rules;

export const teamPool = z.object({
  gen: poolGen,
  speciesGen: poolGen,
  movesGen: poolGen,
  noLegendary: z.boolean(),
  noMythical: z.boolean(),
  fullyEvolved: z.boolean(),
  maxBst: z.int().min(MIN_BST).max(MAX_BST),
  moves: z.enum(MOVE_RULES),
});

export type TeamPool = z.infer<typeof teamPool>;

export const DEFAULT_POOL: TeamPool = { gen: 9, speciesGen: 5, movesGen: 5, noLegendary: false, noMythical: false, fullyEvolved: true, maxBst: MAX_BST, moves: "any" };

export function poolLabel(pool: TeamPool): string {
  return [t.gen(pool.gen), t.species(Math.min(pool.gen, pool.speciesGen)), t.moves(Math.min(pool.gen, pool.movesGen)), pool.fullyEvolved && t.fullyEvolved, pool.noLegendary && t.noLegendary, pool.noMythical && t.noMythical, pool.maxBst < MAX_BST && t.bst(pool.maxBst)]
    .filter(Boolean)
    .join(" · ");
}
