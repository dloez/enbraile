import * as z from "zod";
import { messages, type Messages } from "./i18n.js";

type ChecklistText = { rules: string; game: string; milestone: string; finished: (series: string) => string };
import { teamPool } from "./pool.js";
import { exportReport } from "./snapshot.js";

export const SCENES = ["night", "route"] as const;

export const SCENE_NAMES: Record<Scene, string> = messages({
  en: { night: "Night sky", route: "Daytime route" },
  es: { night: "Cielo nocturno", route: "Ruta de día" },
});

export const CHECKLIST_TEXT: Messages<ChecklistText> = {
  en: { rules: "Rules written", game: "A game with its file", milestone: "At least one milestone", finished: (series: string) => `${series} finished` },
  es: { rules: "Reglas escritas", game: "Un juego con su archivo", milestone: "Al menos un hito", finished: (series: string) => `${series} terminada` },
};

const checklistText = messages(CHECKLIST_TEXT);

export const INGESTION_MODES = ["manual", "automatic"] as const;

export const SERIES_STATES = ["draft", "running", "finished"] as const;

export const MILESTONE_MARKS = ["none", "round", "tournament"] as const;

export const scene = z.enum(SCENES);

export const ingestion = z.enum(INGESTION_MODES);

export const seriesState = z.enum(SERIES_STATES);

export const milestoneMark = z.enum(MILESTONE_MARKS);

export const milestoneInput = z.object({ id: z.string().min(1).optional(), name: z.string().trim().min(1).max(40), mark: milestoneMark });

export const seriesNumber = z.number().int().min(1).max(999);

export const seriesInput = z.object({
  number: seriesNumber,
  name: z.string().trim().min(1).max(100),
  gameId: z.string().min(1).nullable(),
  scene,
  ingestion,
  rules: z.string().max(100_000),
  pool: teamPool,
  playerIds: z.array(z.string().min(1)).max(100),
  milestones: z.array(milestoneInput).max(30),
});

export const rulesInput = z.object({ rules: z.string().max(100_000) });

export const playersInput = z.object({ playerIds: z.array(z.string().min(1)).max(100) });

export const milestonesInput = z.object({ milestones: z.array(milestoneInput).min(1).max(30) });

export const newSeries = z.object({ number: seriesNumber, name: z.string().trim().min(1).max(100) });

export const milestone = z.object({ id: z.string(), name: z.string(), mark: milestoneMark });

export const checklistItem = z.object({ label: z.string(), done: z.boolean() });

export const adminSeries = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string(),
  gameId: z.string().nullable(),
  scene,
  ingestion,
  rules: z.string(),
  pool: teamPool,
  state: seriesState,
  playerIds: z.array(z.string()),
  milestones: z.array(milestone),
  snapshots: z.number().int(),
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

export const owedSeries = z.object({ number: z.number(), name: z.string(), milestones: z.array(milestone) });

export const owedSeriesList = z.array(owedSeries);

export const setByHand = z.object({ by: z.string(), at: z.string() });

export const snapshotSources = z.object({ savedFainted: z.number().int(), fainted: setByHand.nullable(), moved: setByHand.nullable() });

export const trainerSnapshot = z.object({
  milestone: z.string(),
  pokemon: z.number().int(),
  fainted: z.number().int(),
  playTime: z.number().nullable(),
  zip: z.boolean(),
  missing: exportReport.nullable(),
  sources: snapshotSources.optional(),
});

export const trainerSources = z.object({ progress: setByHand.nullable() });

export const trainer = z.object({
  id: z.string(),
  name: z.string(),
  canUpload: z.boolean(),
  progress: z.string().nullable(),
  teams: z.int(),
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

export function startChecklist(
  draft: {
    rules: string;
    gameHasFile: boolean;
    milestones: number;
    otherRunning: string | null;
  },
  text: ChecklistText = checklistText,
): z.infer<typeof checklistItem>[] {
  const items = [
    { label: text.rules, done: draft.rules.trim() !== "" },
    { label: text.game, done: draft.gameHasFile },
    { label: text.milestone, done: draft.milestones >= 1 },
  ];
  if (draft.otherRunning) items.push({ label: text.finished(draft.otherRunning), done: false });
  return items;
}

export type Scene = z.infer<typeof scene>;

export type MilestoneMark = z.infer<typeof milestoneMark>;

export type SeriesInput = z.infer<typeof seriesInput>;

export type AdminSeries = z.infer<typeof adminSeries>;

export type SeriesBanner = z.infer<typeof seriesBanner>;

export type SeriesPage = z.infer<typeof seriesPage>;

export type OwedSeries = z.infer<typeof owedSeries>;

export type Trainer = z.infer<typeof trainer>;

export type TrainerSnapshot = z.infer<typeof trainerSnapshot>;

export type SetByHand = z.infer<typeof setByHand>;
