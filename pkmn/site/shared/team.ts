import * as z from "zod";
import { exportReport, snapshotSchema } from "./snapshot.js";

export const TEAM_SIZE = 6;

export const MOVE_SLOTS = 4;

const id = z.string().min(1);

export const teamMember = z.object({
  source: id,
  index: z.int().min(0),
  species: id,
  item: id.nullable(),
  ability: id.nullable(),
  moves: z.array(id.nullable()).length(MOVE_SLOTS),
});

export const teamSlots = z.array(teamMember.nullable()).length(TEAM_SIZE);

export const teamName = z.string().trim().min(1).max(60);

export const newTeamInput = z.object({
  snapshot: id.optional(),
  name: teamName.optional(),
  slots: teamSlots.optional(),
});

export const teamInput = z.object({
  name: teamName.optional(),
  slots: teamSlots.optional(),
});

const person = z.object({ id: z.string(), name: z.string() });

export const teamSourceRow = z.object({
  id: z.string(),
  player: person,
  series: z.object({ number: z.int(), name: z.string() }),
  milestone: z.string(),
});

export const teamRow = z.object({
  id: z.string(),
  name: z.string(),
  owner: person,
  sources: z.array(teamSourceRow),
  members: z.array(id.nullable()),
  updatedAt: z.string(),
});

export const teamList = z.array(teamRow);

export const teamSource = teamSourceRow.extend({
  snapshot: snapshotSchema,
  missing: exportReport.nullable(),
});

export const teamPage = z.object({
  id: z.string(),
  name: z.string(),
  owner: person,
  canEdit: z.boolean(),
  sources: z.array(teamSource),
  slots: teamSlots,
  updatedAt: z.string(),
});

export const teamMade = z.object({ id: z.string() });

export const teamDone = z.object({});

export type TeamMember = z.infer<typeof teamMember>;

export type TeamSlots = z.infer<typeof teamSlots>;

export type TeamRow = z.infer<typeof teamRow>;

export type TeamSourceRow = z.infer<typeof teamSourceRow>;

export type TeamSource = z.infer<typeof teamSource>;

export type TeamPage = z.infer<typeof teamPage>;

export function emptySlots(): TeamSlots {
  return Array.from({ length: TEAM_SIZE }, () => null);
}

export function nextTeamName(names: readonly string[]): string {
  let n = 1;
  while (names.includes(`Team ${n}`)) n += 1;
  return `Team ${n}`;
}
