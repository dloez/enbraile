import * as z from "zod";
import { named } from "./mon.js";

export const abilityHolder = z.object({
  index: z.int(),
  species: named,
  nickname: z.string().nullable(),
  level: z.number().nullable(),
  shiny: z.boolean(),
  filterTypes: z.array(z.string()),
  sprite: z.string().nullable(),
  abilities: z.array(z.object({ id: z.string(), name: z.string(), hidden: z.boolean(), current: z.boolean() })),
});

export type AbilityHolder = z.infer<typeof abilityHolder>;

export const abilityTrainer = z.object({
  player: z.object({ id: z.string(), name: z.string() }),
  milestone: z.string(),
  mons: z.array(abilityHolder),
});

export type AbilityTrainer = z.infer<typeof abilityTrainer>;

export const abilitiesPage = z.object({
  series: z.object({ number: z.int(), name: z.string(), gameId: z.string().nullable() }),
  trainers: z.array(abilityTrainer),
});

export type AbilitiesPage = z.infer<typeof abilitiesPage>;
