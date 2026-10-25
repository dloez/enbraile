import type { Mon } from "@/teams/dex";
import type { Sheet } from "@/teams/schema";
import { MOVE_SLOTS, type TeamMember, type TeamSlots } from "../../shared/team";

export { emptySlots, lastFilled, MAX_TEAM_SIZE, MOVE_SLOTS, nextTeamName, PICK_SIZE, resized, TEAM_SIZE, TEAM_SIZES } from "../../shared/team";

export const MINI_SETA = "tinymushroom";

export type Member = TeamMember;

export type Slots = TeamSlots;

export interface Stock {
  sheet: Sheet;
  mons: readonly Mon[];
}

export type Stocks = ReadonlyMap<string, Stock>;

export function memberMon(member: Member | null, stocks: Stocks): Mon | undefined {
  if (!member) return undefined;
  const mon = stocks.get(member.source)?.mons[member.index];
  return mon && mon.species.id === member.species ? mon : undefined;
}

export function liveSlots(slots: Slots, stocks: Stocks): Slots {
  return slots.map((member) => (memberMon(member, stocks) ? member : null));
}

export function usedBy(slots: Slots, source: string): number {
  return slots.filter((member) => member?.source === source).length;
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

export function heldCount(slots: Slots, source: string, item: string, except?: number): number {
  return slots.filter((member, slot) => slot !== except && member?.source === source && member.item === item).length;
}

export function quantityOf(sheet: Sheet, item: string): number {
  return sheet.items.filter((entry) => entry.item === item).reduce((sum, entry) => sum + entry.quantity, 0);
}

export function itemsLeft(sheet: Sheet, slots: Slots, source: string, item: string, except?: number): number {
  return quantityOf(sheet, item) - heldCount(slots, source, item, except);
}

export function giveItem(sheet: Sheet, slots: Slots, slot: number, item: string): Slots | null {
  const member = slots[slot];
  if (!member || itemsLeft(sheet, slots, member.source, item, slot) <= 0) return null;
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

export function setasNeeded(slots: Slots, stocks: Stocks, source: string): number {
  return slots.filter((member) => member !== null && member.source === source && member.ability !== null && memberMon(member, stocks)).length;
}

export function setasLeft(slots: Slots, stocks: Stocks, source: string): number {
  const stock = stocks.get(source);
  return stock ? quantityOf(stock.sheet, MINI_SETA) - setasNeeded(slots, stocks, source) : 0;
}
