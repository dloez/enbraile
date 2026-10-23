import * as z from "zod";
import { zipName } from "./games.js";

export const largestSaveZip = 100 * 1024 * 1024;

export const saveSlot = z.object({
  entry: z.string(),
  name: z.string(),
  savedAt: z.string(),
  badges: z.number().int().nullable(),
  hallOfFame: z.number().int().nullable(),
  suggested: z.string().nullable(),
});

export const uploadedSave = z.object({
  key: z.string(),
  fileName: z.string(),
  size: z.number().int(),
  slots: z.array(saveSlot).min(1),
});

export const snapshotRequest = z.object({
  key: z.string().min(1),
  fileName: zipName,
  slot: z.string().min(1),
  milestone: z.string().min(1),
});

export const savedSnapshot = z.object({
  milestone: z.string(),
  pokemon: z.number().int(),
  fainted: z.number().int(),
  replaced: z.boolean(),
  rolled: z.number().int(),
  sideFile: z.string(),
});

export function suggestMilestone(milestones: readonly string[], progress: { badges: number | null; hallOfFame: number | null }): string | null {
  if (progress.hallOfFame && progress.hallOfFame > 0) {
    const league = milestones.find((name) => /league/i.test(name));
    if (league) return league;
  }
  if (progress.badges && progress.badges > 0) {
    const gym = milestones.find((name) => name.toLowerCase() === `gym ${progress.badges}`);
    if (gym) return gym;
  }
  return null;
}

export type SaveSlot = z.infer<typeof saveSlot>;

export type UploadedSave = z.infer<typeof uploadedSave>;

export type SavedSnapshot = z.infer<typeof savedSnapshot>;
