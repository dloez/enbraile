import type { Mon } from "@/teams/dex";
import type { Sheet } from "@/teams/schema";
import { MOVE_SLOTS, type TeamMember, type TeamSlots } from "../../shared/team";

export { emptySlots, MOVE_SLOTS, nextTeamName, TEAM_SIZE } from "../../shared/team";

export const MINI_SETA = "tinymushroom";

export type Member = TeamMember;

export type Slots = TeamSlots;

export function memberMon(member: Member | null, mons: readonly Mon[]): Mon | undefined {
  if (!member) return undefined;
  const mon = mons[member.index];
  return mon && mon.species.id === member.species ? mon : undefined;
}

export function liveSlots(slots: Slots, mons: readonly Mon[], source: string): Slots {
  return slots.map((member) => (member?.source === source && memberMon(member, mons) ? member : null));
}


export function newMember(mon: Mon, source: string): Member {
  return {
    source,
    index: mon.index,
    species: mon.species.id,
    item: null,
    ability: null,
    moves: Array.from({ length: MOVE_SLOTS }, (_, at) => mon.learnable?.current[at]?.id ?? null),
  };
}

export function putMember(slots: Slots, slot: number, mon: Mon, source: string): Slots {
  const next = [...slots];
  next[slot] = newMember(mon, source);
  return next;
}

export function addMember(slots: Slots, mon: Mon, source: string): Slots | null {
  const free = slots.findIndex((member) => member === null);
  if (free < 0) return null;
  return putMember(slots, free, mon, source);
}

export function removeMember(slots: Slots, slot: number): Slots {
  const next = [...slots];
  next[slot] = null;
  return next;
}

function change(slots: Slots, slot: number, edit: (member: Member) => Member): Slots {
  const member = slots[slot];
  if (!member) return slots;
  const next = [...slots];
  next[slot] = edit(member);
  return next;
}

export function heldCount(slots: Slots, item: string, except?: number): number {
  return slots.filter((member, slot) => slot !== except && member?.item === item).length;
}

export function quantityOf(sheet: Sheet, item: string): number {
  return sheet.items.filter((entry) => entry.item === item).reduce((sum, entry) => sum + entry.quantity, 0);
}

export function itemsLeft(sheet: Sheet, slots: Slots, item: string, except?: number): number {
  return quantityOf(sheet, item) - heldCount(slots, item, except);
}

export function giveItem(sheet: Sheet, slots: Slots, slot: number, item: string): Slots | null {
  if (itemsLeft(sheet, slots, item, slot) <= 0) return null;
  return change(slots, slot, (member) => ({ ...member, item }));
}

export function takeItem(slots: Slots, slot: number): Slots {
  return change(slots, slot, (member) => ({ ...member, item: null }));
}


export function setMove(slots: Slots, slot: number, at: number, move: string | null): Slots {
  return change(slots, slot, (member) => {
    const moves = member.moves.map((m) => (m === move ? null : m));
    moves[at] = move;
    return { ...member, moves };
  });
}

export function setAbility(slots: Slots, slot: number, ability: string | null, current: string | null): Slots {
  return change(slots, slot, (member) => ({ ...member, ability: ability === current ? null : ability }));
}

export function setasNeeded(slots: Slots, mons: readonly Mon[]): number {
  return slots.filter((member) => member !== null && member.ability !== null && memberMon(member, mons)).length;
}
