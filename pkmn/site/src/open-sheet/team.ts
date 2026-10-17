import type { Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";

export const TEAM_SIZE = 6;
export const MOVE_SLOTS = 4;
export const MINI_SETA = "tinymushroom";

export interface Member {
  index: number;
  species: string;
  item: string | null;
  ability: string | null;
  moves: (string | null)[];
}

export type Slots = (Member | null)[];

export function emptySlots(): Slots {
  return Array.from({ length: TEAM_SIZE }, () => null);
}

export function memberMon(member: Member | null, mons: readonly Mon[]): Mon | undefined {
  if (!member) return undefined;
  const mon = mons[member.index];
  return mon && mon.species.id === member.species ? mon : undefined;
}

export function liveSlots(slots: Slots, mons: readonly Mon[]): Slots {
  return slots.map((member) => (memberMon(member, mons) ? member : null));
}

export function slotOf(slots: Slots, mons: readonly Mon[], index: number): number {
  return slots.findIndex((member) => member !== null && member.index === index && memberMon(member, mons) !== undefined);
}

export function addMember(slots: Slots, mon: Mon): Slots | null {
  const free = slots.findIndex((member) => member === null);
  if (free < 0) return null;
  const next = [...slots];
  next[free] = {
    index: mon.index,
    species: mon.species.id,
    item: null,
    ability: null,
    moves: Array.from({ length: MOVE_SLOTS }, (_, at) => mon.learnable?.current[at]?.id ?? null),
  };
  return next;
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

export function teach(slots: Slots, slot: number, move: string): Slots {
  return change(slots, slot, (member) => {
    if (member.moves.includes(move)) return member;
    const moves = [...member.moves];
    const free = moves.indexOf(null);
    moves[free >= 0 ? free : MOVE_SLOTS - 1] = move;
    return { ...member, moves };
  });
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

export function nextTeamName(names: readonly string[]): string {
  let n = 1;
  while (names.includes(`Team ${n}`)) n += 1;
  return `Team ${n}`;
}
