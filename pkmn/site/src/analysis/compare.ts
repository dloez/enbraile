import { moveVsMon } from "@/analysis/chart";
import { typesIn, type Gen } from "@/analysis/dex";
import { hasTag, STATS, type Member, type MoveData } from "@/analysis/member";
import type { Pool } from "@/analysis/pool";
import { relBulk, type Analysis } from "@/analysis/team";

export const OHKO = 100;
export const TWOHKO = 50;
export const WALL = 34;

const FIXED_DAMAGE = new Set(["seismictoss", "nightshade"]);
const USES_DEF = new Set(["psyshock", "psystrike", "secretsword"]);

const usable = (m: Member) => m.moves.filter((mv) => !mv.unknown && !mv.notInGen && mv.category !== "Status" && mv.power);

export function geomean(xs: readonly number[]): number {
  return Math.exp(xs.reduce((s, x) => s + Math.log(Math.max(x, 0.05)), 0) / (xs.length || 1));
}

export function weaknessLoad(team: readonly Member[], a: Analysis, pool: Pool): number {
  let load = 0;
  team.forEach((m, i) => {
    for (const t of typesIn(a.gen)) {
      const mult = a.members[i].def[t];
      if (mult > 1) load += mult / relBulk(m, t, pool);
    }
  });
  return load;
}

export interface Damage {
  min: number;
  max: number;
  mult: number;
}

export function calcHit(gen: Gen, a: Member, mv: MoveData, b: Member): Damage | null {
  const mult = moveVsMon(gen, mv, a.ability, b.types, b.ability);
  if (!mult) return null;
  const hp = b.stats.hp;
  if (FIXED_DAMAGE.has(mv.id)) {
    const d = (a.set.level / hp) * 100;
    return { min: d, max: d, mult };
  }
  if (!mv.power) return null;
  const phys = mv.category === "Physical";
  let A = mv.id === "bodypress" ? a.stats.def : mv.id === "foulplay" ? b.stats.atk : phys ? a.stats.atk : a.stats.spa;
  let D = phys || USES_DEF.has(mv.id) ? b.stats.def : b.stats.spd;
  if (phys && a.item === "choiceband") A *= 1.5;
  if (!phys && a.item === "choicespecs") A *= 1.5;
  if (phys && (a.ability === "hugepower" || a.ability === "purepower")) A *= 2;
  if (!phys && !USES_DEF.has(mv.id) && b.item === "assaultvest") D *= 1.5;
  if (phys && b.ability === "furcoat") D *= 2;
  let bp = mv.power;
  if (mv.id === "knockoff" && b.item && gen >= 6) bp *= 1.5;
  if (mv.id === "acrobatics" && !a.item) bp *= 2;
  const L = a.set.level;
  const base = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * bp * A) / D) / 50) + 2;
  let mod = mult;
  if (a.types.includes(mv.type)) mod *= a.ability === "adaptability" ? 2 : 1.5;
  if (a.item === "lifeorb") mod *= 1.3;
  if (a.item === "expertbelt" && mult > 1) mod *= 1.2;
  if (b.ability === "multiscale" || b.ability === "shadowshield") mod *= 0.5;
  return { min: ((Math.floor(base * 0.85) * mod) / hp) * 100, max: ((base * mod) / hp) * 100, mult };
}

export interface BestHit extends Damage {
  move: MoveData | null;
}

export function bestHit(gen: Gen, a: Member, b: Member): BestHit {
  let best: BestHit | null = null;
  const moves = [...usable(a), ...a.moves.filter((m) => FIXED_DAMAGE.has(m.id) && !m.notInGen)];
  for (const mv of moves) {
    const h = calcHit(gen, a, mv, b);
    if (h && (!best || h.max > best.max)) best = { ...h, move: mv };
  }
  return best ?? { min: 0, max: 0, mult: 1, move: null };
}

export interface DefenderHit extends BestHit {
  def: Member;
  by: Member | null;
}

export interface Pressure {
  per: DefenderHit[];
  mean: number;
  ohko: number;
  twohko: number;
  walls: number;
}

export function pressure(gen: Gen, attackers: readonly Member[], defenders: readonly Member[]): Pressure {
  const per = defenders.map((def) => {
    let top: DefenderHit = { def, by: null, min: 0, max: 0, mult: 1, move: null };
    for (const a of attackers) {
      const h = bestHit(gen, a, def);
      if (h.max > top.max) top = { ...h, def, by: a };
    }
    return top;
  });
  const mean = per.reduce((s, p) => s + Math.min((p.min + p.max) / 2, 100), 0) / (per.length || 1);
  return {
    per,
    mean,
    ohko: per.filter((p) => p.min >= OHKO).length,
    twohko: per.filter((p) => p.min >= TWOHKO && p.min < OHKO).length,
    walls: per.filter((p) => p.max < WALL).length,
  };
}

export function verdict(p: Damage): string {
  if (p.min >= OHKO) return "OHKO";
  if (p.max >= OHKO) return "possible OHKO";
  if (p.min >= TWOHKO) return "2HKO";
  if (p.max < WALL) return "walls it";
  return "";
}

export type Metrics = Record<string, number | string>;

export function metricsFor(team: readonly Member[], a: Analysis, pool: Pool): Metrics {
  const n = team.length || 1;
  const sum = (k: (typeof STATS)[number] | "bst") => team.reduce((s, m) => s + (k === "bst" ? m.bst : m.base[k]), 0);
  const top = a.archetype[0];
  return {
    size: team.length,
    archetype: top ? `${top.name} (${Math.round(top.pct * 100)}%)` : "",
    bst: sum("bst"),
    meanBst: sum("bst") / n,
    ...Object.fromEntries(STATS.map((k) => [`sum_${k}`, sum(k)])),
    meanPctBst: a.members.reduce((s, m) => s + m.pct.bst, 0) / n,
    meanSpe: team.reduce((s, m) => s + m.stats.spe, 0) / n,
    maxSpe: Math.max(...team.map((m) => m.stats.spe)),
    weakTotal: a.tDef.reduce((s, t) => s + t.weak, 0),
    resistTotal: a.tDef.reduce((s, t) => s + t.resist, 0),
    immuneTotal: a.tDef.reduce((s, t) => s + t.immune, 0),
    stacked: a.tDef.filter((t) => t.weak >= 3).length,
    unresisted: a.tDef.filter((t) => t.unresisted && t.weak > 0).length,
    weakLoad: weaknessLoad(team, a, pool),
    defScore: geomean(a.tDef.map((t) => t.best.D)),
    noAnswer: a.tDef.filter((t) => t.best.D < 1).length,
    seCovered: a.tOff.filter((t) => t.se > 0).length,
    uncovered: a.tOff.filter((t) => t.uncovered).length,
    offScore: geomean(a.tOff.map((t) => t.bestO.O)),
    offTotal: a.tOff.reduce((s, t) => s + t.bestO.O, 0),
    lowPressure: a.tOff.filter((t) => t.bestO.O < 1).length,
    synEdges: a.edges.length,
    synTotal: a.edges.reduce((s, e) => s + e.score, 0),
    mutual: a.edges.filter((e) => e.mutual).length / 2,
    hazards: team.filter((m) => hasTag(m, "hazard")).length,
    removal: team.filter((m) => hasTag(m, "removal")).length,
    recovery: team.filter((m) => hasTag(m, "recovery")).length,
    pivots: team.filter((m) => hasTag(m, "pivot")).length,
    priority: team.filter((m) => usable(m).some((mv) => mv.priority > 0)).length,
  };
}

export type Format = "int" | "f0" | "f2" | "pct" | "text";

export type ScoreRow =
  | { group: string }
  | { k: string; label: string; dir: -1 | 0 | 1; fmt: Format; hint?: string };

const STAT_LABEL = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" } as const;

export const SCORE_ROWS: readonly ScoreRow[] = [
  { group: "Overview" },
  { k: "size", label: "Pokémon", dir: 0, fmt: "int" },
  { k: "archetype", label: "Closest archetype", dir: 0, fmt: "text" },
  { group: "Stats" },
  { k: "bst", label: "Total BST", dir: 1, fmt: "int" },
  { k: "meanBst", label: "Mean BST", dir: 1, fmt: "f0" },
  { k: "meanPctBst", label: "Mean BST percentile in pool", dir: 1, fmt: "pct" },
  ...STATS.map((k) => ({ k: `sum_${k}`, label: `Σ base ${STAT_LABEL[k]}`, dir: 1 as const, fmt: "int" as const })),
  { k: "meanSpe", label: "Mean final Speed", dir: 1, fmt: "f0" },
  { k: "maxSpe", label: "Fastest member (final Speed)", dir: 1, fmt: "int" },
  { group: "Defence" },
  { k: "weakTotal", label: "Weaknesses (member × type)", dir: -1, fmt: "int", hint: "Sum over types of members weak to it" },
  { k: "resistTotal", label: "Resistances (member × type)", dir: 1, fmt: "int" },
  { k: "immuneTotal", label: "Immunities", dir: 1, fmt: "int" },
  { k: "stacked", label: "Stacked weaknesses (≥3 weak)", dir: -1, fmt: "int" },
  { k: "unresisted", label: "Weaknesses nobody resists", dir: -1, fmt: "int" },
  {
    k: "weakLoad",
    label: "Weighted weakness load",
    dir: -1,
    fmt: "f2",
    hint: "Σ multiplier ÷ relative bulk over every weakness: frail members' weaknesses weigh more",
  },
  {
    k: "defScore",
    label: "Weighted defensive coverage",
    dir: 1,
    fmt: "f2",
    hint: "Geometric mean over attacking types of the best switch-in's effective bulk D. 1.00 = average pool member taking a neutral hit",
  },
  { k: "noAnswer", label: "Types with no solid switch-in (< 1.00)", dir: -1, fmt: "int" },
  { group: "Offence" },
  { k: "seCovered", label: "Types hit super-effectively", dir: 1, fmt: "int" },
  { k: "uncovered", label: "Types nothing hits neutrally", dir: -1, fmt: "int" },
  {
    k: "offScore",
    label: "Weighted offensive coverage",
    dir: 1,
    fmt: "f2",
    hint: "Geometric mean over defending types of the team's best hit O. 1.00 = neutral 100 BP hit from an average attacker",
  },
  { k: "offTotal", label: "Σ weighted offence (all types)", dir: 1, fmt: "f2" },
  { k: "lowPressure", label: "Types with weak pressure (< 1.00)", dir: -1, fmt: "int" },
  { group: "Synergy" },
  { k: "synEdges", label: "Defensive synergy links", dir: 1, fmt: "int" },
  { k: "mutual", label: "Mutual cores", dir: 1, fmt: "int" },
  { k: "synTotal", label: "Σ weighted synergy", dir: 1, fmt: "f2" },
  { group: "Utility" },
  { k: "hazards", label: "Hazard setters", dir: 0, fmt: "int" },
  { k: "removal", label: "Hazard removal", dir: 0, fmt: "int" },
  { k: "recovery", label: "Reliable recovery", dir: 0, fmt: "int" },
  { k: "pivots", label: "Pivots", dir: 0, fmt: "int" },
  { k: "priority", label: "Priority users", dir: 0, fmt: "int" },
];

export function format(v: number | string, fmt: Format): string {
  if (typeof v === "string") return v;
  if (fmt === "f0") return v.toFixed(0);
  if (fmt === "pct") return String(Math.round(v * 100));
  if (fmt === "f2") return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return String(v);
}

export function winners(row: ScoreRow, metrics: readonly Metrics[]): boolean[] {
  if ("group" in row || row.dir === 0) return metrics.map(() => false);
  const vals = metrics.map((m) => m[row.k] as number);
  const target = row.dir > 0 ? Math.max(...vals) : Math.min(...vals);
  if (vals.every((v) => v === target)) return metrics.map(() => false);
  return vals.map((v) => v === target);
}

export function winCounts(metrics: readonly Metrics[]): number[] {
  const wins = metrics.map(() => 0);
  for (const row of SCORE_ROWS) winners(row, metrics).forEach((w, i) => w && wins[i]++);
  return wins;
}
