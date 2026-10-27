import * as z from "zod";
import type { SheetItem } from "./snapshot.js";

export const MINI_SETA = "TINYMUSHROOM";

export const FIGHT_POCKETS = [1, 5];

export const BERRY_POCKET = 5;

export const itemIcons = z.object({
  version: z.string(),
  width: z.int(),
  height: z.int(),
  at: z.record(z.string(), z.tuple([z.int(), z.int(), z.int(), z.int()])),
  showdown: z.record(z.string(), z.string()),
});

export type ItemIcons = z.infer<typeof itemIcons>;

export type FightItem = { item: string; game: string; pocket: number; quantity: number };

export function fightItems(items: readonly SheetItem[]): FightItem[] {
  const merged = new Map<string, FightItem>();
  for (const entry of items) {
    if (entry.showdown === null || entry.pocket === null || !FIGHT_POCKETS.includes(entry.pocket) || entry.item === MINI_SETA) continue;
    const known = merged.get(entry.showdown);
    if (known) known.quantity += entry.quantity;
    else merged.set(entry.showdown, { item: entry.showdown, game: entry.item, pocket: entry.pocket, quantity: entry.quantity });
  }
  return [...merged.values()];
}

export function setasOf(items: readonly SheetItem[]): number {
  return items.filter((entry) => entry.item === MINI_SETA).reduce((sum, entry) => sum + entry.quantity, 0);
}
