import * as z from "zod";

export const POOL_GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const MIN_BST = 150;

export const MAX_BST = 800;

const poolGen = z.literal(POOL_GENS);

export const teamPool = z.object({
  gen: poolGen,
  speciesGen: poolGen,
  noLegendary: z.boolean(),
  noMythical: z.boolean(),
  fullyEvolved: z.boolean(),
  maxBst: z.int().min(MIN_BST).max(MAX_BST),
});

export type TeamPool = z.infer<typeof teamPool>;

export const DEFAULT_POOL: TeamPool = { gen: 9, speciesGen: 5, noLegendary: false, noMythical: false, fullyEvolved: true, maxBst: MAX_BST };

export function poolLabel(pool: TeamPool): string {
  return [`Gen ${pool.gen}`, `species ≤ Gen ${Math.min(pool.gen, pool.speciesGen)}`, pool.fullyEvolved && "fully evolved", pool.noLegendary && "no legendaries", pool.noMythical && "no mythicals", pool.maxBst < MAX_BST && `BST ≤ ${pool.maxBst}`]
    .filter(Boolean)
    .join(" · ");
}
