import { freeMon, type Mon } from "@/teams/dex";
import type { Sheet } from "@/teams/schema";
import { isFree, MAX_IV, MOVE_SLOTS, type FreeMember, type OwnMember, type TeamMember, type TeamSlots } from "../../shared/team";

export { emptySlots, isFree, lastFilled, MAX_TEAM_SIZE, MOVE_SLOTS, nextTeamName, PICK_SIZE, resized, TEAM_SIZE, TEAM_SIZES } from "../../shared/team";

export type { FreeMember, OwnMember } from "../../shared/team";

export const MINI_SETA = "tinymushroom";

export const MIN_COMPARED = 2;

export const MAX_COMPARED = 4;

export type Member = TeamMember;

export type Slots = TeamSlots;

export interface Stock {
  sheet: Sheet;
  mons: readonly Mon[];
}

export type Stocks = ReadonlyMap<string, Stock>;

export const EMPTY_SHEET: Sheet = { pokemon: [], items: [], tms: [] };

export function memberMon(member: Member | null, stocks: Stocks): Mon | undefined {
  if (!member) return undefined;
  if (isFree(member)) {
    const mon = freeMon(member);
    return mon.species.known ? mon : undefined;
  }
  const mon = stocks.get(member.source)?.mons[member.index];
  return mon && mon.species.id === member.species ? mon : undefined;
}

export function liveSlots(slots: Slots, stocks: Stocks): Slots {
  return slots.map((member) => (memberMon(member, stocks) ? member : null));
}

export function ownOf(member: Member | null): OwnMember | null {
  return member && !isFree(member) ? member : null;
}

export function usedBy(slots: Slots, source: string): number {
  return slots.filter((member) => ownOf(member)?.source === source).length;
}

export function freeCount(slots: Slots): number {
  return slots.filter((member) => member !== null && isFree(member)).length;
}

export type FreeSet = Pick<FreeMember, "level" | "nature" | "evs" | "ivs">;

export function freeSet(nature = "serious"): FreeSet {
  return {
    level: 50,
    nature,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: MAX_IV, atk: MAX_IV, def: MAX_IV, spa: MAX_IV, spd: MAX_IV, spe: MAX_IV },
  };
}

export function newFreeMember(species: string, ability: string | null, set: FreeSet): FreeMember {
  return { free: true, species, item: null, ability, ...set, moves: Array.from({ length: MOVE_SLOTS }, () => null) };
}

export function putFree(slots: Slots, slot: number, member: FreeMember): Slots {
  const next = [...slots];
  next[slot] = member;
  return next;
}

export function setFree(slots: Slots, slot: number, set: Partial<FreeSet>): Slots {
  const member = slots[slot];
  if (!member || !isFree(member)) return slots;
  const next = [...slots];
  next[slot] = { ...member, ...set };
  return next;
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
  return slots.filter((member, slot) => slot !== except && ownOf(member)?.source === source && member?.item === item).length;
}

export function quantityOf(sheet: Sheet, item: string): number {
  return sheet.items.filter((entry) => entry.item === item).reduce((sum, entry) => sum + entry.quantity, 0);
}

export function itemsLeft(sheet: Sheet, slots: Slots, source: string, item: string, except?: number): number {
  return quantityOf(sheet, item) - heldCount(slots, source, item, except);
}

export function giveItem(sheet: Sheet, slots: Slots, slot: number, item: string): Slots | null {
  const member = slots[slot];
  if (!member) return null;
  if (!isFree(member) && itemsLeft(sheet, slots, member.source, item, slot) <= 0) return null;
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
  return slots.filter((member) => ownOf(member)?.source === source && member?.ability !== null && memberMon(member, stocks)).length;
}

export function setasLeft(slots: Slots, stocks: Stocks, source: string): number {
  const stock = stocks.get(source);
  return stock ? quantityOf(stock.sheet, MINI_SETA) - setasNeeded(slots, stocks, source) : 0;
}
