import { useState } from "react";
import { cn } from "@/lib/utils";
import { dexFor, typesIn } from "@/analysis/dex";
import { MOVE_TAGS, STATS, type Member, type MoveTag } from "@/analysis/member";
import type { Pool } from "@/analysis/pool";
import { defValue, offValue, type Analysis } from "@/analysis/team";
import { TypeDot } from "@/open-sheet/components/marks";
import { Panel, Segmented } from "@/team-analysis/components/controls";
import { spriteOf } from "@/team-analysis/sprite";

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
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card", illegal && "border-destructive")}>
      <div className="flex items-center gap-3 bg-box p-3">
        <span className="grid size-16 flex-none place-items-center rounded-xl bg-cell">
          <img src={spriteOf(member)} alt="" className="size-16 [image-rendering:pixelated]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-heading text-lg font-semibold">{member.display}</span>
          <span className="flex flex-wrap gap-2.5 text-xs font-semibold">
            {member.types.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.25">
                <TypeDot type={t} className="size-2.25" />
                {t}
              </span>
            ))}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[member.set.ability, member.set.item, `${member.set.nature} · Lv ${member.set.level}`].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-base">{member.bst}</span>
          <span className="text-[10px] text-muted-foreground">BST · P{Math.round(a.pct.bst * 100)}</span>
        </span>
      </div>
      {illegal && <p className="m-0 px-3 pt-2 text-xs font-semibold text-destructive">Not in this pool: {illegal}</p>}
      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
        {a.roles.map((r) => (
          <span key={r} className="rounded-full bg-secondary px-2 py-0.75 text-[11px] font-semibold text-chart-3">
            {r}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.25 px-3 py-2.5">
        <div className="grid grid-cols-[34px_34px_minmax(0,1fr)_30px_38px] gap-2 text-[10px] text-muted-foreground">
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
              <span className="font-mono">{member.base[k]}</span>
              <span className="h-1.5 rounded-sm bg-secondary">
                <span
                  className={cn("block h-1.5 rounded-sm", p >= 0.75 ? "bg-primary" : p >= 0.4 ? "bg-chart-3" : "bg-muted-foreground/60")}
                  style={{ width: `${p * 100}%` }}
                />
              </span>
              <span className="text-right font-mono text-[11px] text-muted-foreground">{Math.round(p * 100)}</span>
              <span className="text-right font-mono">{member.stats[k]}</span>
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
              <TypeDot type={mv.type} className="size-2.25" />
              <span className="min-w-0 flex-1 truncate">{mv.name}</span>
              {tag && <span className="rounded-sm bg-accent px-1.5 text-[10px] font-semibold text-primary">{tag}</span>}
              <span className="font-mono text-[10px] text-muted-foreground">{CATEGORY[mv.category]}</span>
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
  if (v === 0) return "0";
  if (v === 0.125) return "⅛";
  if (v === 0.25) return "¼";
  if (v === 0.5) return "½";
  return String(v);
}

function multCell(v: number): string {
  if (v >= 4) return "bg-destructive/40 text-foreground";
  if (v > 1) return "bg-destructive-soft text-destructive";
  if (v === 0) return "bg-accent text-primary";
  if (v < 1) return "bg-chart-2/15 text-chart-2";
  return "bg-background text-muted-foreground/50";
}

function weightCell(v: number): string {
  if (v >= 3) return "bg-chart-2/40 text-foreground";
  if (v >= 1.5) return "bg-chart-2/25 text-chart-2";
  if (v >= 1) return "bg-chart-2/10 text-chart-2";
  if (v >= 0.5) return "bg-destructive-soft text-destructive";
  return "bg-destructive/40 text-foreground";
}

const f2 = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));

function Head({ types }: { types: readonly string[] }) {
  return (
    <thead>
      <tr>
        <th className="min-w-28" />
        {types.map((t) => (
          <th key={t} className="p-0.5 text-[11px] font-semibold text-muted-foreground">
            <span className="inline-flex flex-col items-center gap-0.75">
              <TypeDot type={t} className="size-2.25" />
              {t.slice(0, 3)}
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Matrices({ team, analysis, pool }: { team: readonly Member[]; analysis: Analysis; pool: Pool }) {
  const [mode, setMode] = useState<MatrixMode>("mult");
  const types = typesIn(analysis.gen);
  const cell = "h-7.5 min-w-7.5 rounded-[5px] text-center font-mono text-xs";
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-heading text-[22px] font-semibold">Matrices</h2>
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
              ? "damage taken, abilities counted"
              : "effective bulk D: 1.00 = an average pool member taking a neutral hit"}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <Head types={types} />
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <th className="pr-2 text-left text-xs font-semibold whitespace-nowrap">{m.set.species}</th>
                  {types.map((t) => {
                    const v = analysis.members[i].def[t];
                    if (mode === "mult") return <td key={t} className={cn(cell, multCell(v))}>{v === 1 ? "" : frac(v)}</td>;
                    const d = defValue(m, t, v, pool);
                    return <td key={t} className={cn(cell, weightCell(d))}>{f2(d)}</td>;
                  })}
                </tr>
              ))}
              <tr>
                <th className="pt-1.5 text-left text-[11px] text-muted-foreground">Weak</th>
                {analysis.tDef.map((r) => (
                  <td
                    key={r.type}
                    className={cn(
                      cell,
                      r.weak >= 3 || (r.unresisted && r.weak > 0) ? "bg-destructive/40 text-foreground" : "text-destructive",
                    )}
                  >
                    {r.weak || ""}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="text-left text-[11px] text-muted-foreground">Resist</th>
                {analysis.tDef.map((r) => (
                  <td key={r.type} className={cn(cell, "text-chart-2")}>
                    {r.resist || ""}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Coverage"
        aside={
          <span className="text-xs text-muted-foreground">
            {mode === "mult"
              ? "best multiplier of each member's damaging moves · ● STAB"
              : "best hit O: 1.00 = a neutral 100 BP hit from an average pool attacker"}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <Head types={types} />
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <th className="pr-2 text-left text-xs font-semibold whitespace-nowrap">{m.set.species}</th>
                  {types.map((t) => {
                    const o = analysis.offs[i][t];
                    if (o.mult === null) return <td key={t} className={cn(cell, "bg-background")} />;
                    if (mode === "weighted") {
                      const hit = offValue(analysis.gen, m, t, pool);
                      return (
                        <td key={t} title={hit.move?.name} className={cn(cell, weightCell(hit.O))}>
                          {f2(hit.O)}
                        </td>
                      );
                    }
                    const v = o.mult;
                    return (
                      <td
                        key={t}
                        title={o.move?.name}
                        className={cn(
                          cell,
                          v > 1 ? "bg-chart-2/15 text-chart-2" : v < 1 ? "bg-destructive-soft text-destructive" : "bg-background text-muted-foreground/50",
                        )}
                      >
                        {frac(v)}
                        {o.stab && v > 1 ? "●" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th className="pt-1.5 text-left text-[11px] text-muted-foreground">Hit SE</th>
                {analysis.tOff.map((r) => (
                  <td key={r.type} className={cn(cell, r.se === 0 ? "bg-destructive/40 text-foreground" : "text-chart-2")}>
                    {r.se}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
