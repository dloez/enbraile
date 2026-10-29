import type { Mon } from "../../shared/mon";
import { locale } from "../../shared/i18n";
import { describePokemon } from "../../shared/describe";
import { DEFAULT_COSTS, type GameCosts } from "../../shared/games";
import { fightItems, setasOf } from "../../shared/items";
import type { Sheet } from "@/teams/schema";
import { FREE_LEVEL, FREE_NATURE, isFree, MAX_IV, MOVE_SLOTS, type FreeMember, type OwnMember, type ShownMember, type ShownSlots, type TeamSource } from "../../shared/team";

export { emptySlots, isFree, lastFilled, spreadShown, MAX_TEAM_SIZE, MOVE_SLOTS, nextTeamName, PICK_SIZE, resized, TEAM_SIZE, TEAM_SIZES } from "../../shared/team";

export type { FreeMember, OwnMember, ShownFreeMember } from "../../shared/team";

export type Member = ShownMember;

export type Slots = ShownSlots;

export interface Stock {
  sheet: Sheet;
  mons: readonly Mon[];
  money: number | null;
  mints: ReadonlyMap<string, number>;
  costs: GameCosts;
}

export type Stocks = ReadonlyMap<string, Stock>;

export const EMPTY_SHEET: Sheet = { pokemon: [], items: [], tms: [] };

const MINT = /^([a-z]+)mint$/;

function mintsOf(source: TeamSource): Map<string, number> {
  const mints = new Map<string, number>();
  for (const entry of source.snapshot.items) {
    const nature = MINT.exec(entry.item.toLowerCase())?.[1];
    if (nature) mints.set(nature, (mints.get(nature) ?? 0) + entry.quantity);
  }
  return mints;
}

export function stockOf(source: TeamSource): Stock {
  return {
    sheet: source.snapshot,
    mons: source.snapshot.pokemon.map((p, index) => describePokemon(p, index, false, source.spreadHidden)),
    money: source.snapshot.trainer.money,
    mints: mintsOf(source),
    costs: source.costs ?? DEFAULT_COSTS,
  };
}

export function ownMon(member: OwnMember, stocks: Stocks): Mon | undefined {
  const mon = stocks.get(member.source)?.mons[member.index];
  return mon && mon.species.id === member.species ? mon : undefined;
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

export function freeSet(nature = FREE_NATURE): FreeSet {
  return {
    level: FREE_LEVEL,
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

export function newMember(mon: Mon, source: string): OwnMember {
  return {
    source,
    index: mon.index,
    species: mon.species.id,
    item: null,
    ability: null,
    nature: null,
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
  return fightItems(sheet.items).find((entry) => entry.item === item)?.quantity ?? 0;
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

function changing(slots: Slots, stocks: Stocks, source: string, except?: number): OwnMember[] {
  return slots.flatMap((member, slot) => {
    const own = ownOf(member);
    return own?.source === source && slot !== except && ownMon(own, stocks) ? [own] : [];
  });
}

export function setasNeeded(slots: Slots, stocks: Stocks, source: string, except?: number): number {
  const cost = stocks.get(source)?.costs.abilitySetas ?? 0;
  return changing(slots, stocks, source, except).filter((own) => own.ability !== null).length * cost;
}

export function setasLeft(slots: Slots, stocks: Stocks, source: string, except?: number): number {
  const stock = stocks.get(source);
  return stock ? setasOf(stock.sheet.items) - setasNeeded(slots, stocks, source, except) : 0;
}

export function setNature(slots: Slots, slot: number, nature: string, current: string | null): Slots {
  return change(slots, slot, (member) => (isFree(member) ? member : { ...member, nature: nature === current ? null : nature }));
}

export function formatMoney(amount: number): string {
  return `${amount < 0 ? "−" : ""}$${Math.abs(amount).toLocaleString(locale)}`;
}

export function natureFrom(slots: Slots, stocks: Stocks, slot: number): "mint" | "money" | null {
  const own = ownOf(slots[slot] ?? null);
  if (!own || own.nature === null) return null;
  const earlier = slots.slice(0, slot).filter((member) => {
    const other = ownOf(member);
    return other?.source === own.source && other.nature === own.nature && ownMon(other, stocks);
  }).length;
  return earlier < (stocks.get(own.source)?.mints.get(own.nature) ?? 0) ? "mint" : "money";
}

export interface NatureSpend {
  mints: number;
  money: number;
}

export function natureSpend(slots: Slots, stocks: Stocks, source: string, except?: number): NatureSpend {
  const stock = stocks.get(source);
  if (!stock) return { mints: 0, money: 0 };
  const wanted = new Map<string, number>();
  for (const own of changing(slots, stocks, source, except)) if (own.nature !== null) wanted.set(own.nature, (wanted.get(own.nature) ?? 0) + 1);
  let mints = 0;
  let bought = 0;
  for (const [nature, count] of wanted) {
    const held = Math.min(count, stock.mints.get(nature) ?? 0);
    mints += held;
    bought += count - held;
  }
  return { mints, money: bought * stock.costs.mintPrice };
}

export function moneyLeft(slots: Slots, stocks: Stocks, source: string, except?: number): number | null {
  const money = stocks.get(source)?.money ?? null;
  return money === null ? null : money - natureSpend(slots, stocks, source, except).money;
}

export function mintsLeft(slots: Slots, stocks: Stocks, source: string, nature: string, except?: number): number {
  const held = stocks.get(source)?.mints.get(nature) ?? 0;
  const used = changing(slots, stocks, source, except).filter((own) => own.nature === nature).length;
  return Math.max(0, held - used);
}

export type NaturePrice = { by: "mint" } | { by: "money"; price: number; affordable: boolean };

export function naturePrice(slots: Slots, stocks: Stocks, source: string, slot: number, nature: string): NaturePrice {
  if (mintsLeft(slots, stocks, source, nature, slot) > 0) return { by: "mint" };
  const price = stocks.get(source)?.costs.mintPrice ?? 0;
  const left = moneyLeft(slots, stocks, source, slot);
  return { by: "money", price, affordable: price === 0 || (left !== null && left >= price) };
}
