import * as z from "zod";

export const heldAbility = z.object({ id: z.string(), hidden: z.boolean(), current: z.boolean() });

export const abilityHolder = z.object({
  index: z.int(),
  name: z.string(),
  species: z.string(),
  level: z.number().nullable(),
  sprite: z.string().nullable(),
  shiny: z.boolean(),
  abilities: z.array(heldAbility),
});

export type AbilityHolder = z.infer<typeof abilityHolder>;

export const abilityEntry = z.object({ name: z.string(), desc: z.string(), marked: z.boolean() });

export type AbilityEntry = z.infer<typeof abilityEntry>;

export const abilityTrainer = z.object({
  player: z.object({ id: z.string(), name: z.string() }),
  milestone: z.string(),
  mons: z.array(abilityHolder),
});

export type AbilityTrainer = z.infer<typeof abilityTrainer>;

export const abilitiesPage = z.object({
  series: z.object({ number: z.int(), name: z.string() }),
  abilities: z.record(z.string(), abilityEntry),
  trainers: z.array(abilityTrainer),
});

export type AbilitiesPage = z.infer<typeof abilitiesPage>;
