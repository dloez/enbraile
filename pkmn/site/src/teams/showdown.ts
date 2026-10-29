import { Dex, toID } from "@pkmn/dex";
import { parsePaste, type PokemonSet } from "@/analysis/paste";
import { currentAbility, displayName, type Mon, STATS, type StatID } from "../../shared/mon";
import { describeItem, describeMove } from "../../shared/describe";
import { ANY_ABILITIES, ANY_SPECIES_IDS, memberMon, NATURES, speciesAbilities } from "@/teams/dex";
import { emptySlots, freeSet, isFree, itemsLeft, MAX_TEAM_SIZE, naturePrice, TEAM_SIZE, MOVE_SLOTS, type FreeMember, type Member, type OwnMember, type Slots, type Stocks } from "@/teams/team";
import { describeMember } from "../../shared/species";
import { EV_TOTAL, MAX_EV, MAX_IV, MAX_LEVEL, type TeamSlots } from "../../shared/team";
import type { StatsTable } from "@pkmn/dex";
import { messages } from "../../shared/i18n";

const t = messages({
  en: {
    unknownNature: (name: string, nature: string) => `${name}'s ${nature} Nature: not a nature Showdown knows`,
    unknownItem: (name: string, item: string) => `${name}'s ${item}: not an item the site can give`,
    notItsAbility: (name: string, ability: string) => `${name}'s ${ability}: not one of its abilities`,
    unknownAbility: (name: string, ability: string) => `${name}'s ${ability}: not an ability the site can give`,
    unknownMove: (name: string, move: string) => `${name}'s ${move}: not a move Showdown knows`,
    unknownSpecies: (species: string) => `${species}: not a species the site can give`,
    allOnTeam: (species: string) => `${species}: every one in the team's sources is already on the team`,
    notInSources: (species: string) => `${species}: not in the team's sources`,
    noMint: (name: string, nature: string) => `${name}'s ${nature} Nature: no mint of it in its bag and not enough money to buy one`,
    noneLeft: (name: string, item: string) => `${name}'s ${item}: none left in its bag`,
  },
  es: {
    unknownNature: (name: string, nature: string) => `Naturaleza ${nature} de ${name}: Showdown no conoce esa naturaleza`,
    unknownItem: (name: string, item: string) => `${item} de ${name}: la web no puede dar ese objeto`,
    notItsAbility: (name: string, ability: string) => `${ability} de ${name}: no es una de sus habilidades`,
    unknownAbility: (name: string, ability: string) => `${ability} de ${name}: la web no puede dar esa habilidad`,
    unknownMove: (name: string, move: string) => `${move} de ${name}: Showdown no conoce ese movimiento`,
    unknownSpecies: (species: string) => `${species}: la web no puede dar esa especie`,
    allOnTeam: (species: string) => `${species}: todos los de las fuentes del equipo ya están en el equipo`,
    notInSources: (species: string) => `${species}: no está en las fuentes del equipo`,
    noMint: (name: string, nature: string) => `Naturaleza ${nature} de ${name}: no hay menta de ella en su mochila ni dinero para comprarla`,
    noneLeft: (name: string, item: string) => `${item} de ${name}: no queda ninguno en su mochila`,
  },
});

const gen = Dex.forGen(9);

const STAT_LABELS: Record<StatID, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };

function english(entry: { exists: boolean; name: string }, id: string): string {
  return entry.exists ? entry.name : id;
}

export const LEAGUE_EVS = "EVs: 1 HP / 1 Atk / 1 Def / 1 SpA / 1 SpD / 1 Spe";

function ivLine(ivs: StatsTable | null): string | null {
  if (!ivs) return null;
  const below = STATS.filter((stat) => ivs[stat] < MAX_IV).map((stat) => `${ivs[stat]} ${STAT_LABELS[stat]}`);
  return below.length ? `IVs: ${below.join(" / ")}` : null;
}

function evLine(evs: StatsTable | null): string | null {
  if (!evs) return null;
  const some = STATS.filter((stat) => evs[stat] > 0).map((stat) => `${evs[stat]} ${STAT_LABELS[stat]}`);
  return some.length ? `EVs: ${some.join(" / ")}` : null;
}

function nameLine(member: Member, mon: Mon): string {
  const species = mon.species.name;
  const nick = mon.nickname?.trim();
  let line = nick && nick !== species ? `${nick} (${species})` : species;
  if (mon.gender === "M" || mon.gender === "F") line += ` (${mon.gender})`;
  if (member.item) line += ` @ ${english(gen.items.get(member.item), describeItem({ item: member.item, quantity: 1 }).name)}`;
  return line;
}

export function showdownMember(member: Member, mon: Mon): string {
  const lines = [nameLine(member, mon)];
  const abilityId = member.ability ?? currentAbility(mon);
  if (abilityId) {
    lines.push(`Ability: ${english(gen.abilities.get(abilityId), abilityId)}`);
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
  if (mon.nature) lines.push(`${english(gen.natures.get(mon.nature.id), mon.nature.name)} Nature`);
  const ivs = ivLine(mon.ivs);
  if (ivs) lines.push(ivs);
  for (const move of member.moves) if (move) lines.push(`- ${english(gen.moves.get(move), move)}`);
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
  slots: TeamSlots;
  added: number;
  free: string[];
  left: string[];
}

export interface AnyPokemon {
  species: ReadonlySet<string>;
}

export const EVERY_SPECIES: AnyPokemon = { species: new Set(gen.species.all().map((entry) => entry.id)) };

export const ANY_POKEMON: AnyPokemon = { species: ANY_SPECIES_IDS };

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
  if (!nature) left.push(t.unknownNature(name, set.nature));
  if (set.item) {
    const item = describeItem({ item: toID(set.item), quantity: 1 });
    if (!item.known) left.push(t.unknownItem(name, set.item));
    else member.item = item.id;
  }
  if (set.ability) {
    const ability = ANY_ABILITIES.find((a) => a.id === toID(set.ability));
    if (ability) member.ability = ability.id;
    else left.push(t.unknownAbility(name, set.ability));
  }
  readMoves(set, member, name, left);
  return member;
}

function readMoves(set: PokemonSet, member: Member, name: string, left: string[]) {
  let at = 0;
  for (const pasted of set.moves) {
    const move = describeMove(moveId(pasted));
    if (!move.known) left.push(t.unknownMove(name, pasted));
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
          ? t.unknownSpecies(set.species)
          : all.some(({ mon }) => mon.species.id === id)
            ? t.allOnTeam(set.species)
            : t.notInSources(set.species),
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
      if (!nature) left.push(t.unknownNature(name, set.nature));
      else if (nature.id !== mon.nature?.id) {
        const price = naturePrice(slots, stocks, source, added, nature.id);
        if (price.by === "mint" || price.affordable) member.nature = nature.id;
        else left.push(t.noMint(name, nature.name));
      }
    }

    if (set.item) {
      const item = describeItem({ item: toID(set.item), quantity: 1 });
      if (!item.known) left.push(t.unknownItem(name, set.item));
      else if (itemsLeft(stock.sheet, slots, source, item.id) <= 0) left.push(t.noneLeft(name, item.name));
      else member.item = item.id;
    }

    if (set.ability) {
      const ability = mon.abilities.find((a) => a.id === toID(set.ability));
      if (!ability) left.push(t.notItsAbility(name, set.ability));
      else if (!ability.current) member.ability = ability.id;
    }

    readMoves(set, member, name, left);

    slots[added] = member;
    added += 1;
  }

  return { slots: slots.slice(0, Math.max(TEAM_SIZE, added)), added, free, left };
}
