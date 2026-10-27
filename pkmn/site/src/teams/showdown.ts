import { toID } from "@pkmn/dex";
import { parsePaste, type PokemonSet } from "@/analysis/paste";
import { currentAbility, displayName, type Mon, STAT_LABELS, STATS } from "../../shared/mon";
import { describeItem, describeMove } from "../../shared/describe";
import { memberMon, NATURES, speciesAbilities } from "@/teams/dex";
import { emptySlots, freeSet, isFree, itemsLeft, MAX_TEAM_SIZE, naturePrice, TEAM_SIZE, MOVE_SLOTS, type FreeMember, type Member, type OwnMember, type Slots, type Stocks } from "@/teams/team";
import { describeMember } from "../../shared/species";
import { EV_TOTAL, MAX_EV, MAX_IV, MAX_LEVEL } from "../../shared/team";
import type { StatsTable } from "@pkmn/dex";

export const LEAGUE_EVS = "EVs: 1 HP / 1 Atk / 1 Def / 1 SpA / 1 SpD / 1 Spe";

function ivLine(ivs: StatsTable | null): string | null {
  if (!ivs) return null;
  const below = STATS.filter((stat) => ivs[stat] < MAX_IV).map((stat) => `${ivs[stat]} ${STAT_LABELS[stat]}`);
  return below.length ? `IVs: ${below.join(" / ")}` : null;
}

function evLine(evs: StatsTable): string | null {
  const some = STATS.filter((stat) => evs[stat] > 0).map((stat) => `${evs[stat]} ${STAT_LABELS[stat]}`);
  return some.length ? `EVs: ${some.join(" / ")}` : null;
}

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
  if (isFree(member)) {
    if (member.level !== MAX_LEVEL) lines.push(`Level: ${member.level}`);
    const evs = evLine(member.evs);
    if (evs) lines.push(evs);
  } else {
    lines.push("Level: 50");
    if (mon.shiny) lines.push("Shiny: Yes");
    lines.push(LEAGUE_EVS);
  }
  if (mon.nature) lines.push(`${mon.nature.name} Nature`);
  const ivs = ivLine(mon.ivs);
  if (ivs) lines.push(ivs);
  for (const move of member.moves) if (move) lines.push(`- ${describeMove(move).name}`);
  return lines.join("\n");
}

export function showdownTeam(slots: Slots, stocks: Stocks): string {
  return slots
    .flatMap((member) => {
      const mon = memberMon(member, stocks);
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
  free: string[];
  left: string[];
}

export interface AnyPokemon {
  species: ReadonlySet<string>;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Math.round(value)));

function capped(evs: StatsTable): StatsTable {
  const out = { ...evs };
  let total = 0;
  for (const stat of STATS) {
    out[stat] = clamp(out[stat], 0, Math.min(MAX_EV, EV_TOTAL - total));
    total += out[stat];
  }
  return out;
}

function freeFromSet(set: PokemonSet, species: string, name: string, left: string[]): FreeMember {
  const abilities = speciesAbilities(species);
  const all = [...abilities.base, ...abilities.hidden];
  const nature = NATURES.find((n) => n.id === toID(set.nature));
  const member: FreeMember = {
    free: true,
    species,
    item: null,
    ability: all[0] ?? null,
    ...freeSet(),
    level: clamp(set.level, 1, MAX_LEVEL),
    nature: nature?.id ?? freeSet().nature,
    evs: capped(set.evs),
    ivs: { ...set.ivs },
    moves: Array.from({ length: MOVE_SLOTS }, () => null),
  };
  for (const stat of STATS) member.ivs[stat] = clamp(member.ivs[stat], 0, MAX_IV);
  if (!nature) left.push(`${name}'s ${set.nature} Nature: not a nature Showdown knows`);
  if (set.item) {
    const item = describeItem({ item: toID(set.item), quantity: 1 });
    if (!item.known) left.push(`${name}'s ${set.item}: not an item the site can give`);
    else member.item = item.id;
  }
  if (set.ability) {
    const ability = toID(set.ability);
    if (all.includes(ability)) member.ability = ability;
    else left.push(`${name}'s ${set.ability}: not one of its abilities`);
  }
  readMoves(set, member, name, left);
  return member;
}

function readMoves(set: PokemonSet, member: Member, name: string, left: string[]) {
  let at = 0;
  for (const pasted of set.moves) {
    const move = describeMove(moveId(pasted));
    if (!move.known) left.push(`${name}'s ${pasted}: not a move Showdown knows`);
    else if (!member.moves.includes(move.id) && at < MOVE_SLOTS) member.moves[at++] = move.id;
  }
}

export function readShowdownTeam(text: string, stocks: Stocks, any: AnyPokemon | null): ReadTeam {
  const sets = parsePaste(text, MAX_TEAM_SIZE);
  const slots = emptySlots(MAX_TEAM_SIZE);
  const left: string[] = [];
  const free: string[] = [];
  const used = new Set<string>();
  const all = [...stocks].flatMap(([source, stock]) => stock.mons.map((mon) => ({ source, stock, mon })));
  let added = 0;

  for (const set of sets) {
    const id = toID(set.species);
    const same = all.filter(({ source, mon }) => mon.species.id === id && !used.has(`${source}:${mon.index}`));
    const found = same.find(({ mon }) => set.nickname !== "" && mon.nickname === set.nickname) ?? same[0];
    if (!found) {
      const species = describeMember(id, set.species);
      if (any && any.species.has(id)) {
        slots[added] = freeFromSet(set, id, species.name, left);
        free.push(species.name);
        added += 1;
        continue;
      }
      left.push(
        any
          ? `${set.species}: not in the team's pool`
          : all.some(({ mon }) => mon.species.id === id)
            ? `${set.species}: every one in the team's sources is already on the team`
            : `${set.species}: not in the team's sources`,
      );
      continue;
    }
    const { source, stock, mon } = found;
    used.add(`${source}:${mon.index}`);
    const name = displayName(mon);
    const member: OwnMember = {
      source,
      index: mon.index,
      species: mon.species.id,
      item: null,
      ability: null,
      nature: null,
      moves: Array.from({ length: MOVE_SLOTS }, () => null),
    };

    if (set.natureGiven) {
      const nature = NATURES.find((n) => n.id === toID(set.nature));
      if (!nature) left.push(`${name}'s ${set.nature} Nature: not a nature Showdown knows`);
      else if (nature.id !== mon.nature?.id) {
        const price = naturePrice(slots, stocks, source, added, nature.id);
        if (price.by === "mint" || price.affordable) member.nature = nature.id;
        else left.push(`${name}'s ${nature.name} Nature: no mint of it in its bag and not enough money to buy one`);
      }
    }

    if (set.item) {
      const item = describeItem({ item: toID(set.item), quantity: 1 });
      if (!item.known) left.push(`${name}'s ${set.item}: not an item the site can give`);
      else if (itemsLeft(stock.sheet, slots, source, item.id) <= 0) left.push(`${name}'s ${item.name}: none left in its bag`);
      else member.item = item.id;
    }

    if (set.ability) {
      const ability = mon.abilities.find((a) => a.id === toID(set.ability));
      if (!ability) left.push(`${name}'s ${set.ability}: not one of its abilities`);
      else if (!ability.current) member.ability = ability.id;
    }

    readMoves(set, member, name, left);

    slots[added] = member;
    added += 1;
  }

  return { slots: slots.slice(0, Math.max(TEAM_SIZE, added)), added, free, left };
}
