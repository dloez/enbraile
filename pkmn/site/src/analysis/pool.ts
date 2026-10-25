import type { Species, StatsTable } from "@pkmn/dex";
import { available, dexFor, typesIn, type Gen } from "@/analysis/dex";
import { STATS, type Member } from "@/analysis/member";
import type { TeamPool } from "../../shared/pool";

export type PoolFilters = TeamPool;

export const DEFAULT_FILTERS: PoolFilters = { gen: 9, speciesGen: 9, noLegendary: false, noMythical: false, fullyEvolved: true, maxBst: 800 };

export interface PoolMember {
  name: string;
  id: string;
  gen: number;
  legendary: boolean;
  mythical: boolean;
  types: string[];
  st: StatsTable;
  bst: number;
}

export type Metric = "hp" | "atk" | "def" | "spa" | "spd" | "spe" | "bst" | "phys" | "spec" | "speedF" | "offF" | "bulkF";

export interface Distribution {
  sorted: Float64Array;
  median: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
}

export interface Pool {
  filters: PoolFilters;
  size: number;
  members: PoolMember[];
  excluded: Record<string, number>;
  dist: Record<Metric, Distribution>;
  physShare: Record<string, number>;
  metric: Record<Metric, (m: PoolMember) => number>;
  pct: (k: Metric, v: number) => number;
  ratio: (k: Metric, v: number) => number;
  quantile: (k: Metric, q: number) => number;
  cloud: () => { x: number; y: number; name: string }[];
  example: (k: Metric, q: number) => { name: string; v: number } | null;
}

const PHYSICAL_TYPES = new Set(["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel"]);

export function categoryByType(type: string): "Physical" | "Special" {
  return PHYSICAL_TYPES.has(type) ? "Physical" : "Special";
}

export const invested = (base: number) => 2 * base + 99;

function sameAsBase(gen: Gen, s: Species): boolean {
  if (!s.forme) return false;
  const base = dexFor(gen).species.get(s.baseSpecies);
  if (!base.exists || !STATS.every((k) => base.baseStats[k] === s.baseStats[k])) return false;
  return base.types.join() === s.types.join() || !!s.requiredItem || !!s.requiredItems?.length;
}

function selectable(gen: Gen, speciesGen: Gen, s: Species): boolean {
  return (
    available(s) &&
    s.gen <= Math.min(gen, speciesGen) &&
    !s.battleOnly &&
    !s.isMega &&
    !s.isPrimal &&
    s.forme !== "Gmax" &&
    !s.forme.includes("Totem") &&
    !sameAsBase(gen, s)
  );
}

const bstOf = (st: StatsTable) => STATS.reduce((a, k) => a + st[k], 0);

const isLegendary = (s: Species) => s.tags.includes("Restricted Legendary") || s.tags.includes("Sub-Legendary");
const isMythical = (s: Species) => s.tags.includes("Mythical");

function exclusion(s: Species, f: PoolFilters): string | null {
  if (f.noLegendary && isLegendary(s)) return "legendary";
  if (f.noMythical && isMythical(s)) return "mythical";
  if (f.fullyEvolved && s.nfe) return "not fully evolved";
  if (bstOf(s.baseStats) > f.maxBst) return `BST above ${f.maxBst}`;
  return null;
}

export function legality(member: Member, f: PoolFilters): string | null {
  if (member.introduced > Math.min(f.gen, f.speciesGen)) return `introduced in Gen ${member.introduced}`;
  if (f.noLegendary && member.legendary) return "legendary";
  if (f.noMythical && member.mythical) return "mythical";
  if (member.bst > f.maxBst) return `BST ${member.bst} > ${f.maxBst}`;
  return null;
}

function quantileOf(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function cdf(sorted: Float64Array, v: number): number {
  if (sorted.length === 0) return 0.5;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  let eq = lo;
  while (eq < sorted.length && sorted[eq] === v) eq++;
  return (lo + (eq - lo) / 2) / sorted.length;
}

const pools = new Map<string, Pool>();

export function buildPool(f: PoolFilters): Pool {
  const key = JSON.stringify(f);
  const cached = pools.get(key);
  if (cached) return cached;
  const members: PoolMember[] = [];
  const excluded: Record<string, number> = {};
  for (const s of dexFor(f.gen).species.all()) {
    if (!selectable(f.gen, f.speciesGen, s)) continue;
    const why = exclusion(s, f);
    if (why) {
      excluded[why] = (excluded[why] ?? 0) + 1;
      continue;
    }
    const st = { ...s.baseStats };
    members.push({ name: s.name, id: s.id, gen: s.gen, legendary: isLegendary(s), mythical: isMythical(s), types: [...s.types], st, bst: bstOf(st) });
  }

  const metric: Record<Metric, (m: PoolMember) => number> = {
    hp: (m) => m.st.hp,
    atk: (m) => m.st.atk,
    def: (m) => m.st.def,
    spa: (m) => m.st.spa,
    spd: (m) => m.st.spd,
    spe: (m) => m.st.spe,
    bst: (m) => m.bst,
    phys: (m) => m.st.hp * m.st.def,
    spec: (m) => m.st.hp * m.st.spd,
    speedF: (m) => invested(m.st.spe),
    offF: (m) => invested(Math.max(m.st.atk, m.st.spa)),
    bulkF: (m) => (2 * m.st.hp + 204) * Math.sqrt((2 * m.st.def + 67) * (2 * m.st.spd + 67)),
  };
  const dist = {} as Record<Metric, Distribution>;
  for (const k of Object.keys(metric) as Metric[]) {
    const sorted = Float64Array.from(members.map(metric[k])).sort();
    dist[k] = {
      sorted,
      median: quantileOf(sorted, 0.5) || 1,
      p5: quantileOf(sorted, 0.05),
      p25: quantileOf(sorted, 0.25),
      p75: quantileOf(sorted, 0.75),
      p95: quantileOf(sorted, 0.95),
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
    };
  }

  const physShare: Record<string, number> = {};
  for (const t of typesIn(f.gen)) {
    if (f.gen <= 3) {
      physShare[t] = categoryByType(t) === "Physical" ? 1 : 0;
      continue;
    }
    const users = members.filter((m) => m.types.includes(t));
    physShare[t] = users.length
      ? users.reduce((a, m) => a + (m.st.atk > m.st.spa ? 1 : m.st.atk === m.st.spa ? 0.5 : 0), 0) / users.length
      : 0.5;
  }

  const ranked = new Map<Metric, { name: string; v: number }[]>();
  const rankedOf = (k: Metric) => {
    let r = ranked.get(k);
    if (!r) {
      r = members.map((m) => ({ name: m.name, v: metric[k](m) })).sort((a, b) => a.v - b.v);
      ranked.set(k, r);
    }
    return r;
  };
  let cloud: { x: number; y: number; name: string }[] | null = null;

  const pool: Pool = {
    filters: { ...f },
    size: members.length,
    members,
    excluded,
    dist,
    physShare,
    metric,
    pct: (k, v) => cdf(dist[k].sorted, v),
    ratio: (k, v) => v / dist[k].median,
    quantile: (k, q) => quantileOf(dist[k].sorted, q),
    cloud: () =>
      (cloud ??= members.map((m) => ({
        x: cdf(dist.bulkF.sorted, metric.bulkF(m)),
        y: cdf(dist.offF.sorted, metric.offF(m)),
        name: m.name,
      }))),
    example: (k, q) => {
      const r = rankedOf(k);
      return r.length ? r[Math.min(r.length - 1, Math.max(0, Math.round(q * (r.length - 1))))] : null;
    },
  };
  pools.set(key, pool);
  return pool;
}
