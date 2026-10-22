import { useState } from "react";
import { cn } from "@/lib/utils";
import { dexFor, typesIn } from "@/analysis/dex";
import { MOVE_TAGS, STATS, type Member, type MoveTag } from "@/analysis/member";
import type { Pool } from "@/analysis/pool";
import { defValue, offValue, type Analysis } from "@/analysis/team";
import { TypeDot } from "@/components/marks";
import { Panel, Segmented } from "@/components/controls";
import { spriteOf } from "@/analysis/sprite";

const STAT_LABEL = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" } as const;

const TAG_LABEL: Partial<Record<MoveTag, string>> = {
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
};

function tagOf(id: string): string | null {
  for (const [tag, ids] of Object.entries(MOVE_TAGS) as [MoveTag, Set<string>][]) if (ids.has(id)) return TAG_LABEL[tag] ?? tag;
  return null;
}

const CATEGORY = { Physical: "P", Special: "S", Status: "—" } as const;

function MemberCard({ member, analysis, index, illegal }: { member: Member; analysis: Analysis; index: number; illegal: string | null }) {
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
            {member.types.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.25">
                <TypeDot type={t} />
                {t}
              </span>
            ))}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[member.set.ability, member.set.item, `${member.set.nature} · Lv ${member.set.level}`].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className="flex flex-col items-end gap-0.5">
          <span className="tabular-nums text-base">{member.bst}</span>
          <span className="text-xs text-muted-foreground">BST · P{Math.round(a.pct.bst * 100)}</span>
        </span>
      </div>
      {illegal && <p className="m-0 px-3 pt-2 text-xs font-semibold text-destructive">Not in this pool: {illegal}</p>}
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
          <span>Base</span>
          <span>Percentile in pool</span>
          <span className="text-right">P</span>
          <span className="text-right">Final</span>
        </div>
        {STATS.map((k) => {
          const p = a.pct[k];
          const up = nature.exists && nature.plus === k;
          const down = nature.exists && nature.minus === k;
          return (
            <div key={k} className="grid grid-cols-[34px_34px_minmax(0,1fr)_30px_38px] items-center gap-2 text-xs">
              <span className={cn("font-semibold", up ? "text-primary" : down ? "text-chart-2" : "text-muted-foreground")}>{STAT_LABEL[k]}</span>
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
              title={mv.unknown ? "Unknown move" : mv.notInGen ? "From a later generation" : undefined}
              className={cn(
                "flex min-h-9 min-w-0 items-center gap-1.75 rounded-lg border bg-muted px-2 text-xs",
                (mv.unknown || mv.notInGen) && "border-destructive text-destructive",
              )}
            >
              <TypeDot type={mv.type} />
              <span className="min-w-0 flex-1 truncate">{mv.name}</span>
              {tag && <span className="rounded-sm bg-accent px-1.5 text-xs font-semibold text-primary">{tag}</span>}
              <span className="tabular-nums text-xs text-muted-foreground">{CATEGORY[mv.category]}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function MemberCards({ team, analysis, legality }: { team: readonly Member[]; analysis: Analysis; legality: (m: Member) => string | null }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {team.map((m, i) => (
        <MemberCard key={i} member={m} analysis={analysis} index={i} illegal={legality(m)} />
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
        {types.map((t) => (
          <th key={t} scope="col" title={t} className="px-0.5 pb-1 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex flex-col items-center gap-1">
              <TypeDot type={t} className="size-5" />
              {t.slice(0, 3)}
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

const DEF_LEGEND = [
  { swatch: "bg-destructive/45", label: "×4 weak" },
  { swatch: "bg-destructive-soft", label: "×2 weak" },
  { swatch: "bg-chart-2/15", label: "×0.5 resists" },
  { swatch: "bg-chart-2/35", label: "×0.25 or less" },
  { swatch: "bg-accent", label: "×0 immune" },
];

const OFF_LEGEND = [
  { swatch: "bg-chart-2/15", label: "×2 or more: hits it super-effectively (● with STAB)" },
  { swatch: "bg-muted", label: "×1 neutral" },
  { swatch: "bg-destructive-soft", label: "below ×1: resisted or immune" },
];

const WEIGHT_LEGEND = [
  { swatch: "bg-chart-2/40", label: "3.00 or more" },
  { swatch: "bg-chart-2/25", label: "1.50–3.00" },
  { swatch: "bg-chart-2/10", label: "1.00–1.50" },
  { swatch: "bg-destructive-soft", label: "0.50–1.00" },
  { swatch: "bg-destructive/45", label: "below 0.50" },
];

export function Matrices({ team, analysis, pool }: { team: readonly Member[]; analysis: Analysis; pool: Pool }) {
  const [mode, setMode] = useState<MatrixMode>("mult");
  const types = typesIn(analysis.gen);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-heading text-4xl">Matrices</h2>
        <div className="flex-1" />
        <Segmented
          label="Matrix values"
          value={mode}
          onChange={setMode}
          options={[
            { value: "mult", label: "Type multipliers" },
            { value: "weighted", label: "Weighted by stats" },
          ]}
        />
      </div>
      <Panel
        title="Defence"
        aside={
          <span className="text-xs text-muted-foreground">
            {mode === "mult"
              ? "damage each member takes from each attacking type, abilities counted"
              : "effective bulk D against each attacking type: 1.00 = an average pool member taking a neutral hit"}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <Head types={types} />
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <MemberHead member={m} />
                  {types.map((t) => {
                    const v = analysis.members[i].def[t];
                    if (mode === "mult")
                      return (
                        <td key={t} title={`${m.display} takes ×${v} from ${t}`} className={cn(CELL, multCell(v))}>
                          {v === 1 ? "·" : frac(v)}
                        </td>
                      );
                    const d = defValue(m, t, v, pool);
                    return (
                      <td key={t} title={`${m.display} vs ${t}: ×${v}, D ${f2(d)}`} className={cn(CELL, weightCell(d))}>
                        {f2(d)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <SummaryHead label="Weak" />
                {analysis.tDef.map((r) => (
                  <td
                    key={r.type}
                    title={`${r.weak} weak to ${r.type}${r.unresisted && r.weak > 0 ? ", nobody resists it" : ""}`}
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
                <SummaryHead label="Resist" />
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
        <span className="text-xs text-muted-foreground">
          The Weak row turns red when three or more members are weak to a type, or when nobody resists it.
        </span>
      </Panel>
      <Panel
        title="Coverage"
        aside={
          <span className="text-xs text-muted-foreground">
            {mode === "mult"
              ? "best multiplier of each member's damaging moves against each defending type"
              : "best hit O against each defending type: 1.00 = a neutral 100 BP hit from an average pool attacker"}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <Head types={types} />
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <MemberHead member={m} />
                  {types.map((t) => {
                    const o = analysis.offs[i][t];
                    if (o.mult === null)
                      return (
                        <td key={t} title={`${m.display} has no damaging move`} className={cn(CELL, "bg-muted text-muted-foreground/40")}>
                          –
                        </td>
                      );
                    if (mode === "weighted") {
                      const hit = offValue(analysis.gen, m, t, pool);
                      return (
                        <td key={t} title={`${hit.move?.name ?? "—"} vs ${t}: O ${f2(hit.O)}`} className={cn(CELL, weightCell(hit.O))}>
                          {f2(hit.O)}
                        </td>
                      );
                    }
                    const v = o.mult;
                    return (
                      <td
                        key={t}
                        title={`${o.move?.name ?? "—"} vs ${t}: ×${v}${o.stab ? ", STAB" : ""}`}
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
                <SummaryHead label="Hit SE" />
                {analysis.tOff.map((r) => (
                  <td
                    key={r.type}
                    title={`${r.se} member(s) hit ${r.type} super-effectively`}
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
        <span className="text-xs text-muted-foreground">The Hit SE row turns red for a type nobody hits super-effectively.</span>
      </Panel>
    </div>
  );
}
