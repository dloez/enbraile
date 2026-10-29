import type { Snapshot } from "../../shared/snapshot.js";
import { isFree, type ShownSlots, type TeamSlots } from "../../shared/team.js";
import type { Viewer } from "./series-data.js";

export function seesSpreads(reader: Viewer, ownerId: string): boolean {
  return !!reader.admin || reader.id === ownerId;
}

const unspread = <P extends { ivs: unknown; evs: unknown; stats: unknown }>(p: P): P => ({ ...p, ivs: null, evs: null, stats: null });

export function withoutSpreads(data: Snapshot): Snapshot {
  return { ...data, pokemon: data.pokemon.map(unspread), fainted: data.fainted.map(unspread) };
}

export function slotsWithoutSpreads(slots: TeamSlots): ShownSlots {
  return slots.map((member) => (member && isFree(member) ? { ...member, evs: null, ivs: null } : member));
}
