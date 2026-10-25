import { useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool, legality, type PoolFilters } from "@/analysis/pool";
import { analyze } from "@/analysis/team";
import type { Mon } from "@/teams/dex";
import { showdownTeam } from "@/teams/showdown";
import { MAX_TEAM_SIZE, type Slots } from "@/teams/team";
import { TeamAnalysis } from "@/teams/components/team-analysis";
import { ArchetypeCard, Checklist } from "@/components/analysis/archetype";
import { ArchetypeMap } from "@/components/analysis/charts";
import { buttonClass } from "@/components/controls";
import { Matrices, MemberCards } from "@/components/analysis/members";
import { TeamGraph } from "@/components/analysis/team-graph";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const SHEET_POOL: PoolFilters = { gen: 9, speciesGen: 5, noLegendary: false, noMythical: false, fullyEvolved: true, maxBst: 800 };

type View = "summary" | "graph" | "archetype" | "members" | "matrices";

const VIEWS: readonly { value: View; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "graph", label: "Graph" },
  { value: "archetype", label: "Archetype" },
  { value: "members", label: "Members" },
  { value: "matrices", label: "Matrices" },
];

const tabClass = (on: boolean) =>
  cn(
    "min-h-9 cursor-pointer rounded-lg border-none px-3 font-heading text-xl whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    on ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
  );

function Tabs({ view, onView, className }: { view: View; onView: (view: View) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Analysis view" className={cn("flex flex-none gap-1 overflow-x-auto rounded-xl border-3 bg-ink p-1", className)}>
      {VIEWS.map((v) => (
        <button key={v.value} type="button" role="tab" aria-selected={view === v.value} onClick={() => onView(v.value)} className={cn(tabClass(view === v.value), "flex-1")}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

function useAnalysis(slots: Slots, mons: readonly Mon[]) {
  const pool = buildPool(SHEET_POOL);
  const text = showdownTeam(slots, mons);
  const team = useMemo(() => buildTeam(SHEET_POOL.gen, parsePaste(text, MAX_TEAM_SIZE)).team, [text]);
  const analysis = useMemo(() => (team.length ? analyze(team, pool) : null), [team, pool]);
  return { pool, team, analysis };
}

function Views({ view, slots, mons, narrow }: { view: View; slots: Slots; mons: readonly Mon[]; narrow: boolean }) {
  const { pool, team, analysis } = useAnalysis(slots, mons);
  if (!analysis) return <p className="m-auto font-heading text-2xl text-muted-foreground">Add a Pokémon to analyse the team</p>;
  const pair = narrow ? "flex flex-col gap-3.5" : "grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
  return (
    <>
      {view === "summary" && (
        <>
          <div className={cn(pair, narrow && "[&_ul]:grid-cols-1!")}>
            <ArchetypeCard analysis={analysis} />
            <Checklist analysis={analysis} />
          </div>
          <TeamAnalysis slots={slots} mons={mons} stacked={narrow} />
        </>
      )}
      {view === "graph" && <TeamGraph team={team} analysis={analysis} height={narrow ? 420 : 520} />}
      {view === "archetype" && (
        <div className={pair}>
          <ArchetypeCard analysis={analysis} />
          <ArchetypeMap team={team} analysis={analysis} pool={pool} />
        </div>
      )}
      {view === "members" && (
        <div className={cn(narrow && "[&>div]:grid-cols-1!")}>
          <MemberCards team={team} analysis={analysis} legality={(m) => legality(m, SHEET_POOL)} />
        </div>
      )}
      {view === "matrices" && (
        <div className="min-w-0 overflow-x-auto">
          <Matrices team={team} analysis={analysis} pool={pool} />
        </div>
      )}
    </>
  );
}

function PoolChip({ className }: { className?: string }) {
  const pool = buildPool(SHEET_POOL);
  return (
    <span
      title="Showdown's Gen 9 data, species up to Gen 5, fully evolved"
      className={cn("rounded-full border-2 px-3 py-1 text-[0.8125rem] font-bold whitespace-nowrap text-stat-down", className)}
    >
      Pool · Gen 1–5 species · fully evolved · <span className="tabular-nums">{pool.size}</span>
    </span>
  );
}

export function SheetAnalysis({ slots, mons, name }: { slots: Slots; mons: readonly Mon[]; name: string }) {
  const [view, setView] = useState<View>("summary");
  const [full, setFull] = useState(false);
  return (
    <>
      <div className="flex flex-none items-center gap-2.5">
        <h2 className="m-0 flex-1 font-heading text-[2rem] leading-none font-normal">Analysis</h2>
        <button type="button" onClick={() => setFull(true)} className={cn(buttonClass, "min-h-10 px-3 text-[1.3125rem]")}>
          <Maximize2 aria-hidden="true" />
          Full analysis
        </button>
      </div>
      <Tabs view={view} onView={setView} />
      <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-2 [scrollbar-color:var(--cell-hi)_transparent] [scrollbar-width:thin]">
        <Views view={view} slots={slots} mons={mons} narrow />
      </div>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="inset-0 top-0 left-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none"
        >
          <div className="flex min-h-19 flex-none flex-wrap items-center gap-4 border-b-4 border-red bg-ink py-3 pr-4 pl-4 sm:pr-8 sm:pl-10">
            <DialogTitle className="m-0 truncate font-heading text-[2.375rem] leading-none font-normal">
              <span className="text-muted-foreground">{name} ·</span> Analysis
            </DialogTitle>
            <Tabs view={view} onView={setView} className="max-w-full bg-background" />
            <div className="flex-1" />
            <PoolChip className="max-sm:hidden" />
            <DialogPrimitive.Close
              aria-label="Close the analysis"
              className="grid size-12 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-5 sm:px-10">
            <Views view={view} slots={slots} mons={mons} narrow={false} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
