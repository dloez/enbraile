import { damageTaken, moveVsType } from "../../shared/chart";
import { typesIn, type Gen } from "../../shared/dex";
import { hasTag, STATS, type Member, type MoveData } from "@/analysis/member";
import type { Metric, Pool } from "@/analysis/pool";

export type Profile = Record<string, number>;

export interface Indices {
  speed: number;
  offense: number;
  bulk: number;
}

export interface MemberAnalysis {
  member: Member;
  def: Profile;
  indices: Indices;
  roles: string[];
  pct: Record<string, number>;
}

export const IMMUNE_AS = 0.125;

const usable = (m: Member) => m.moves.filter((mv) => !mv.unknown && !mv.notInGen);

export function relBulk(m: Member, type: string, pool: Pool): number {
  const s = pool.physShare[type] ?? 0.5;
  return s * pool.ratio("phys", m.base.hp * m.base.def) + (1 - s) * pool.ratio("spec", m.base.hp * m.base.spd);
}

export function defValue(m: Member, type: string, mult: number, pool: Pool): number {
  return relBulk(m, type, pool) / Math.max(mult, IMMUNE_AS);
}

export interface Hit {
  O: number;
  move: MoveData | null;
}

export function offValue(gen: Gen, m: Member, type: string, pool: Pool): Hit {
  let best: Hit = { O: 0, move: null };
  for (const mv of usable(m)) {
    if (mv.category === "Status" || !mv.power) continue;
    const mult = moveVsType(gen, mv, type, m.ability);
    const stat = mv.category === "Physical" ? "atk" : "spa";
    const O = mult * (m.types.includes(mv.type) ? 1.5 : 1) * (mv.power / 100) * pool.ratio(stat, m.base[stat]);
    if (O > best.O) best = { O, move: mv };
  }
  return best;
}

export function defenseProfile(gen: Gen, m: Member, useTera: boolean): Profile {
  const types = useTera && gen >= 9 && m.teraType && m.teraType !== "Stellar" ? [m.teraType] : m.types;
  return Object.fromEntries(typesIn(gen).map((t) => [t, damageTaken(gen, t, types, m.ability)]));
}

export interface SynergyEdge {
  from: number;
  to: number;
  types: string[];
  immune: string[];
  perType: Record<string, number>;
  score: number;
  mutual: boolean;
}

export function synergyEdges(gen: Gen, team: readonly Member[], defs: readonly Profile[], pool: Pool): SynergyEdge[] {
  const edges: SynergyEdge[] = [];
  for (let i = 0; i < team.length; i++) {
    for (let j = 0; j < team.length; j++) {
      if (i === j) continue;
      const types = typesIn(gen).filter((t) => defs[i][t] > 1 && defs[j][t] < 1);
      if (types.length === 0) continue;
      const perType = Object.fromEntries(types.map((t) => [t, defValue(team[j], t, defs[j][t], pool)]));
      const score = types.reduce((a, t) => a + Math.min(perType[t], 4), 0);
      edges.push({ from: i, to: j, types, immune: types.filter((t) => defs[j][t] === 0), perType, score, mutual: false });
    }
  }
  for (const e of edges) e.mutual = edges.some((o) => o.from === e.to && o.to === e.from);
  return edges;
}

export interface DefenceRow {
  type: string;
  ms: number[];
  ds: number[];
  best: { idx: number; D: number };
  weak: number;
  resist: number;
  immune: number;
  quad: number;
  score: number;
  unresisted: boolean;
}

export function teamDefense(gen: Gen, team: readonly Member[], defs: readonly Profile[], pool: Pool): DefenceRow[] {
  return typesIn(gen).map((t) => {
    const ms = defs.map((d) => d[t]);
    const ds = team.map((m, i) => defValue(m, t, ms[i], pool));
    const idx = ds.indexOf(Math.max(...ds));
    const weak = ms.filter((m) => m > 1).length;
    const resist = ms.filter((m) => m < 1).length;
    const immune = ms.filter((m) => m === 0).length;
    const quad = ms.filter((m) => m >= 4).length;
    return {
      type: t,
      ms,
      ds,
      best: { idx, D: ds[idx] },
      weak,
      resist,
      immune,
      quad,
      score: weak + quad * 0.5 - resist - immune * 0.5,
      unresisted: resist === 0,
    };
  });
}

export interface OffenceCell {
  mult: number | null;
  move: MoveData | null;
  stab: boolean;
}

export function offenseProfile(gen: Gen, m: Member): Record<string, OffenceCell> {
  const attacks = usable(m).filter((mv) => mv.category !== "Status");
  const out: Record<string, OffenceCell> = {};
  for (const t of typesIn(gen)) {
    let best = 0;
    let by: MoveData | null = null;
    let stab = false;
    for (const mv of attacks) {
      const mult = moveVsType(gen, mv, t, m.ability);
      const s = m.types.includes(mv.type);
      if (mult > best || (mult === best && s && !stab)) {
        best = mult;
        by = mv;
        stab = s;
      }
    }
    out[t] = { mult: attacks.length ? best : null, move: by, stab };
  }
  return out;
}

export interface OffenceRow {
  type: string;
  ms: number[];
  os: Hit[];
  bestO: Hit & { idx: number };
  se: number;
  best: number;
  uncovered: boolean;
}

export function teamOffense(gen: Gen, team: readonly Member[], offs: readonly Record<string, OffenceCell>[], pool: Pool): OffenceRow[] {
  return typesIn(gen).map((t) => {
    const ms = offs.map((o) => o[t].mult ?? 0);
    const os = team.map((m) => offValue(gen, m, t, pool));
    const idx = os.reduce((b, o, i) => (o.O > os[b].O ? i : b), 0);
    const best = Math.max(0, ...ms);
    return { type: t, ms, os, bestO: { idx, ...os[idx] }, se: ms.filter((m) => m > 1).length, best, uncovered: best < 1 };
  });
}

export type Feature = "speed" | "offense" | "bulk" | "recovery" | "status" | "setup" | "pivot" | "offItems";

export const FEATURES: readonly { key: Feature; label: string; w: number }[] = [
  { key: "speed", label: "Speed", w: 1.0 },
  { key: "offense", label: "Offense", w: 1.2 },
  { key: "bulk", label: "Bulk", w: 1.2 },
  { key: "recovery", label: "Recovery", w: 1.2 },
  { key: "status", label: "Status moves", w: 1.0 },
  { key: "setup", label: "Setup", w: 0.8 },
  { key: "pivot", label: "Pivoting", w: 0.6 },
  { key: "offItems", label: "Offensive items", w: 0.8 },
];

export type Features = Record<Feature, number>;

export type ArchetypeName = "Hyper Offense" | "Bulky Offense" | "Balance" | "Stall";

export const ARCHETYPES: Record<ArchetypeName, { proto: Features; blurb: string; wants: string[] }> = {
  "Hyper Offense": {
    proto: { speed: 0.8, offense: 0.85, bulk: 0.15, recovery: 0.05, status: 0.12, setup: 0.45, pivot: 0.1, offItems: 0.8 },
    blurb:
      "Overwhelm the opponent before they can set up a defensive game. Typically a hazard/screens lead, 2 setup sweepers, 2 wallbreakers and a fast cleaner. Very weak to priority, status and losing tempo.",
    wants: ["Suicide lead / hazards or screens", "Multiple setup sweepers", "Wallbreakers", "Speed control (Scarf / priority)"],
  },
  "Bulky Offense": {
    proto: { speed: 0.55, offense: 0.72, bulk: 0.4, recovery: 0.2, status: 0.15, setup: 0.3, pivot: 0.35, offItems: 0.45 },
    blurb:
      "Strong attackers that can still switch in on hits. Chips the opponent with pivoting (U-turn / Volt Switch) so that late-game threats can clean. Wants hazards, removal and a bit of recovery.",
    wants: ["Pivots for momentum", "Hazard setter + removal", "Bulky attackers / Assault Vest", "A late-game cleaner"],
  },
  Balance: {
    proto: { speed: 0.45, offense: 0.55, bulk: 0.55, recovery: 0.45, status: 0.3, setup: 0.2, pivot: 0.3, offItems: 0.25 },
    blurb:
      "Defensive cores (Fire/Water/Grass, Dragon/Steel/Fairy…) supporting a few strong threats. Adaptable but every member has to pull weight: usually a wall, a stallbreaker and a sweeper.",
    wants: ["A defensive core with mutual coverage", "Reliable recovery on walls", "Hazards + removal", "1–2 win conditions"],
  },
  Stall: {
    proto: { speed: 0.15, offense: 0.15, bulk: 0.88, recovery: 0.9, status: 0.55, setup: 0.1, pivot: 0.15, offItems: 0 },
    blurb:
      "The bulkiest mons in the tier with reliable recovery, winning through hazards, status and passive damage. Struggles against strong wallbreakers and setup that it cannot phaze.",
    wants: ["Recovery on (almost) every member", "Status spreaders (Toxic / WoW)", "Hazards + removal", "Phazing / Haze vs setup"],
  },
};

export function indicesOf(m: Member, pool: Pool): Indices {
  return {
    speed: pool.pct("speedF", m.raw.spe),
    offense: pool.pct("offF", m.raw.off),
    bulk: pool.pct("bulkF", m.raw.bulk),
  };
}

export function rolesFor(m: Member, ix: Indices): string[] {
  const has = (tag: Parameters<typeof hasTag>[1]) => hasTag(m, tag);
  const attacks = m.moves.filter((mv) => mv.category !== "Status");
  const r: string[] = [];
  if (has("hazard")) r.push(m.item === "focussash" ? "Lead / Hazards" : "Hazard setter");
  if (has("removal")) r.push("Hazard removal");
  if (has("pivot")) r.push("Pivot");
  if (has("screens")) r.push("Screens");
  if (has("cleric")) r.push("Cleric");
  if (has("phaze")) r.push("Phazer");
  const statusHeavy = m.moves.filter((mv) => mv.category === "Status").length >= 3;
  if (ix.bulk > 0.6 && (has("recovery") || m.item === "leftovers" || statusHeavy) && ix.offense < 0.6) r.push("Wall");
  else if (ix.bulk > 0.65 && has("recovery")) r.push("Bulky attacker");
  if (has("setup") && attacks.length >= 2) r.push("Setup sweeper");
  if (
    ["choiceband", "choicespecs", "lifeorb"].includes(m.item) ||
    (ix.offense > 0.85 && !has("setup") && attacks.length >= 3 && m.item !== "focussash")
  )
    r.push("Wallbreaker");
  if (m.item === "choicescarf") r.push("Revenge killer");
  else if (attacks.some((mv) => mv.priority > 0)) r.push("Priority");
  else if (ix.speed >= 0.8 && ix.offense >= 0.7 && !r.includes("Setup sweeper")) r.push("Fast attacker");
  if (r.length === 0) r.push(attacks.length >= 3 ? "Attacker" : "Support");
  return r;
}

export function teamFeatures(members: readonly MemberAnalysis[]): Features {
  const n = members.length || 1;
  const avg = (f: (a: MemberAnalysis) => number) => members.reduce((s, a) => s + f(a), 0) / n;
  const totalMoves = members.reduce((s, a) => s + a.member.moves.length, 0) || 1;
  return {
    speed: avg((a) => a.indices.speed),
    offense: avg((a) => a.indices.offense),
    bulk: avg((a) => a.indices.bulk),
    recovery: avg((a) =>
      hasTag(a.member, "recovery") ? 1 : ["leftovers", "blacksludge"].includes(a.member.item) ? 0.35 : 0,
    ),
    status: members.reduce((s, a) => s + a.member.moves.filter((mv) => mv.category === "Status").length, 0) / totalMoves,
    setup: avg((a) => (hasTag(a.member, "setup") ? 1 : 0)),
    pivot: avg((a) => (hasTag(a.member, "pivot") ? 1 : 0)),
    offItems: avg((a) => (a.member.offensiveItem ? 1 : 0)),
  };
}

export interface ArchetypeMatch {
  name: ArchetypeName;
  pct: number;
  dist: number;
}

export function classify(features: Features): ArchetypeMatch[] {
  const dists = (Object.entries(ARCHETYPES) as [ArchetypeName, (typeof ARCHETYPES)[ArchetypeName]][]).map(([name, a]) => ({
    name,
    d2: FEATURES.reduce((s, f) => s + f.w * (features[f.key] - a.proto[f.key]) ** 2, 0),
  }));
  const tau = 0.12;
  const ws = dists.map((d) => Math.exp(-d.d2 / tau));
  const total = ws.reduce((a, b) => a + b, 0);
  return dists
    .map((d, i) => ({ name: d.name, pct: ws[i] / total, dist: Math.sqrt(d.d2) }))
    .sort((a, b) => b.pct - a.pct);
}

export type CheckLevel = "good" | "info" | "warn" | "bad";

export interface Check {
  level: CheckLevel;
  text: string;
}

const SPEED_CONTROL = new Set(["thunderwave", "tailwind", "trickroom", "stickyweb", "icywind", "electroweb"]);

export function checklist(
  members: readonly MemberAnalysis[],
  tDef: readonly DefenceRow[],
  tOff: readonly OffenceRow[],
  edges: readonly SynergyEdge[],
  archetype: readonly ArchetypeMatch[],
): Check[] {
  const team = members.map((a) => a.member);
  const isStall = archetype[0]?.name === "Stall";
  const tagged = (tag: Parameters<typeof hasTag>[1]) => team.filter((m) => hasTag(m, tag));
  const items: Check[] = [];
  const push = (level: CheckLevel, text: string) => items.push({ level, text });
  const names = (arr: readonly Member[]) => arr.map((m) => m.set.species).join(", ");

  const hazards = tagged("hazard");
  const rocks = team.filter((m) => m.moves.some((mv) => mv.id === "stealthrock"));
  if (hazards.length) push("good", `Hazards: ${names(hazards)}${rocks.length ? "" : " (no Stealth Rock)"}`);
  else push("warn", "No entry hazard setter.");

  const removal = tagged("removal");
  const srWeak = members.filter((a) => (a.def.Rock ?? 1) > 1 && a.member.item !== "heavydutyboots").map((a) => a.member);
  if (removal.length) push("good", `Hazard removal: ${names(removal)}`);
  else
    push(
      srWeak.length >= 2 ? "bad" : "warn",
      `No hazard removal${srWeak.length ? ` while ${srWeak.length} member(s) take ≥2× Stealth Rock without Boots: ${names(srWeak)}` : ""}.`,
    );

  const fast = members.filter((a) => a.indices.speed >= 0.6);
  const scarf = team.filter((m) => m.item === "choicescarf");
  const prio = team.filter((m) => m.moves.some((mv) => mv.priority > 0 && mv.category !== "Status"));
  const speedCtl = team.filter((m) => m.moves.some((mv) => SPEED_CONTROL.has(mv.id)));
  const sc = new Set([...scarf, ...prio, ...speedCtl]);
  if (sc.size) push("good", `Speed control / priority: ${names([...sc])}`);
  else
    push(
      isStall ? "info" : fast.length >= 2 ? "warn" : "bad",
      `No Choice Scarf, priority or speed control${isStall ? " (normal for stall, which out-lasts rather than out-speeds)" : ""}.`,
    );

  const recovery = tagged("recovery");
  push(
    recovery.length ? "good" : "info",
    `Reliable recovery on ${recovery.length}/${team.length}${recovery.length ? `: ${names(recovery)}` : ""}.`,
  );

  for (const t of tDef.filter((r) => r.weak >= 3)) push("bad", `${t.weak} members are weak to ${t.type} (resisted by ${t.resist}).`);
  const unres = tDef.filter((r) => r.unresisted && r.weak > 0);
  if (unres.length) push("warn", `Weaknesses with no resist on the team: ${unres.map((r) => r.type).join(", ")}.`);

  const uncovered = tOff.filter((r) => r.uncovered);
  if (uncovered.length) push("warn", `Types nothing hits neutrally or better: ${uncovered.map((r) => r.type).join(", ")}.`);
  const noSE = tOff.filter((r) => !r.uncovered && r.se === 0);
  if (noSE.length) push("info", `No super-effective coverage vs: ${noSE.map((r) => r.type).join(", ")}.`);

  const phys = team.reduce((a, m) => a + m.moves.filter((mv) => mv.category === "Physical").length, 0);
  const spec = team.reduce((a, m) => a + m.moves.filter((mv) => mv.category === "Special").length, 0);
  const lopsided = Math.abs(phys - spec) / (phys + spec || 1) > 0.6;
  push(
    lopsided ? "warn" : "good",
    `Attack split: ${phys} physical / ${spec} special moves${lopsided ? " — easy to wall with one defensive profile" : ""}.`,
  );

  const noAnswer = tDef.filter((r) => r.best.D < 1);
  if (noAnswer.length)
    push(
      "warn",
      `No switch-in better than an average neutral Pokémon of the pool vs: ${noAnswer
        .map((r) => `${r.type} (best ${team[r.best.idx].set.species} ${r.best.D.toFixed(2)})`)
        .join(", ")}.`,
    );
  const lowPressure = tOff.filter((r) => r.bestO.O < 1);
  if (lowPressure.length) push("info", `Weak weighted pressure (< 1.0) vs: ${lowPressure.map((r) => r.type).join(", ")}.`);

  const cores = edges
    .filter((e) => e.mutual && e.from < e.to)
    .map((e) => ({ e, w: e.score + (edges.find((o) => o.from === e.to && o.to === e.from)?.score ?? 0) }))
    .sort((a, b) => b.w - a.w);
  push(
    cores.length ? "good" : "warn",
    cores.length
      ? `${cores.length} mutual defensive pair(s). Strongest: ${cores
          .slice(0, 3)
          .map(({ e }) => `${team[e.from].set.species} ⇄ ${team[e.to].set.species}`)
          .join(", ")}`
      : "No pair of members covers each other's weaknesses.",
  );
  return items;
}

export interface Analysis {
  gen: Gen;
  members: MemberAnalysis[];
  offs: Record<string, OffenceCell>[];
  edges: SynergyEdge[];
  tDef: DefenceRow[];
  tOff: OffenceRow[];
  features: Features;
  archetype: ArchetypeMatch[];
  avgBase: Record<string, number>;
  checks: Check[];
}

export function analyze(team: readonly Member[], pool: Pool, { useTera = false } = {}): Analysis {
  const gen = pool.filters.gen;
  const defs = team.map((m) => defenseProfile(gen, m, useTera));
  const members = team.map((member, i) => {
    const indices = indicesOf(member, pool);
    const pct = Object.fromEntries(
      [...STATS, "bst"].map((k) => [k, pool.pct(k as Metric, k === "bst" ? member.bst : member.base[k as (typeof STATS)[number]])]),
    );
    return { member, def: defs[i], indices, roles: rolesFor(member, indices), pct };
  });
  const offs = team.map((m) => offenseProfile(gen, m));
  const edges = synergyEdges(gen, team, defs, pool);
  const tDef = teamDefense(gen, team, defs, pool);
  const tOff = teamOffense(gen, team, offs, pool);
  const features = teamFeatures(members);
  const archetype = classify(features);
  const avgBase = Object.fromEntries(STATS.map((s) => [s, team.reduce((a, m) => a + m.base[s], 0) / (team.length || 1)]));
  return { gen, members, offs, edges, tDef, tOff, features, archetype, avgBase, checks: checklist(members, tDef, tOff, edges, archetype) };
}
