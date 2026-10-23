import * as z from "zod";

export const SCENES = ["night", "route"] as const;

export const SCENE_NAMES: Record<Scene, string> = { night: "Night sky", route: "Daytime route" };

export const INGESTION_MODES = ["manual", "automatic"] as const;

export const SERIES_STATES = ["draft", "running", "finished"] as const;

export const MILESTONE_MARKS = ["none", "round", "tournament"] as const;

export const scene = z.enum(SCENES);

export const ingestion = z.enum(INGESTION_MODES);

export const seriesState = z.enum(SERIES_STATES);

export const milestoneMark = z.enum(MILESTONE_MARKS);

export const milestoneInput = z.object({ name: z.string().trim().min(1).max(40), mark: milestoneMark });

export const seriesNumber = z.number().int().min(1).max(999);

export const seriesInput = z.object({
  number: seriesNumber,
  name: z.string().trim().min(1).max(100),
  gameId: z.string().min(1).nullable(),
  scene,
  ingestion,
  rules: z.string().max(100_000),
  playerIds: z.array(z.string().min(1)).max(100),
  milestones: z.array(milestoneInput).max(30),
});

export const rulesInput = z.object({ rules: z.string().max(100_000) });

export const newSeries = z.object({ number: seriesNumber, name: z.string().trim().min(1).max(100) });

export const milestone = z.object({ name: z.string(), mark: milestoneMark });

export const checklistItem = z.object({ label: z.string(), done: z.boolean() });

export const adminSeries = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string(),
  gameId: z.string().nullable(),
  scene,
  ingestion,
  rules: z.string(),
  state: seriesState,
  playerIds: z.array(z.string()),
  milestones: z.array(milestone),
  checklist: z.array(checklistItem),
  otherRunning: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

export const adminSeriesList = z.array(adminSeries);

export const seriesBanner = z.object({
  number: z.number(),
  name: z.string(),
  scene,
  state: seriesState,
  game: z.string().nullable(),
});

export const seriesBannerList = z.array(seriesBanner);

export const setByHand = z.object({ by: z.string(), at: z.string() });

export const snapshotSources = z.object({ savedFainted: z.number().int(), fainted: setByHand.nullable(), moved: setByHand.nullable() });

export const trainerSnapshot = z.object({
  milestone: z.string(),
  pokemon: z.number().int(),
  fainted: z.number().int(),
  playTime: z.number().nullable(),
  zip: z.boolean(),
  sources: snapshotSources.optional(),
});

export const trainerSources = z.object({ progress: setByHand.nullable() });

export const trainer = z.object({
  id: z.string(),
  name: z.string(),
  canUpload: z.boolean(),
  progress: z.string().nullable(),
  snapshots: z.array(trainerSnapshot),
  sources: trainerSources.optional(),
});

export const progressInput = z.object({ milestone: z.string().min(1) });

export const faintedInput = z.object({ count: z.number().int().min(0).max(999) });

export const moveInput = z.object({ milestone: z.string().min(1) });

export const overrideDone = z.object({});

export const seriesPage = seriesBanner.extend({
  ingestion,
  rules: z.string(),
  milestones: z.array(milestone),
  trainers: z.array(trainer),
  canDownload: z.boolean(),
});

export const seriesDeleted = z.object({});

export function startChecklist(draft: {
  rules: string;
  gameHasFile: boolean;
  players: number;
  milestones: number;
  otherRunning: string | null;
}): z.infer<typeof checklistItem>[] {
  const items = [
    { label: "Rules written", done: draft.rules.trim() !== "" },
    { label: "A game with its file", done: draft.gameHasFile },
    { label: "At least two players", done: draft.players >= 2 },
    { label: "At least one milestone", done: draft.milestones >= 1 },
  ];
  if (draft.otherRunning) items.push({ label: `${draft.otherRunning} finished`, done: false });
  return items;
}

export type Scene = z.infer<typeof scene>;

export type MilestoneMark = z.infer<typeof milestoneMark>;

export type SeriesInput = z.infer<typeof seriesInput>;

export type AdminSeries = z.infer<typeof adminSeries>;

export type SeriesBanner = z.infer<typeof seriesBanner>;

export type SeriesPage = z.infer<typeof seriesPage>;

export type Trainer = z.infer<typeof trainer>;

export type TrainerSnapshot = z.infer<typeof trainerSnapshot>;

export type SetByHand = z.infer<typeof setByHand>;
