import { useState } from "react";
import { toID } from "@pkmn/dex";
import { cn } from "@/lib/utils";
import { dexFor, typesIn } from "../../../shared/dex";
import { MOVE_TAGS, STATS, type Member, type MoveTag } from "@/analysis/member";
import type { Pool } from "@/analysis/pool";
import { defValue, offValue, type Analysis } from "@/analysis/team";
import { TypeDot } from "@/components/marks";
import { Panel, Segmented } from "@/components/controls";
import { SelectField } from "@/components/select-field";
import { spriteOf } from "@/analysis/sprite";
import { dexName, typeLabel } from "../../../shared/dex-text";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    stats: { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" },
    tags: {
      hazard: "hazard",
      removal: "removal",
      pivot: "pivot",
      recovery: "recovery",
      setup: "setup",
      phaze: "phaze",
      status: "status",
      screens: "screens",
      cleric: "cleric",
      protect: "protect",
    } as Partial<Record<MoveTag, string>>,
    category: { Physical: "P", Special: "S", Status: "—" },
    natureLevel: (nature: string, level: number) => `${nature} · Lv ${level}`,
    tera: (name: string) => `${name}'s Tera type`,
    bst: (p: number) => `BST · P${p}`,
    notInPool: (why: string) => `Not in this pool: ${why}`,
    base: "Base",
    percentile: "Percentile in pool",
    final: "Final",
    unknownMove: "Unknown move",
    laterGen: "From a later generation",
    defLegend: ["×4 weak", "×2 weak", "×0.5 resists", "×0.25 or less", "×0 immune"],
    offLegend: ["×2 or more: hits it super-effectively (● with STAB)", "×1 neutral", "below ×1: resisted or immune"],
    weightLegend: ["3.00 or more", "1.50–3.00", "1.00–1.50", "0.50–1.00", "below 0.50"],
    matchups: "Type matchups",
    matrixValues: "Matrix values",
    multipliers: "Type multipliers",
    weighted: "Weighted by stats",
    defence: "Defence",
    defMult: "damage each member takes from each attacking type, abilities counted",
    defWeighted: "effective bulk D against each attacking type: 1.00 = an average pool member taking a neutral hit",
    takes: (name: string, v: number, type: string) => `${name} takes ×${v} from ${type}`,
    defCell: (name: string, type: string, v: number, d: string) => `${name} vs ${type}: ×${v}, D ${d}`,
    weakRow: "Weak",
    resistRow: "Resist",
    weakTitle: (n: number, type: string, unresisted: boolean) => `${n} weak to ${type}${unresisted ? ", nobody resists it" : ""}`,
    weakNote: "The Weak row turns red when three or more members are weak to a type, or when nobody resists it.",
    coverage: "Coverage",
    offMult: "best multiplier of each member's damaging moves against each defending type",
    offWeighted: "best hit O against each defending type: 1.00 = a neutral 100 BP hit from an average pool attacker",
    noDamaging: (name: string) => `${name} has no damaging move`,
    offWeightedCell: (move: string, type: string, o: string) => `${move} vs ${type}: O ${o}`,
    offCell: (move: string, type: string, v: number, stab: boolean) => `${move} vs ${type}: ×${v}${stab ? ", STAB" : ""}`,
    hitRow: "Hit SE",
    hitTitle: (n: number, type: string) => `${n} member${n === 1 ? "" : "s"} hit${n === 1 ? "s" : ""} ${type} super-effectively`,
    hitNote: "The Hit SE row turns red for a type nobody hits super-effectively.",
  },
  es: {
    stats: { hp: "PS", atk: "Atq", def: "Def", spa: "AtE", spd: "DfE", spe: "Vel" },
    tags: {
      hazard: "trampa",
      removal: "despeje",
      pivot: "pivote",
      recovery: "recup.",
      setup: "mejora",
      phaze: "arrastre",
      status: "estado",
      screens: "pantallas",
      cleric: "sanador",
      protect: "protección",
    },
    category: { Physical: "F", Special: "E", Status: "—" },
    natureLevel: (nature: string, level: number) => `${nature} · Nv. ${level}`,
    tera: (name: string) => `Teratipo de ${name}`,
    bst: (p: number) => `BST · P${p}`,
    notInPool: (why: string) => `Fuera de esta reserva: ${why}`,
    base: "Base",
    percentile: "Percentil en la reserva",
    final: "Final",
    unknownMove: "Movimiento desconocido",
    laterGen: "De una generación posterior",
    defLegend: ["×4 débil", "×2 débil", "×0.5 resiste", "×0.25 o menos", "×0 inmune"],
    offLegend: ["×2 o más: le golpea de forma supereficaz (● con STAB)", "×1 neutro", "menos de ×1: resistido o inmune"],
    weightLegend: ["3.00 o más", "1.50–3.00", "1.00–1.50", "0.50–1.00", "menos de 0.50"],
    matchups: "Tabla de tipos",
    matrixValues: "Valores de la tabla",
    multipliers: "Multiplicadores",
    weighted: "Ponderado por estadísticas",
    defence: "Defensa",
    defMult: "daño que recibe cada miembro de cada tipo atacante, contando habilidades",
    defWeighted: "aguante efectivo D contra cada tipo atacante: 1.00 = un miembro medio de la reserva recibiendo un golpe neutro",
    takes: (name: string, v: number, type: string) => `${name} recibe ×${v} de ${type}`,
    defCell: (name: string, type: string, v: number, d: string) => `${name} contra ${type}: ×${v}, D ${d}`,
    weakRow: "Débiles",
    resistRow: "Resisten",
    weakTitle: (n: number, type: string, unresisted: boolean) => `${n} débil${n === 1 ? "" : "es"} a ${type}${unresisted ? ", nadie lo resiste" : ""}`,
    weakNote: "La fila Débiles se pone roja cuando tres o más miembros son débiles a un tipo, o cuando nadie lo resiste.",
    coverage: "Cobertura",
    offMult: "mejor multiplicador de los movimientos de daño de cada miembro contra cada tipo defensor",
    offWeighted: "mejor golpe O contra cada tipo defensor: 1.00 = un golpe neutro de 100 de potencia de un atacante medio de la reserva",
    noDamaging: (name: string) => `${name} no tiene movimientos de daño`,
    offWeightedCell: (move: string, type: string, o: string) => `${move} contra ${type}: O ${o}`,
    offCell: (move: string, type: string, v: number, stab: boolean) => `${move} contra ${type}: ×${v}${stab ? ", STAB" : ""}`,
    hitRow: "Golpe SE",
    hitTitle: (n: number, type: string) => `${n} miembro${n === 1 ? "" : "s"} golpea${n === 1 ? "" : "n"} a ${type} de forma supereficaz`,
    hitNote: "La fila Golpe SE se pone roja en un tipo al que nadie golpea de forma supereficaz.",
  },
});

function tagOf(id: string): string | null {
  for (const [tag, ids] of Object.entries(MOVE_TAGS) as [MoveTag, Set<string>][]) if (ids.has(id)) return t.tags[tag] ?? tag;
  return null;
}

const moveName = (mv: { id: string; name: string }) => dexName("moves", mv.id, mv.name);

export interface TeraPicks {
  of: (member: Member) => string;
  onChange: (member: Member, type: string) => void;
}

function MemberCard({ member, analysis, index, illegal, tera }: { member: Member; analysis: Analysis; index: number; illegal: string | null; tera?: TeraPicks }) {
  const a = analysis.members[index];
  const nature = dexFor(analysis.gen).natures.get(member.set.nature);
  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border-3 bg-card", illegal && "border-destructive")}>
      <div className="flex items-center gap-3 bg-box p-3">
        <span className="grid size-16 flex-none place-items-center rounded-xl bg-cell">
          <img src={spriteOf(member)} alt="" className="size-16 [image-rendering:pixelated]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-heading text-2xl">{member.display}</span>
          <span className="flex flex-wrap gap-2.5 text-xs font-semibold">
            {member.types.map((type) => (
              <span key={type} className="inline-flex items-center gap-1.25">
                <TypeDot type={type} />
                {typeLabel(type)}
              </span>
            ))}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              member.set.ability && dexName("abilities", toID(member.set.ability), member.set.ability),
              member.set.item && dexName("items", member.item, member.set.item),
              t.natureLevel(nature.exists ? dexName("natures", nature.id, nature.name) : member.set.nature, member.set.level),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        {tera && (
          <SelectField
            label={t.tera(member.display)}
            size="sm"
            value={tera.of(member)}
            onChange={(type) => tera.onChange(member, type)}
            options={typesIn(analysis.gen).map((type) => ({ value: type, label: typeLabel(type) }))}
          />
        )}
        <span className="flex flex-col items-end gap-0.5">
          <span className="tabular-nums text-base">{member.bst}</span>
          <span className="text-xs text-muted-foreground">{t.bst(Math.round(a.pct.bst * 100))}</span>
        </span>
      </div>
      {illegal && <p className="m-0 px-3 pt-2 text-xs font-semibold text-destructive">{t.notInPool(illegal)}</p>}
      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
        {a.roles.map((r) => (
          <span key={r} className="rounded-full bg-secondary px-2 py-0.75 text-xs font-semibold text-chart-3">
            {r}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.25 px-3 py-2.5">
        <div className="grid grid-cols-[34px_34px_minmax(0,1fr)_30px_38px] gap-2 text-xs text-muted-foreground">
          <span />
          <span>{t.base}</span>
          <span>{t.percentile}</span>
          <span className="text-right">P</span>
          <span className="text-right">{t.final}</span>
        </div>
        {STATS.map((k) => {
          const p = a.pct[k];
          const up = nature.exists && nature.plus === k;
          const down = nature.exists && nature.minus === k;
          return (
            <div key={k} className="grid grid-cols-[34px_34px_minmax(0,1fr)_30px_38px] items-center gap-2 text-xs">
              <span className={cn("font-semibold", up ? "text-primary" : down ? "text-chart-2" : "text-muted-foreground")}>{t.stats[k]}</span>
              <span className="tabular-nums">{member.base[k]}</span>
              <span className="h-1.5 rounded-sm bg-secondary">
                <span
                  className={cn("block h-1.5 rounded-sm", p >= 0.75 ? "bg-primary" : p >= 0.4 ? "bg-chart-3" : "bg-muted-foreground/60")}
                  style={{ width: `${p * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-xs text-muted-foreground">{Math.round(p * 100)}</span>
              <span className="text-right tabular-nums">{member.stats[k]}</span>
            </div>
          );
        })}
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-1.5 px-3 pt-0 pb-3">
        {member.moves.map((mv, i) => {
          const tag = tagOf(mv.id);
          return (
            <li
              key={i}
              title={mv.unknown ? t.unknownMove : mv.notInGen ? t.laterGen : undefined}
              className={cn(
                "flex min-h-9 min-w-0 items-center gap-1.75 rounded-lg border bg-muted px-2 text-xs",
                (mv.unknown || mv.notInGen) && "border-destructive text-destructive",
              )}
            >
              <TypeDot type={mv.type} />
              <span className="min-w-0 flex-1 truncate">{moveName(mv)}</span>
              {tag && <span className="rounded-sm bg-accent px-1.5 text-xs font-semibold text-primary">{tag}</span>}
              <span className="tabular-nums text-xs text-muted-foreground">{t.category[mv.category]}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function MemberCards({ team, analysis, legality, tera }: { team: readonly Member[]; analysis: Analysis; legality: (m: Member) => string | null; tera?: TeraPicks }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {team.map((m, i) => (
        <MemberCard key={i} member={m} analysis={analysis} index={i} illegal={legality(m)} tera={tera} />
      ))}
    </div>
  );
}

export type MatrixMode = "mult" | "weighted";

function frac(v: number): string {
  return `×${v}`;
}

function multCell(v: number): string {
  if (v >= 4) return "bg-destructive/45 text-foreground font-semibold";
  if (v > 1) return "bg-destructive-soft text-destructive font-semibold";
  if (v === 0) return "bg-accent text-primary font-semibold";
  if (v <= 0.25) return "bg-chart-2/35 text-foreground";
  if (v < 1) return "bg-chart-2/15 text-chart-2";
  return "bg-muted text-muted-foreground/40";
}

function weightCell(v: number): string {
  if (v >= 3) return "bg-chart-2/40 text-foreground";
  if (v >= 1.5) return "bg-chart-2/25 text-chart-2";
  if (v >= 1) return "bg-chart-2/10 text-chart-2";
  if (v >= 0.5) return "bg-destructive-soft text-destructive";
  return "bg-destructive/45 text-foreground";
}

const f2 = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));

const CELL = "h-9 min-w-13 rounded-md text-center tabular-nums text-sm";
const STICKY = "sticky left-0 z-10 bg-card";

function MemberHead({ member }: { member: Member }) {
  const nick = member.set.nickname.trim();
  return (
    <th scope="row" className={cn(STICKY, "py-0.5 pr-3 text-left font-normal")}>
      <span className="flex items-center gap-2">
        <img src={spriteOf(member)} alt="" className="size-9 flex-none [image-rendering:pixelated]" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="max-w-36 truncate text-sm font-semibold">{nick || member.species}</span>
          {nick && <span className="max-w-36 truncate text-xs text-muted-foreground">{member.species}</span>}
        </span>
      </span>
    </th>
  );
}

function SummaryHead({ label }: { label: string }) {
  return (
    <th scope="row" className={cn(STICKY, "border-t pt-1.5 pr-3 text-left text-xs font-semibold text-muted-foreground")}>
      {label}
    </th>
  );
}

function Head({ types }: { types: readonly string[] }) {
  return (
    <thead>
      <tr>
        <th className={cn(STICKY, "min-w-40")} />
        {types.map((type) => (
          <th key={type} scope="col" title={typeLabel(type)} className="px-0.5 pb-1 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex flex-col items-center gap-1">
              <TypeDot type={type} className="size-5" />
              {typeLabel(type).slice(0, 3)}
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Legend({ items }: { items: readonly { swatch: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3.5 rounded-sm", i.swatch)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const legend = (swatches: readonly string[], labels: readonly string[]) => swatches.map((swatch, i) => ({ swatch, label: labels[i] }));

const DEF_LEGEND = legend(["bg-destructive/45", "bg-destructive-soft", "bg-chart-2/15", "bg-chart-2/35", "bg-accent"], t.defLegend);

const OFF_LEGEND = legend(["bg-chart-2/15", "bg-muted", "bg-destructive-soft"], t.offLegend);

const WEIGHT_LEGEND = legend(["bg-chart-2/40", "bg-chart-2/25", "bg-chart-2/10", "bg-destructive-soft", "bg-destructive/45"], t.weightLegend);

export function Matrices({ team, analysis, pool }: { team: readonly Member[]; analysis: Analysis; pool: Pool }) {
  const [mode, setMode] = useState<MatrixMode>("mult");
  const types = typesIn(analysis.gen);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-heading text-4xl">{t.matchups}</h2>
        <div className="flex-1" />
        <Segmented
          label={t.matrixValues}
          value={mode}
          onChange={setMode}
          options={[
            { value: "mult", label: t.multipliers },
            { value: "weighted", label: t.weighted },
          ]}
        />
      </div>
      <Panel
        title={t.defence}
        aside={<span className="text-xs text-muted-foreground">{mode === "mult" ? t.defMult : t.defWeighted}</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <Head types={types} />
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <MemberHead member={m} />
                  {types.map((type) => {
                    const v = analysis.members[i].def[type];
                    if (mode === "mult")
                      return (
                        <td key={type} title={t.takes(m.display, v, typeLabel(type))} className={cn(CELL, multCell(v))}>
                          {v === 1 ? "·" : frac(v)}
                        </td>
                      );
                    const d = defValue(m, type, v, pool);
                    return (
                      <td key={type} title={t.defCell(m.display, typeLabel(type), v, f2(d))} className={cn(CELL, weightCell(d))}>
                        {f2(d)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <SummaryHead label={t.weakRow} />
                {analysis.tDef.map((r) => (
                  <td
                    key={r.type}
                    title={t.weakTitle(r.weak, typeLabel(r.type), r.unresisted && r.weak > 0)}
                    className={cn(
                      CELL,
                      "border-t",
                      r.weak >= 3 || (r.unresisted && r.weak > 0) ? "bg-destructive/45 text-foreground" : "text-destructive",
                    )}
                  >
                    {r.weak || "·"}
                  </td>
                ))}
              </tr>
              <tr>
                <SummaryHead label={t.resistRow} />
                {analysis.tDef.map((r) => (
                  <td key={r.type} className={cn(CELL, "text-chart-2")}>
                    {r.resist || "·"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <Legend items={mode === "mult" ? DEF_LEGEND : WEIGHT_LEGEND} />
        <span className="text-xs text-muted-foreground">{t.weakNote}</span>
      </Panel>
      <Panel
        title={t.coverage}
        aside={<span className="text-xs text-muted-foreground">{mode === "mult" ? t.offMult : t.offWeighted}</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <Head types={types} />
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <MemberHead member={m} />
                  {types.map((type) => {
                    const o = analysis.offs[i][type];
                    if (o.mult === null)
                      return (
                        <td key={type} title={t.noDamaging(m.display)} className={cn(CELL, "bg-muted text-muted-foreground/40")}>
                          –
                        </td>
                      );
                    if (mode === "weighted") {
                      const hit = offValue(analysis.gen, m, type, pool);
                      return (
                        <td key={type} title={t.offWeightedCell(hit.move ? moveName(hit.move) : "—", typeLabel(type), f2(hit.O))} className={cn(CELL, weightCell(hit.O))}>
                          {f2(hit.O)}
                        </td>
                      );
                    }
                    const v = o.mult;
                    return (
                      <td
                        key={type}
                        title={t.offCell(o.move ? moveName(o.move) : "—", typeLabel(type), v, o.stab)}
                        className={cn(
                          CELL,
                          v > 1 ? "bg-chart-2/15 font-semibold text-chart-2" : v < 1 ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground/40",
                        )}
                      >
                        {v === 1 ? "·" : frac(v)}
                        {o.stab && v > 1 ? "●" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <SummaryHead label={t.hitRow} />
                {analysis.tOff.map((r) => (
                  <td
                    key={r.type}
                    title={t.hitTitle(r.se, typeLabel(r.type))}
                    className={cn(CELL, "border-t", r.se === 0 ? "bg-destructive/45 text-foreground" : "text-chart-2")}
                  >
                    {r.se}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <Legend items={mode === "mult" ? OFF_LEGEND : WEIGHT_LEGEND} />
        <span className="text-xs text-muted-foreground">{t.hitNote}</span>
      </Panel>
    </div>
  );
}
