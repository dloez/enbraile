import { Dex } from "@pkmn/dex";
import { damageTaken, typeMultiplier } from "@/analysis/chart";
import { TYPES, type TypeName } from "@/analysis/dex";
import { currentAbility, type Mon } from "@/teams/dex";
import { memberMon, type Member, type Slots } from "@/teams/team";

const gen = Dex.forGen(9);

const TYPELESS_DAMAGE = new Set([
  "counter",
  "mirrorcoat",
  "metalburst",
  "bide",
  "finalgambit",
  "psywave",
  "superfang",
  "endeavor",
  "hiddenpower",
]);

export interface Analysed {
  slot: number;
  member: Member;
  mon: Mon;
  types: string[];
}

export function analysed(slots: Slots, mons: readonly Mon[]): Analysed[] {
  return slots.flatMap((member, slot) => {
    const mon = memberMon(member, mons);
    if (!member || !mon || !mon.showdownTypes || !mon.stats) return [];
    return [{ slot, member, mon, types: mon.showdownTypes }];
  });
}

export interface SpeedEntry {
  slot: number;
  mon: Mon;
  low: number;
  high: number;
}

export function speedOrder(team: readonly Analysed[]): SpeedEntry[] {
  return team
    .map(({ slot, mon }) => {
      const spe = mon.stats?.find((s) => s.stat === "spe");
      return { slot, mon, low: spe?.fight ?? spe?.low ?? 0, high: spe?.fight ?? spe?.high ?? 0 };
    })
    .sort((a, b) => b.high - a.high || b.low - a.low || a.slot - b.slot);
}

export interface DefenceRow {
  type: TypeName;
  weak: number;
  resist: number;
  immune: number;
  hole: boolean;
}

export function defensiveChart(team: readonly Analysed[]): DefenceRow[] {
  return TYPES.map((type) => {
    const taken = team.map(({ member, mon, types }) => damageTaken(9, type, types, member.ability ?? currentAbility(mon)));
    const weak = taken.filter((m) => m > 1).length;
    const resist = taken.filter((m) => m > 0 && m < 1).length;
    const immune = taken.filter((m) => m === 0).length;
    return { type, weak, resist, immune, hole: weak > resist + immune };
  });
}

export function damagingType(id: string): string | null {
  const move = gen.moves.get(id);
  if (!move.exists || move.category === "Status" || move.damage || move.ohko || TYPELESS_DAMAGE.has(move.id)) return null;
  return move.type;
}

export interface AttackSource {
  slot: number;
  mon: Mon;
  types: string[];
  stab: boolean;
}

export function attackTypes({ slot, member, mon, types }: Analysed): AttackSource {
  const picked = [
    ...new Set(member.moves.flatMap((id) => (id ? [damagingType(id)] : [])).filter((t): t is string => t !== null)),
  ];
  return picked.length > 0 ? { slot, mon, types: picked, stab: false } : { slot, mon, types, stab: true };
}

export interface CoverageRow {
  type: TypeName;
  hitters: number[];
}

export function offensiveCoverage(team: readonly Analysed[]): { sources: AttackSource[]; rows: CoverageRow[] } {
  const sources = team.map(attackTypes);
  const rows = TYPES.map((type) => ({
    type,
    hitters: sources.filter((s) => s.types.some((attack) => typeMultiplier(9, attack, [type]) > 1)).map((s) => s.slot),
  }));
  return { sources, rows };
}
