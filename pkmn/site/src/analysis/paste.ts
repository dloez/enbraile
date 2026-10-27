import type { StatID, StatsTable } from "@pkmn/dex";

export interface PokemonSet {
  species: string;
  nickname: string;
  gender: "M" | "F" | "";
  item: string;
  ability: string;
  level: number;
  teraType: string;
  nature: string;
  natureGiven: boolean;
  evs: StatsTable;
  ivs: StatsTable;
  moves: string[];
}

const STAT_KEYS: Record<string, StatID> = { hp: "hp", atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe" };

function spread(text: string, fill: number): StatsTable {
  const out: StatsTable = { hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill };
  for (const part of text.split("/")) {
    const m = part.trim().match(/^(\d+)\s+(\w+)$/);
    const key = m ? STAT_KEYS[m[2].toLowerCase()] : undefined;
    if (m && key) out[key] = Number(m[1]);
  }
  return out;
}

function header(line: string): Pick<PokemonSet, "species" | "nickname" | "gender" | "item"> {
  let name = line;
  let item = "";
  const at = line.lastIndexOf(" @ ");
  if (at !== -1) {
    name = line.slice(0, at);
    item = line.slice(at + 3).trim();
  }
  name = name.trim();
  let gender: PokemonSet["gender"] = "";
  const g = name.match(/\s\((M|F)\)$/);
  if (g) {
    gender = g[1] as "M" | "F";
    name = name.slice(0, g.index).trim();
  }
  const n = name.match(/^(.*)\s\(([^()]+)\)$/);
  return n
    ? { species: n[2].trim(), nickname: n[1].trim(), gender, item }
    : { species: name, nickname: "", gender, item };
}

export function parsePaste(text: string, max = 6): PokemonSet[] {
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const team: PokemonSet[] = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0 || lines[0].startsWith("===")) continue;
    const set: PokemonSet = {
      ...header(lines[0]),
      ability: "",
      level: 100,
      teraType: "",
      nature: "Serious",
      natureGiven: false,
      evs: spread("", 0),
      ivs: spread("", 31),
      moves: [],
    };
    for (const line of lines.slice(1)) {
      let m: RegExpMatchArray | null;
      if (line.startsWith("-")) {
        const move = line.replace(/^-\s*/, "").trim();
        if (move) set.moves.push(move);
      } else if ((m = line.match(/^Ability:\s*(.+)$/i))) set.ability = m[1].trim();
      else if ((m = line.match(/^Level:\s*(\d+)/i))) set.level = Number(m[1]);
      else if ((m = line.match(/^Tera Type:\s*(\w+)/i))) set.teraType = m[1];
      else if ((m = line.match(/^EVs:\s*(.+)$/i))) set.evs = spread(m[1], 0);
      else if ((m = line.match(/^IVs:\s*(.+)$/i))) set.ivs = spread(m[1], 31);
      else if ((m = line.match(/^(\w+)\s+Nature/i))) {
        set.nature = m[1];
        set.natureGiven = true;
      }
    }
    if (set.species) team.push(set);
  }
  return team.slice(0, max);
}
