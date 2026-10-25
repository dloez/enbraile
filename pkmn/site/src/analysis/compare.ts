import { moveVsMon } from "../../shared/chart";
import { typesIn, type Gen } from "../../shared/dex";
import { hasTag, type Member, type MoveData } from "@/analysis/member";
import type { Analysis } from "@/analysis/team";

const FIXED_DAMAGE = new Set(["seismictoss", "nightshade"]);
const USES_DEF = new Set(["psyshock", "psystrike", "secretsword"]);
const SPEED_CONTROL = new Set(
  `thunderwave tailwind trickroom stickyweb icywind electroweb glare stunspore quickattack extremespeed aquajet
  machpunch bulletpunch iceshard shadowsneak suckerpunch vacuumwave fakeout accelerock`.split(/\s+/),
);

export function memberName(m: Member): string {
  return m.set.nickname || m.species;
}

export function attacks(m: Member): MoveData[] {
  return m.moves.filter((mv) => !mv.unknown && !mv.notInGen && (FIXED_DAMAGE.has(mv.id) || (mv.category !== "Status" && mv.power > 0)));
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

const hitsToKo = (pct: number) => (pct <= 0 ? Infinity : Math.ceil(100 / pct));

export function koLine(d: Damage | null): string {
  if (!d) return "No effect";
  if (d.max <= 0) return "No damage";
  const sure = hitsToKo(d.min);
  const best = hitsToKo(d.max);
  const name = (n: number) => (n === 1 ? "OHKO" : `${n}HKO`);
  if (sure === best) return `Guaranteed ${name(best)}`;
  return `Possible ${name(best)}`;
}

export interface Side {
  team: readonly Member[];
  analysis: Analysis;
  size: number;
}

export interface ScoreCell {
  value: number;
  note: string;
  best: boolean;
}

export interface ScoreRow {
  label: string;
  cells: ScoreCell[];
}

type Measure = { label: string; better: 1 | -1; of: (side: Side) => { value: number; note?: string } };

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

const names = (team: readonly Member[]) => team.map(memberName).join(", ");

function typeList(types: readonly string[], cap = Infinity): string {
  return types.slice(0, cap).join(", ") + (types.length > cap ? "…" : "");
}

function measures(gen: Gen): Measure[] {
  const all = typesIn(gen).length;
  return [
    {
      label: "Members",
      better: 1,
      of: ({ team, size }) => ({ value: team.length, note: team.length < size ? `${size - team.length} empty of ${size}` : "" }),
    },
    { label: "Average Speed", better: 1, of: ({ team }) => ({ value: Math.round(mean(team.map((m) => m.stats.spe))) }) },
    {
      label: "Fastest",
      better: 1,
      of: ({ team }) => {
        const fast = [...team].sort((a, b) => b.stats.spe - a.stats.spe)[0];
        return { value: fast.stats.spe, note: memberName(fast) };
      },
    },
    {
      label: "Average bulk",
      better: 1,
      of: ({ team }) => ({ value: Math.round(mean(team.map((m) => (m.stats.hp * (m.stats.def + m.stats.spd)) / 2)) / 100) }),
    },
    {
      label: "Types hitting 3+ ×2",
      better: -1,
      of: ({ analysis }) => {
        const types = analysis.tDef.filter((t) => t.weak >= 3).map((t) => t.type);
        return { value: types.length, note: typeList(types) };
      },
    },
    {
      label: "Types none resists",
      better: -1,
      of: ({ analysis }) => {
        const types = analysis.tDef.filter((t) => t.resist === 0).map((t) => t.type);
        return { value: types.length, note: typeList(types, 4) };
      },
    },
    { label: "Types hit ×2", better: 1, of: ({ analysis }) => ({ value: analysis.tOff.filter((t) => t.se > 0).length, note: `of ${all}` }) },
    {
      label: "Coverage holes",
      better: -1,
      of: ({ analysis }) => {
        const types = analysis.tOff.filter((t) => t.uncovered).map((t) => t.type);
        return { value: types.length, note: typeList(types) };
      },
    },
    {
      label: "Hazards · removal",
      better: 1,
      of: ({ team }) => {
        const hazards = team.filter((m) => hasTag(m, "hazard")).length;
        const removal = team.filter((m) => hasTag(m, "removal")).length;
        return { value: hazards + removal, note: `${hazards} ${hazards === 1 ? "setter" : "setters"} · ${removal} removal` };
      },
    },
    {
      label: "Speed control",
      better: 1,
      of: ({ team }) => {
        const users = team.filter((m) => m.moves.some((mv) => SPEED_CONTROL.has(mv.id)));
        return { value: users.length, note: names(users) };
      },
    },
    {
      label: "Recovery",
      better: 1,
      of: ({ team }) => {
        const users = team.filter((m) => hasTag(m, "recovery"));
        return { value: users.length, note: names(users) };
      },
    },
  ];
}

export function scoreboard(gen: Gen, sides: readonly Side[]): ScoreRow[] {
  return measures(gen).map(({ label, better, of }) => {
    const read = sides.map(of);
    const values = read.map((r) => r.value);
    const target = better > 0 ? Math.max(...values) : Math.min(...values);
    const tied = values.every((v) => v === target);
    return { label, cells: read.map((r) => ({ value: r.value, note: r.note ?? "", best: !tied && r.value === target })) };
  });
}
