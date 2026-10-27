import * as z from "zod";
import { gameCosts } from "./games.js";
import { teamPool } from "./pool.js";
import { exportReport, snapshotSchema } from "./snapshot.js";

export const TEAM_SIZE = 6;

export const MAX_TEAM_SIZE = 8;

export const TEAM_SIZES = [6, 7, 8] as const;

export const PICK_SIZE = 6;

export const MIN_COMPARED = 2;

export const MAX_COMPARED = 4;

export const MOVE_SLOTS = 4;

const id = z.string().min(1);

export const MAX_LEVEL = 100;

export const MAX_EV = 252;

export const EV_TOTAL = 510;

export const MAX_IV = 31;

const moves = z.array(id.nullable()).length(MOVE_SLOTS);

const statTable = (max: number) =>
  z.object({ hp: z.int().min(0).max(max), atk: z.int().min(0).max(max), def: z.int().min(0).max(max), spa: z.int().min(0).max(max), spd: z.int().min(0).max(max), spe: z.int().min(0).max(max) });

export const ownMember = z.object({
  source: id,
  index: z.int().min(0),
  species: id,
  item: id.nullable(),
  ability: id.nullable(),
  nature: id.nullable().default(null),
  moves,
});

export const freeMember = z.object({
  free: z.literal(true),
  species: id,
  item: id.nullable(),
  ability: id.nullable(),
  level: z.int().min(1).max(MAX_LEVEL),
  nature: id,
  evs: statTable(MAX_EV),
  ivs: statTable(MAX_IV),
  moves,
});

export const teamMember = z.union([freeMember, ownMember]);

export const teamSlots = z.array(teamMember.nullable()).min(TEAM_SIZE).max(MAX_TEAM_SIZE);

export const teamName = z.string().trim().min(1).max(60);

export const teamSourceIds = z.array(id).refine((ids) => new Set(ids).size === ids.length);

export const newTeamInput = z.object({
  sources: teamSourceIds.optional(),
  anyPokemon: z.boolean().optional(),
  name: teamName.optional(),
  slots: teamSlots.optional(),
  pool: teamPool.optional(),
});

export const teamInput = z.object({
  name: teamName.optional(),
  slots: teamSlots.optional(),
  sources: teamSourceIds.optional(),
  anyPokemon: z.boolean().optional(),
  pool: teamPool.optional(),
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
  anyPokemon: z.boolean(),
  members: z.array(id.nullable()),
  updatedAt: z.string(),
});

export const teamList = z.array(teamRow);

export const snapshotList = z.array(teamSourceRow);

export const teamSource = teamSourceRow.extend({
  gameId: z.string().nullable(),
  snapshot: snapshotSchema,
  missing: exportReport.nullable(),
  costs: gameCosts,
});

export const teamPage = z.object({
  id: z.string(),
  name: z.string(),
  owner: person,
  canEdit: z.boolean(),
  sources: z.array(teamSource),
  anyPokemon: z.boolean(),
  slots: teamSlots,
  pool: teamPool,
  updatedAt: z.string(),
});

export const teamMade = z.object({ id: z.string() });

export const teamDone = z.object({});

export type TeamMember = z.infer<typeof teamMember>;

export type OwnMember = z.infer<typeof ownMember>;

export type FreeMember = z.infer<typeof freeMember>;

export type TeamSlots = z.infer<typeof teamSlots>;

export type TeamRow = z.infer<typeof teamRow>;

export type TeamSourceRow = z.infer<typeof teamSourceRow>;

export type TeamSource = z.infer<typeof teamSource>;

export type TeamPage = z.infer<typeof teamPage>;

export function isFree(member: TeamMember): member is FreeMember {
  return "free" in member;
}

export function backedBy(slots: TeamSlots, sources: readonly string[], anyPokemon: boolean): boolean {
  return slots.every((member) => member === null || (isFree(member) ? anyPokemon : sources.includes(member.source)));
}

export function emptySlots(size: number = TEAM_SIZE): TeamSlots {
  return Array.from({ length: size }, () => null);
}

export function lastFilled(slots: TeamSlots): number {
  return slots.reduce((n, member, at) => (member ? at + 1 : n), 0);
}

export function resized(slots: TeamSlots, size: number): TeamSlots | null {
  if (size < TEAM_SIZE || size > MAX_TEAM_SIZE || size < lastFilled(slots)) return null;
  return slots.length >= size ? slots.slice(0, size) : [...slots, ...emptySlots(size - slots.length)];
}

export function nextTeamName(names: readonly string[]): string {
  let n = 1;
  while (names.includes(`Team ${n}`)) n += 1;
  return `Team ${n}`;
}
