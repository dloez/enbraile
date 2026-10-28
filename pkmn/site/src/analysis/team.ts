import { damageTaken, moveVsType } from "../../shared/chart";
import { typesIn, type Gen } from "../../shared/dex";
import { hasTag, STATS, type Member, type MoveData } from "@/analysis/member";
import type { Metric, Pool } from "@/analysis/pool";
import { typeLabel } from "../../shared/dex-text";
import { locale, messages } from "../../shared/i18n";

const t = messages({
  en: {
    features: {
      speed: "Speed",
      offense: "Offense",
      bulk: "Bulk",
      recovery: "Recovery",
      status: "Status moves",
      setup: "Setup",
      pivot: "Pivoting",
      offItems: "Offensive items",
    } as Record<Feature, string>,
    archetypes: {
      "Hyper Offense": {
        label: "Hyper Offense",
        blurb:
          "Overwhelm the opponent before they can set up a defensive game. Typically a hazard/screens lead, 2 setup sweepers, 2 wallbreakers and a fast cleaner. Very weak to priority, status and losing tempo.",
        wants: ["Suicide lead / hazards or screens", "Multiple setup sweepers", "Wallbreakers", "Speed control (Scarf / priority)"],
      },
      "Bulky Offense": {
        label: "Bulky Offense",
        blurb:
          "Strong attackers that can still switch in on hits. Chips the opponent with pivoting (U-turn / Volt Switch) so that late-game threats can clean. Wants hazards, removal and a bit of recovery.",
        wants: ["Pivots for momentum", "Hazard setter + removal", "Bulky attackers / Assault Vest", "A late-game cleaner"],
      },
      Balance: {
        label: "Balance",
        blurb:
          "Defensive cores (Fire/Water/Grass, Dragon/Steel/Fairy…) supporting a few strong threats. Adaptable but every member has to pull weight: usually a wall, a stallbreaker and a sweeper.",
        wants: ["A defensive core with mutual coverage", "Reliable recovery on walls", "Hazards + removal", "1–2 win conditions"],
      },
      Stall: {
        label: "Stall",
        blurb:
          "The bulkiest mons in the tier with reliable recovery, winning through hazards, status and passive damage. Struggles against strong wallbreakers and setup that it cannot phaze.",
        wants: ["Recovery on (almost) every member", "Status spreaders (Toxic / WoW)", "Hazards + removal", "Phazing / Haze vs setup"],
      },
    } as Record<ArchetypeName, { label: string; blurb: string; wants: string[] }>,
    roles: {
      lead: "Lead / Hazards",
      hazards: "Hazard setter",
      removal: "Hazard removal",
      pivot: "Pivot",
      screens: "Screens",
      cleric: "Cleric",
      phazer: "Phazer",
      wall: "Wall",
      bulky: "Bulky attacker",
      sweeper: "Setup sweeper",
      breaker: "Wallbreaker",
      revenge: "Revenge killer",
      priority: "Priority",
      fast: "Fast attacker",
      attacker: "Attacker",
      support: "Support",
    },
    check: {
      hazards: (who: string, rocks: boolean) => `Hazards: ${who}${rocks ? "" : " (no Stealth Rock)"}`,
      noHazards: "No entry hazard setter.",
      removal: (who: string) => `Hazard removal: ${who}`,
      noRemoval: (n: number, who: string) =>
        `No hazard removal${n ? ` while ${n} ${n === 1 ? "member takes" : "members take"} ≥2× Stealth Rock without Boots: ${who}` : ""}.`,
      speed: (who: string) => `Speed control / priority: ${who}`,
      noSpeed: (stall: boolean) =>
        `No Choice Scarf, priority or speed control${stall ? " (normal for stall, which out-lasts rather than out-speeds)" : ""}.`,
      recovery: (n: number, of: number, who: string) => `Reliable recovery on ${n}/${of}${n ? `: ${who}` : ""}.`,
      weak: (n: number, type: string, resist: number) => `${n} members are weak to ${type} (resisted by ${resist}).`,
      unresisted: (types: string) => `Weaknesses with no resist on the team: ${types}.`,
      uncovered: (types: string) => `Types nothing hits neutrally or better: ${types}.`,
      noSE: (types: string) => `No super-effective coverage vs: ${types}.`,
      split: (phys: number, spec: number, lopsided: boolean) =>
        `Attack split: ${phys} physical / ${spec} special moves${lopsided ? " — easy to wall with one defensive profile" : ""}.`,
      noAnswer: (list: string) => `No switch-in better than an average neutral Pokémon of the pool vs: ${list}.`,
      bestAnswer: (type: string, who: string, d: string) => `${type} (best ${who} ${d})`,
      lowPressure: (types: string) => `Weak weighted pressure (< 1.0) vs: ${types}.`,
      cores: (n: number, list: string) => `${n} mutual defensive ${n === 1 ? "pair" : "pairs"}. Strongest: ${list}`,
      noCores: "No pair of members covers each other's weaknesses.",
    },
  },
  es: {
    features: {
      speed: "Velocidad",
      offense: "Ofensiva",
      bulk: "Aguante",
      recovery: "Recuperación",
      status: "Mov. de estado",
      setup: "Mejoras",
      pivot: "Pivoteo",
      offItems: "Objetos ofensivos",
    },
    archetypes: {
      "Hyper Offense": {
        label: "Hiperofensiva",
        blurb:
          "Arrolla al rival antes de que monte un juego defensivo. Suele llevar un abridor con trampas o pantallas, 2 barredores con mejoras, 2 rompemuros y un rematador rápido. Muy débil a la prioridad, los estados y perder el ritmo.",
        wants: ["Abridor suicida / trampas o pantallas", "Varios barredores con mejoras", "Rompemuros", "Control de velocidad (Pañuelo / prioridad)"],
      },
      "Bulky Offense": {
        label: "Ofensiva robusta",
        blurb:
          "Atacantes fuertes que aún aguantan entrar a recibir golpes. Desgasta al rival pivotando (Ida y Vuelta / Voltiocambio) para que las amenazas del final rematen. Quiere trampas, quitarlas y algo de recuperación.",
        wants: ["Pivotes para el ritmo", "Poner y quitar trampas", "Atacantes robustos / Chaleco Asalto", "Un rematador para el final"],
      },
      Balance: {
        label: "Equilibrio",
        blurb:
          "Núcleos defensivos (Fuego/Agua/Planta, Dragón/Acero/Hada…) que apoyan a unas pocas amenazas fuertes. Flexible, pero cada miembro tiene que aportar: suele haber un muro, un rompe-stall y un barredor.",
        wants: ["Un núcleo defensivo que se cubra", "Recuperación fiable en los muros", "Poner y quitar trampas", "1–2 formas de ganar"],
      },
      Stall: {
        label: "Stall",
        blurb:
          "Los Pokémon más aguantes del nivel con recuperación fiable, que ganan con trampas, estados y daño pasivo. Sufre contra rompemuros fuertes y mejoras que no puede forzar a cambiar.",
        wants: ["Recuperación en (casi) todos", "Repartir estados (Tóxico / Fuego Fatuo)", "Poner y quitar trampas", "Forzar cambios / Niebla contra mejoras"],
      },
    },
    roles: {
      lead: "Abridor / trampas",
      hazards: "Pone trampas",
      removal: "Quita trampas",
      pivot: "Pivote",
      screens: "Pantallas",
      cleric: "Clérigo",
      phazer: "Fuerza cambios",
      wall: "Muro",
      bulky: "Atacante robusto",
      sweeper: "Barredor con mejoras",
      breaker: "Rompemuros",
      revenge: "Rematador",
      priority: "Prioridad",
      fast: "Atacante rápido",
      attacker: "Atacante",
      support: "Apoyo",
    },
    check: {
      hazards: (who: string, rocks: boolean) => `Trampas: ${who}${rocks ? "" : " (sin Trampa Rocas)"}`,
      noHazards: "Nadie pone trampas de entrada.",
      removal: (who: string) => `Quitan trampas: ${who}`,
      noRemoval: (n: number, who: string) =>
        `Nadie quita trampas${n ? `, y ${n} ${n === 1 ? "miembro recibe" : "miembros reciben"} ≥2× de Trampa Rocas sin Botas Gruesas: ${who}` : ""}.`,
      speed: (who: string) => `Control de velocidad / prioridad: ${who}`,
      noSpeed: (stall: boolean) =>
        `Sin Pañuelo Elección, prioridad ni control de velocidad${stall ? " (normal en stall, que aguanta más en vez de correr más)" : ""}.`,
      recovery: (n: number, of: number, who: string) => `Recuperación fiable en ${n}/${of}${n ? `: ${who}` : ""}.`,
      weak: (n: number, type: string, resist: number) => `${n} miembros son débiles a ${type} (lo ${resist === 1 ? "resiste" : "resisten"} ${resist}).`,
      unresisted: (types: string) => `Debilidades que nadie del equipo resiste: ${types}.`,
      uncovered: (types: string) => `Tipos a los que nada da neutro o mejor: ${types}.`,
      noSE: (types: string) => `Sin cobertura supereficaz contra: ${types}.`,
      split: (phys: number, spec: number, lopsided: boolean) =>
        `Reparto de ataques: ${phys} movimientos físicos / ${spec} especiales${lopsided ? " — fácil de parar con un solo perfil defensivo" : ""}.`,
      noAnswer: (list: string) => `Ningún relevo mejor que un Pokémon neutro medio de la reserva contra: ${list}.`,
      bestAnswer: (type: string, who: string, d: string) => `${type} (mejor ${who} ${d})`,
      lowPressure: (types: string) => `Presión ponderada baja (< 1,0) contra: ${types}.`,
      cores: (n: number, list: string) =>
        n === 1 ? `1 pareja defensiva mutua. La mejor: ${list}` : `${n} parejas defensivas mutuas. Las mejores: ${list}`,
      noCores: "Ninguna pareja de miembros se cubre las debilidades.",
    },
  },
});

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
  { key: "speed", label: t.features.speed, w: 1.0 },
  { key: "offense", label: t.features.offense, w: 1.2 },
  { key: "bulk", label: t.features.bulk, w: 1.2 },
  { key: "recovery", label: t.features.recovery, w: 1.2 },
  { key: "status", label: t.features.status, w: 1.0 },
  { key: "setup", label: t.features.setup, w: 0.8 },
  { key: "pivot", label: t.features.pivot, w: 0.6 },
  { key: "offItems", label: t.features.offItems, w: 0.8 },
];

export type Features = Record<Feature, number>;

export type ArchetypeName = "Hyper Offense" | "Bulky Offense" | "Balance" | "Stall";

export const ARCHETYPES: Record<ArchetypeName, { proto: Features; label: string; blurb: string; wants: string[] }> = {
  "Hyper Offense": {
    proto: { speed: 0.8, offense: 0.85, bulk: 0.15, recovery: 0.05, status: 0.12, setup: 0.45, pivot: 0.1, offItems: 0.8 },
    ...t.archetypes["Hyper Offense"],
  },
  "Bulky Offense": {
    proto: { speed: 0.55, offense: 0.72, bulk: 0.4, recovery: 0.2, status: 0.15, setup: 0.3, pivot: 0.35, offItems: 0.45 },
    ...t.archetypes["Bulky Offense"],
  },
  Balance: {
    proto: { speed: 0.45, offense: 0.55, bulk: 0.55, recovery: 0.45, status: 0.3, setup: 0.2, pivot: 0.3, offItems: 0.25 },
    ...t.archetypes.Balance,
  },
  Stall: {
    proto: { speed: 0.15, offense: 0.15, bulk: 0.88, recovery: 0.9, status: 0.55, setup: 0.1, pivot: 0.15, offItems: 0 },
    ...t.archetypes.Stall,
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
  if (has("hazard")) r.push(m.item === "focussash" ? t.roles.lead : t.roles.hazards);
  if (has("removal")) r.push(t.roles.removal);
  if (has("pivot")) r.push(t.roles.pivot);
  if (has("screens")) r.push(t.roles.screens);
  if (has("cleric")) r.push(t.roles.cleric);
  if (has("phaze")) r.push(t.roles.phazer);
  const statusHeavy = m.moves.filter((mv) => mv.category === "Status").length >= 3;
  if (ix.bulk > 0.6 && (has("recovery") || m.item === "leftovers" || statusHeavy) && ix.offense < 0.6) r.push(t.roles.wall);
  else if (ix.bulk > 0.65 && has("recovery")) r.push(t.roles.bulky);
  if (has("setup") && attacks.length >= 2) r.push(t.roles.sweeper);
  if (
    ["choiceband", "choicespecs", "lifeorb"].includes(m.item) ||
    (ix.offense > 0.85 && !has("setup") && attacks.length >= 3 && m.item !== "focussash")
  )
    r.push(t.roles.breaker);
  if (m.item === "choicescarf") r.push(t.roles.revenge);
  else if (attacks.some((mv) => mv.priority > 0)) r.push(t.roles.priority);
  else if (ix.speed >= 0.8 && ix.offense >= 0.7 && !r.includes(t.roles.sweeper)) r.push(t.roles.fast);
  if (r.length === 0) r.push(attacks.length >= 3 ? t.roles.attacker : t.roles.support);
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
  const two = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const types = (rows: readonly { type: string }[]) => rows.map((r) => typeLabel(r.type)).join(", ");

  const hazards = tagged("hazard");
  const rocks = team.filter((m) => m.moves.some((mv) => mv.id === "stealthrock"));
  if (hazards.length) push("good", t.check.hazards(names(hazards), rocks.length > 0));
  else push("warn", t.check.noHazards);

  const removal = tagged("removal");
  const srWeak = members.filter((a) => (a.def.Rock ?? 1) > 1 && a.member.item !== "heavydutyboots").map((a) => a.member);
  if (removal.length) push("good", t.check.removal(names(removal)));
  else push(srWeak.length >= 2 ? "bad" : "warn", t.check.noRemoval(srWeak.length, names(srWeak)));

  const fast = members.filter((a) => a.indices.speed >= 0.6);
  const scarf = team.filter((m) => m.item === "choicescarf");
  const prio = team.filter((m) => m.moves.some((mv) => mv.priority > 0 && mv.category !== "Status"));
  const speedCtl = team.filter((m) => m.moves.some((mv) => SPEED_CONTROL.has(mv.id)));
  const sc = new Set([...scarf, ...prio, ...speedCtl]);
  if (sc.size) push("good", t.check.speed(names([...sc])));
  else push(isStall ? "info" : fast.length >= 2 ? "warn" : "bad", t.check.noSpeed(isStall));

  const recovery = tagged("recovery");
  push(recovery.length ? "good" : "info", t.check.recovery(recovery.length, team.length, names(recovery)));

  for (const r of tDef.filter((r) => r.weak >= 3)) push("bad", t.check.weak(r.weak, typeLabel(r.type), r.resist));
  const unres = tDef.filter((r) => r.unresisted && r.weak > 0);
  if (unres.length) push("warn", t.check.unresisted(types(unres)));

  const uncovered = tOff.filter((r) => r.uncovered);
  if (uncovered.length) push("warn", t.check.uncovered(types(uncovered)));
  const noSE = tOff.filter((r) => !r.uncovered && r.se === 0);
  if (noSE.length) push("info", t.check.noSE(types(noSE)));

  const phys = team.reduce((a, m) => a + m.moves.filter((mv) => mv.category === "Physical").length, 0);
  const spec = team.reduce((a, m) => a + m.moves.filter((mv) => mv.category === "Special").length, 0);
  const lopsided = Math.abs(phys - spec) / (phys + spec || 1) > 0.6;
  push(lopsided ? "warn" : "good", t.check.split(phys, spec, lopsided));

  const noAnswer = tDef.filter((r) => r.best.D < 1);
  if (noAnswer.length)
    push(
      "warn",
      t.check.noAnswer(
        noAnswer.map((r) => t.check.bestAnswer(typeLabel(r.type), team[r.best.idx].set.species, two(r.best.D))).join(", "),
      ),
    );
  const lowPressure = tOff.filter((r) => r.bestO.O < 1);
  if (lowPressure.length) push("info", t.check.lowPressure(types(lowPressure)));

  const cores = edges
    .filter((e) => e.mutual && e.from < e.to)
    .map((e) => ({ e, w: e.score + (edges.find((o) => o.from === e.to && o.to === e.from)?.score ?? 0) }))
    .sort((a, b) => b.w - a.w);
  push(
    cores.length ? "good" : "warn",
    cores.length
      ? t.check.cores(
          cores.length,
          cores
            .slice(0, 3)
            .map(({ e }) => `${team[e.from].set.species} ⇄ ${team[e.to].set.species}`)
            .join(", "),
        )
      : t.check.noCores,
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
