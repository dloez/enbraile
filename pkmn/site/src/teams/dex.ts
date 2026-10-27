import { Dex } from "@pkmn/dex";
import { describeItem, describeMove, describeNature, describePokemon, statAt } from "../../shared/describe";
import { STATS, type BagItem, type Mon, type MoveInfo, type Nature } from "../../shared/mon";
import { isFree, type FreeMember } from "../../shared/team";
import { ownMon, type Member, type Slots, type Stocks } from "@/teams/team";

const gen = Dex.forGen(9);

const MINI_SETA_ID = "tinymushroom";

export const NATURES: readonly Nature[] = gen.natures
  .all()
  .map((entry) => describeNature(entry.id) as Nature)
  .sort((a, b) => Number(a.plus === null) - Number(b.plus === null) || a.name.localeCompare(b.name));

export function speciesAbilities(species: string): { base: string[]; hidden: string[] } {
  const entry = gen.species.get(species);
  if (!entry.exists) return { base: [], hidden: [] };
  const id = (name: string | undefined): string | null => (name ? gen.abilities.get(name).id : null);
  const base = [id(entry.abilities[0]), id(entry.abilities[1])].filter((a): a is string => a !== null && a !== "");
  const hidden = [id(entry.abilities.H)].filter((a): a is string => a !== null && a !== "" && !base.includes(a));
  return { base, hidden };
}

export function freeMon(member: FreeMember): Mon {
  const entry = gen.species.get(member.species);
  const mon = describePokemon(
    {
      species: member.species,
      nickname: null,
      gender: null,
      shiny: false,
      level: member.level,
      nature: member.nature,
      ability: member.ability,
      abilities: speciesAbilities(member.species),
      types: entry.exists ? entry.types.map((t) => t.toLowerCase()) : [],
      ivs: member.ivs,
      evs: member.evs,
      stats: null,
      moves: undefined,
    },
    -1,
  );
  const nat = mon.nature;
  return {
    ...mon,
    free: true,
    stats: entry.exists
      ? STATS.map((stat) => {
          const fight = statAt(stat, entry, member.ivs[stat], nat, 50, member.evs[stat]);
          return {
            stat,
            base: entry.baseStats[stat],
            iv: member.ivs[stat],
            ev: member.evs[stat],
            current: statAt(stat, entry, member.ivs[stat], nat, member.level, member.evs[stat]),
            fight,
            low: fight,
            high: fight,
          };
        })
      : null,
  };
}

export function withNature(mon: Mon, id: string): Mon {
  const entry = gen.species.get(mon.species.id);
  const nat = describeNature(id);
  if (!entry.exists || !mon.stats) return { ...mon, nature: nat };
  return {
    ...mon,
    nature: nat,
    stats: mon.stats.map((line) => ({
      ...line,
      current: line.iv !== null && line.ev !== null && mon.level !== null ? statAt(line.stat, entry, line.iv, nat, mon.level, line.ev) : line.current,
      fight: line.iv !== null ? statAt(line.stat, entry, line.iv, nat) : null,
      low: statAt(line.stat, entry, 0, nat),
      high: statAt(line.stat, entry, 31, nat),
    })),
  };
}

export function memberMon(member: Member | null, stocks: Stocks): Mon | undefined {
  if (!member) return undefined;
  if (isFree(member)) {
    const mon = freeMon(member);
    return mon.species.known ? mon : undefined;
  }
  const mon = ownMon(member, stocks);
  return mon && member.nature !== null ? withNature(mon, member.nature) : mon;
}

export function liveSlots(slots: Slots, stocks: Stocks): Slots {
  return slots.map((member) => (memberMon(member, stocks) ? member : null));
}

export const ANY_ITEMS: readonly BagItem[] = gen.items
  .all()
  .filter((entry) => entry.exists && !entry.isNonstandard && entry.id !== MINI_SETA_ID)
  .map((entry) => describeItem({ item: entry.id, quantity: 1 }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const MOVES: readonly MoveInfo[] = [
  ...new Map(
    gen.moves
      .all()
      .filter((move) => move.num > 0 && move.gen <= 5 && move.id !== "struggle")
      .map((move) => [move.id, describeMove(move.id)] as const),
  ).values(),
].sort((a, b) => a.name.localeCompare(b.name));
