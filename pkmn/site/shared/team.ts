import * as z from "zod";
import { gameCosts } from "./games.js";
import { freePool, teamPool } from "./pool.js";
import { exportReport, snapshotSchema } from "./snapshot.js";

export const TEAM_SIZE = 6;

export const MAX_TEAM_SIZE = 8;

export const TEAM_SIZES = [6, 7, 8] as const;

export const PICK_SIZE = 6;

export const TEAM_KINDS = ["free", "round", "cup", "try"] as const;

export const TEAM_STATES = ["todo", "locked", "edit"] as const;

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

export const shownFreeMember = freeMember.extend({ evs: statTable(MAX_EV).nullable(), ivs: statTable(MAX_IV).nullable() });

export const shownMember = z.union([shownFreeMember, ownMember]);

export const shownSlots = z.array(shownMember.nullable()).min(TEAM_SIZE).max(MAX_TEAM_SIZE);

export const TEAM_NAME_MAX = 60;

export const teamName = z.string().trim().min(1).max(TEAM_NAME_MAX);

export const teamSourceIds = z.array(id).refine((ids) => new Set(ids).size === ids.length);

export const newTeamInput = z.object({
  sources: teamSourceIds.optional(),
  anyPokemon: z.boolean().optional(),
  name: teamName.optional(),
  slots: teamSlots.optional(),
  pool: teamPool.optional(),
  freePool: freePool.optional(),
});

export const teamInput = z.object({
  name: teamName.optional(),
  slots: teamSlots.optional(),
  sources: teamSourceIds.optional(),
  anyPokemon: z.boolean().optional(),
  pool: teamPool.optional(),
  freePool: freePool.optional(),
  private: z.boolean().optional(),
});

const person = z.object({ id: z.string(), name: z.string() });

export const teamSourceRow = z.object({
  id: z.string(),
  player: person,
  series: z.object({ number: z.int(), name: z.string() }),
  milestone: z.string(),
});

export const teamLeague = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("try"), series: z.int(), number: z.int(), at: z.string() }),
  z.object({ kind: z.literal("round"), series: z.int(), match: z.string().nullable(), round: z.int(), milestone: z.string(), opponent: z.string().nullable() }),
  z.object({ kind: z.literal("cup"), series: z.int(), match: z.string(), slot: z.string(), entrants: z.int(), opponent: z.string() }),
]);

export const teamRow = z.object({
  id: z.string(),
  name: z.string(),
  owner: person,
  series: z.array(z.int()),
  league: teamLeague.nullable(),
  state: z.enum(TEAM_STATES),
  lockedAt: z.string().nullable(),
  sources: z.array(teamSourceRow),
  anyPokemon: z.boolean(),
  private: z.boolean(),
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
  spreadHidden: z.boolean(),
});

export const teamPage = z.object({
  id: z.string(),
  name: z.string(),
  owner: person,
  mine: z.boolean(),
  league: teamLeague.nullable(),
  lockedAt: z.string().nullable(),
  canEdit: z.boolean(),
  canLock: z.boolean(),
  canUnlock: z.boolean(),
  canClone: z.boolean(),
  sources: z.array(teamSource),
  anyPokemon: z.boolean(),
  private: z.boolean(),
  slots: shownSlots,
  pool: teamPool,
  freePool,
  updatedAt: z.string(),
});

export const teamWait = z.object({ series: z.int(), match: z.string(), round: z.int(), milestone: z.string(), opponent: z.string().nullable() });

export const teamWaits = z.array(teamWait);

export const teamsToBuild = z.object({ count: z.int().min(0) });

export const teamMade = z.object({ id: z.string() });

export const teamDone = z.object({});

export type TeamMember = z.infer<typeof teamMember>;

export type OwnMember = z.infer<typeof ownMember>;

export type FreeMember = z.infer<typeof freeMember>;

export type TeamSlots = z.infer<typeof teamSlots>;

export type ShownMember = z.infer<typeof shownMember>;

export type ShownFreeMember = z.infer<typeof shownFreeMember>;

export type ShownSlots = z.infer<typeof shownSlots>;

export type TeamRow = z.infer<typeof teamRow>;

export type TeamLeague = z.infer<typeof teamLeague>;

export type TeamWait = z.infer<typeof teamWait>;

export type TeamKind = (typeof TEAM_KINDS)[number];

export type TeamState = (typeof TEAM_STATES)[number];

export function teamKind(row: Pick<TeamRow, "league">): TeamKind {
  return row.league?.kind ?? "free";
}

export function hasToggle(kind: TeamKind, locked: boolean): boolean {
  return !locked && (kind === "free" || kind === "try");
}

export function teamState(kind: TeamKind, locked: boolean): TeamState {
  if (locked) return "locked";
  return kind === "round" || kind === "cup" ? "todo" : "edit";
}

export type TeamSourceRow = z.infer<typeof teamSourceRow>;

export type TeamSource = z.infer<typeof teamSource>;

export type TeamPage = z.infer<typeof teamPage>;

export function isFree<M extends ShownMember>(member: M): member is Extract<M, { free: true }> {
  return "free" in member;
}

export function spreadShown(member: ShownFreeMember): member is FreeMember {
  return member.evs !== null && member.ivs !== null;
}

export function backedBy(slots: TeamSlots, sources: readonly string[], anyPokemon: boolean): boolean {
  return slots.every((member) => member === null || (isFree(member) ? anyPokemon : sources.includes(member.source)));
}

export function emptySlots(size: number = TEAM_SIZE): TeamSlots {
  return Array.from({ length: size }, () => null);
}

export function lastFilled(slots: readonly unknown[]): number {
  return slots.reduce<number>((n, member, at) => (member ? at + 1 : n), 0);
}

export function resized<S>(slots: (S | null)[], size: number): (S | null)[] | null {
  if (size < TEAM_SIZE || size > MAX_TEAM_SIZE || size < lastFilled(slots)) return null;
  return slots.length >= size ? slots.slice(0, size) : [...slots, ...Array.from({ length: size - slots.length }, () => null)];
}

export function nextTeamName(names: readonly string[], base = "Team"): string {
  let n = 1;
  while (names.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}
