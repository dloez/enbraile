import { GENS, type Gen } from "@/analysis/dex";
import { DEFAULT_FILTERS, type PoolFilters } from "@/analysis/pool";

export interface CompareSlot {
  name: string;
  text: string;
}

export interface Drafts {
  paste: string;
  filters: PoolFilters;
  useTera: boolean;
  compare: CompareSlot[];
}

const KEY = "team-analysis:drafts";

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;

export const EMPTY: Drafts = {
  paste: "",
  filters: DEFAULT_FILTERS,
  useTera: false,
  compare: [
    { name: "Team A", text: "" },
    { name: "Team B", text: "" },
  ],
};

function filters(raw: unknown): PoolFilters {
  const f = { ...DEFAULT_FILTERS, ...(typeof raw === "object" && raw ? raw : {}) } as PoolFilters;
  const gen = GENS.includes(f.gen as Gen) ? f.gen : DEFAULT_FILTERS.gen;
  const maxBst = Number.isFinite(f.maxBst) ? Math.min(800, Math.max(150, f.maxBst)) : DEFAULT_FILTERS.maxBst;
  const speciesGen = GENS.includes(f.speciesGen as Gen) ? f.speciesGen : gen;
  return {
    gen,
    speciesGen,
    maxBst,
    noLegendary: !!f.noLegendary,
    noMythical: !!f.noMythical,
    fullyEvolved: !!f.fullyEvolved,
  };
}

function slots(raw: unknown): CompareSlot[] {
  if (!Array.isArray(raw)) return EMPTY.compare;
  const out = raw
    .filter((s): s is CompareSlot => typeof s?.name === "string" && typeof s?.text === "string")
    .slice(0, MAX_TEAMS);
  return out.length >= MIN_TEAMS ? out : EMPTY.compare;
}

export function loadDrafts(): Drafts {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    return {
      paste: typeof raw.paste === "string" ? raw.paste : "",
      filters: filters(raw.filters),
      useTera: !!raw.useTera,
      compare: slots(raw.compare),
    };
  } catch {
    return EMPTY;
  }
}

export function saveDrafts(drafts: Drafts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(drafts));
  } catch {
    return;
  }
}

export function carryTeam(paste: string) {
  saveDrafts({ ...loadDrafts(), paste });
}
