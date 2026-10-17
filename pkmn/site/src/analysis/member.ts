import { toID, type StatID, type StatsTable } from "@pkmn/dex";
import { ATE_ABILITIES, abilityIn } from "@/analysis/chart";
import { dexFor, type Gen } from "@/analysis/dex";
import type { PokemonSet } from "@/analysis/paste";

export const STATS: readonly StatID[] = ["hp", "atk", "def", "spa", "spd", "spe"];

export type Category = "Physical" | "Special" | "Status";

export interface MoveData {
  name: string;
  id: string;
  type: string;
  category: Category;
  power: number;
  priority: number;
  accuracy: number | true;
  unknown: boolean;
  notInGen: boolean;
}

export interface Member {
  set: PokemonSet;
  species: string;
  display: string;
  id: string;
  introduced: number;
  legendary: boolean;
  mythical: boolean;
  types: string[];
  teraType: string;
  ability: string | null;
  item: string;
  base: StatsTable;
  bst: number;
  stats: StatsTable;
  moves: MoveData[];
  raw: { spe: number; off: number; bulk: number };
  offensiveItem: boolean;
  defensiveItem: boolean;
}

const tags = (ids: string) => new Set(ids.split(/\s+/).filter(Boolean));

export const MOVE_TAGS = {
  hazard: tags("stealthrock spikes toxicspikes stickyweb stoneaxe ceaselessedge"),
  removal: tags("rapidspin defog mortalspin tidyup courtchange"),
  pivot: tags("uturn voltswitch flipturn partingshot teleport chillyreception shedtail batonpass"),
  recovery: tags(`recover roost slackoff softboiled moonlight morningsun synthesis wish shoreup
    milkdrink rest strengthsap healorder junglehealing lunarblessing lifedew painsplit leechseed`),
  setup: tags(`swordsdance nastyplot dragondance calmmind bulkup quiverdance shellsmash shiftgear
    agility rockpolish coil bellydrum irondefense curse tailglow victorydance noretreat
    clangoroussoul geomancy cosmicpower autotomize growth workup howl honeclaws filletaway
    takeheart acidarmor amnesia cottonguard stockpile tidyup flamecharge trailblaze torchsong
    poweruppunch meteorbeam`),
  phaze: tags("whirlwind roar dragontail circlethrow haze clearsmog"),
  status: tags("toxic willowisp thunderwave spore sleeppowder yawn glare nuzzle hypnosis stunspore toxicthread"),
  screens: tags("reflect lightscreen auroraveil"),
  cleric: tags("healbell aromatherapy wish"),
  protect: tags("protect detect kingsshield spikyshield banefulbunker silktrap burningbulwark obstruct"),
};

export type MoveTag = keyof typeof MOVE_TAGS;

const ITEM_POWER: Record<string, number> = {
  choiceband: 1.5,
  choicespecs: 1.5,
  lifeorb: 1.3,
  boosterenergy: 1.3,
  expertbelt: 1.2,
  blackglasses: 1.2,
  mysticwater: 1.2,
  charcoal: 1.2,
  magnet: 1.2,
  miracleseed: 1.2,
  nevermeltice: 1.2,
  blackbelt: 1.2,
  poisonbarb: 1.2,
  softsand: 1.2,
  sharpbeak: 1.2,
  twistedspoon: 1.2,
  silverpowder: 1.2,
  hardstone: 1.2,
  spelltag: 1.2,
  dragonfang: 1.2,
  metalcoat: 1.2,
  fairyfeather: 1.2,
  silkscarf: 1.2,
  wellspringmask: 1.2,
  hearthflamemask: 1.2,
  cornerstonemask: 1.2,
};

const OFFENSIVE_ITEMS = tags("choiceband choicespecs lifeorb expertbelt boosterenergy weaknesspolicy throatspray whiteherb focussash");
const DEFENSIVE_ITEMS = tags("leftovers rockyhelmet blacksludge eviolite assaultvest");

export function hasTag(member: Member, tag: MoveTag): boolean {
  return member.moves.some((m) => MOVE_TAGS[tag].has(m.id));
}

export function realStats(gen: Gen, base: StatsTable, set: PokemonSet, maxHP: number | undefined): StatsTable {
  const nature = dexFor(gen).natures.get(set.nature);
  const level = set.level;
  const out = {} as StatsTable;
  for (const k of STATS) {
    const core = Math.floor(((2 * base[k] + set.ivs[k] + Math.floor(set.evs[k] / 4)) * level) / 100);
    if (k === "hp") out.hp = maxHP ?? core + level + 10;
    else {
      const f = nature.exists && nature.plus === k ? 1.1 : nature.exists && nature.minus === k ? 0.9 : 1;
      out[k] = Math.floor((core + 5) * f);
    }
  }
  return out;
}

function typeName(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";
}

function moveData(gen: Gen, raw: string, set: PokemonSet, types: readonly string[], ability: string | null): MoveData {
  const move = dexFor(gen).moves.get(raw);
  if (!move.exists) {
    return { name: raw, id: toID(raw), type: "Normal", category: "Status", power: 0, priority: 0, accuracy: true, unknown: true, notInGen: false };
  }
  let type: string = move.type;
  if (move.id === "terablast" && gen >= 9 && set.teraType && toID(set.teraType) !== "stellar") type = typeName(set.teraType);
  if (move.id === "ivycudgel") type = types.find((t) => t !== "Grass") ?? "Grass";
  const active = abilityIn(gen, ability);
  const ate = active ? ATE_ABILITIES[active] : undefined;
  if (ate && type === "Normal" && move.category !== "Status") type = ate;
  return {
    name: raw,
    id: move.id,
    type,
    category: move.category,
    power: move.basePower,
    priority: move.priority,
    accuracy: move.accuracy,
    unknown: false,
    notInGen: move.isNonstandard === "Future",
  };
}

export function buildMember(gen: Gen, set: PokemonSet): Member | null {
  const species = dexFor(gen).species.get(set.species);
  if (!species.exists) return null;
  const base = { ...species.baseStats };
  const types = [...species.types];
  const ability = gen < 3 ? null : toID(set.ability || species.abilities[0] || "") || null;
  const item = toID(set.item);
  const stats = realStats(gen, base, set, species.maxHP);
  const k = 100 / set.level;
  return {
    set,
    species: species.name,
    display: set.nickname ? `${set.nickname} (${species.name})` : species.name,
    id: species.id,
    introduced: species.gen,
    legendary: species.tags.includes("Restricted Legendary") || species.tags.includes("Sub-Legendary"),
    mythical: species.tags.includes("Mythical"),
    types,
    teraType: gen >= 9 ? typeName(set.teraType) : "",
    ability,
    item,
    base,
    bst: STATS.reduce((a, s) => a + base[s], 0),
    stats,
    moves: set.moves.map((m) => moveData(gen, m, set, types, ability)),
    raw: {
      spe: stats.spe * k,
      off: Math.max(stats.atk, stats.spa) * k,
      bulk: stats.hp * k * Math.sqrt(stats.def * k * stats.spd * k),
    },
    offensiveItem: OFFENSIVE_ITEMS.has(item) || item.startsWith("choice") || (ITEM_POWER[item] ?? 1) > 1,
    defensiveItem: DEFENSIVE_ITEMS.has(item),
  };
}

export function buildTeam(gen: Gen, sets: readonly PokemonSet[]): { team: Member[]; failed: string[] } {
  const team: Member[] = [];
  const failed: string[] = [];
  for (const set of sets) {
    const member = buildMember(gen, set);
    if (member) team.push(member);
    else failed.push(set.species);
  }
  return { team, failed };
}
