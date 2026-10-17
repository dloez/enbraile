import { toID } from "@pkmn/dex";
import { parsePaste } from "@/analysis/paste";
import { currentAbility, describeItem, describeMove, displayName, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import {
  emptySlots,
  itemsLeft,
  memberMon,
  MOVE_SLOTS,
  type Member,
  type Slots,
} from "@/open-sheet/team";

export const LEAGUE_EVS = "EVs: 1 HP / 1 Atk / 1 Def / 1 SpA / 1 SpD / 1 Spe";

function nameLine(member: Member, mon: Mon): string {
  const species = mon.species.name;
  const nick = mon.nickname?.trim();
  let line = nick && nick !== species ? `${nick} (${species})` : species;
  if (mon.gender === "M" || mon.gender === "F") line += ` (${mon.gender})`;
  if (member.item) line += ` @ ${describeItem({ item: member.item, quantity: 1 }).name}`;
  return line;
}

export function showdownMember(member: Member, mon: Mon): string {
  const lines = [nameLine(member, mon)];
  const abilityId = member.ability ?? currentAbility(mon);
  if (abilityId) {
    const ability = mon.abilities.find((a) => a.id === abilityId);
    lines.push(`Ability: ${ability?.name ?? abilityId}`);
  }
  lines.push("Level: 50");
  if (mon.shiny) lines.push("Shiny: Yes");
  lines.push(LEAGUE_EVS);
  if (mon.nature) lines.push(`${mon.nature.name} Nature`);
  for (const move of member.moves) if (move) lines.push(`- ${describeMove(move).name}`);
  return lines.join("\n");
}

export function showdownTeam(slots: Slots, mons: readonly Mon[]): string {
  return slots
    .flatMap((member) => {
      const mon = memberMon(member, mons);
      return member && mon && mon.species.known ? [showdownMember(member, mon)] : [];
    })
    .join("\n\n");
}

function moveId(name: string): string {
  const id = toID(name.split(" / ")[0]);
  return id.startsWith("hiddenpower") ? "hiddenpower" : id;
}

export interface ReadTeam {
  slots: Slots;
  added: number;
  left: string[];
}

export function readShowdownTeam(text: string, sheet: Sheet, mons: readonly Mon[]): ReadTeam {
  const sets = parsePaste(text);
  const slots = emptySlots();
  const left: string[] = [];
  const used = new Set<number>();
  let added = 0;

  for (const set of sets) {
    const id = toID(set.species);
    const same = mons.filter((mon) => mon.species.id === id && !used.has(mon.index));
    const mon = same.find((m) => set.nickname !== "" && m.nickname === set.nickname) ?? same[0];
    if (!mon) {
      left.push(
        mons.some((m) => m.species.id === id)
          ? `${set.species}: every one in this sheet is already on the team`
          : `${set.species}: not in this sheet`,
      );
      continue;
    }
    used.add(mon.index);
    const name = displayName(mon);
    const member: Member = {
      index: mon.index,
      species: mon.species.id,
      item: null,
      ability: null,
      moves: Array.from({ length: MOVE_SLOTS }, () => null),
    };

    if (set.item) {
      const item = describeItem({ item: toID(set.item), quantity: 1 });
      if (!item.known) left.push(`${name}'s ${set.item}: not an item the site can give`);
      else if (itemsLeft(sheet, slots, item.id) <= 0) left.push(`${name}'s ${item.name}: none left in the bag`);
      else member.item = item.id;
    }

    if (set.ability) {
      const ability = mon.abilities.find((a) => a.id === toID(set.ability));
      if (!ability) left.push(`${name}'s ${set.ability}: not one of its abilities`);
      else if (!ability.current) member.ability = ability.id;
    }

    let at = 0;
    for (const pasted of set.moves) {
      const move = describeMove(moveId(pasted));
      if (!move.known) left.push(`${name}'s ${pasted}: not a move Showdown knows`);
      else if (!member.moves.includes(move.id) && at < MOVE_SLOTS) member.moves[at++] = move.id;
    }

    slots[added] = member;
    added += 1;
  }

  return { slots, added, left };
}
