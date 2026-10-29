import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Maximize2, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool, legality, type PoolFilters } from "@/analysis/pool";
import { PoolBar } from "@/components/pool-bar";
import { PoolView } from "@/teams/components/pool-view";
import { analyze } from "@/analysis/team";
import { showdownTeam } from "@/teams/showdown";
import { MAX_TEAM_SIZE, type Slots, type Stocks } from "@/teams/team";
import { TeamAnalysis } from "@/teams/components/summary-panels";
import { ArchetypeCard, Checklist } from "@/components/analysis/archetype";
import { ArchetypeMap, SpeedTiers } from "@/components/analysis/charts";
import { buttonClass } from "@/components/controls";
import { Matrices, MemberCards } from "@/components/analysis/members";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { poolLabel } from "../../../shared/pool";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    views: { summary: "Overview", graph: "Teamwork", archetype: "Playstyle", members: "Roles", matrices: "Type matchups", speed: "Speed", pool: "Opponents" },
    analysisView: "Analysis view",
    empty: "Add a Pokémon to analyse the team",
    teamPool: "The team's pool",
    tera: "Tera",
    analysis: "Analysis",
    full: "Full analysis",
    close: "Close the analysis",
  },
  es: {
    views: { summary: "Resumen", graph: "Sinergias", archetype: "Estilo", members: "Roles", matrices: "Tabla de tipos", speed: "Velocidad", pool: "Rivales" },
    analysisView: "Vista del análisis",
    empty: "Añade un Pokémon para analizar el equipo",
    teamPool: "La reserva del equipo",
    tera: "Tera",
    analysis: "Análisis",
    full: "Análisis completo",
    close: "Cerrar el análisis",
  },
});

type GraphModule = typeof import("@/components/analysis/team-graph");

let graphModule: GraphModule | null = null;

function loadGraph(): Promise<GraphModule> {
  return import("@/components/analysis/team-graph").then((m) => (graphModule = m));
}

export function preloadGraph() {
  void loadGraph();
}

function TeamGraph(props: ComponentProps<GraphModule["TeamGraph"]>) {
  const [loaded, setLoaded] = useState(graphModule);
  useEffect(() => {
    if (!loaded) void loadGraph().then(setLoaded);
  }, [loaded]);
  return loaded ? <loaded.TeamGraph {...props} /> : null;
}

type View = "summary" | "graph" | "archetype" | "members" | "matrices" | "speed" | "pool";

const VIEWS: readonly { value: View; label: string }[] = [
  { value: "summary", label: t.views.summary },
  { value: "graph", label: t.views.graph },
  { value: "archetype", label: t.views.archetype },
  { value: "members", label: t.views.members },
  { value: "matrices", label: t.views.matrices },
  { value: "speed", label: t.views.speed },
];

const FULL_VIEWS: readonly { value: View; label: string }[] = [...VIEWS, { value: "pool", label: t.views.pool }];

const tabClass = (on: boolean) =>
  cn(
    "min-h-9 cursor-pointer rounded-lg border-none px-3 font-heading text-xl whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    on ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
  );

function Tabs({ views, view, onView, className }: { views: readonly { value: View; label: string }[]; view: View; onView: (view: View) => void; className?: string }) {
  return (
    <div role="tablist" aria-label={t.analysisView} className={cn("flex flex-none gap-1 overflow-x-auto rounded-xl border-3 bg-ink p-1", className)}>
      {views.map((v) => (
        <button key={v.value} type="button" role="tab" aria-selected={view === v.value} onClick={() => onView(v.value)} className={cn(tabClass(view === v.value), "flex-1")}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

type Teras = Readonly<Record<string, string>>;

function useAnalysis(slots: Slots, stocks: Stocks, filters: PoolFilters, useTera: boolean, teras: Teras) {
  const pool = buildPool(filters);
  const text = showdownTeam(slots, stocks);
  const built = useMemo(() => buildTeam(filters.gen, parsePaste(text, MAX_TEAM_SIZE)).team, [filters.gen, text]);
  const team = useMemo(() => (useTera ? built.map((m) => ({ ...m, teraType: teras[m.id] ?? m.types[0] ?? "" })) : built), [built, useTera, teras]);
  const analysis = useMemo(() => (team.length ? analyze(team, pool, { useTera }) : null), [team, pool, useTera]);
  return { pool, team, analysis };
}

interface ViewsProps {
  view: View;
  slots: Slots;
  stocks: Stocks;
  filters: PoolFilters;
  useTera: boolean;
  teras: Teras;
  onTera: (species: string, type: string) => void;
  onPool?: (filters: PoolFilters) => void;
  narrow: boolean;
}

function Views({ view, slots, stocks, filters, useTera, teras, onTera, onPool, narrow }: ViewsProps) {
  const { pool, team, analysis } = useAnalysis(slots, stocks, filters, useTera, teras);
  if (view === "pool") {
    return (
      <>
        <PoolBar filters={filters} pool={pool} onChange={onPool} />
        <PoolView pool={pool} team={team} />
      </>
    );
  }
  if (!analysis) return <p className="m-auto font-heading text-2xl text-muted-foreground">{t.empty}</p>;
  const pair = narrow ? "flex flex-col gap-3.5" : "grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
  return (
    <>
      {view === "summary" && (
        <>
          <div className={cn(pair, narrow && "[&_ul]:grid-cols-1!")}>
            <ArchetypeCard analysis={analysis} />
            <Checklist analysis={analysis} />
          </div>
          <TeamAnalysis slots={slots} stocks={stocks} stacked={narrow} />
        </>
      )}
      {view === "graph" && <TeamGraph team={team} analysis={analysis} height={narrow ? 420 : 520} fill />}
      {view === "archetype" && (
        <div className={cn(pair, "flex-1 *:last:flex-1")}>
          <ArchetypeCard analysis={analysis} />
          <ArchetypeMap team={team} analysis={analysis} pool={pool} />
        </div>
      )}
      {view === "members" && (
        <div className={cn(narrow && "[&>div]:grid-cols-1!")}>
          <MemberCards team={team} analysis={analysis} legality={(m) => legality(m, filters)} tera={useTera ? { of: (m) => m.teraType, onChange: (m, type) => onTera(m.id, type) } : undefined} />
        </div>
      )}
      {view === "matrices" && (
        <div className="flex min-w-0 flex-1 flex-col overflow-x-auto *:flex-1 *:*:last:flex-1">
          <Matrices team={team} analysis={analysis} pool={pool} />
        </div>
      )}
      {view === "speed" && (
        <div className="flex flex-1 flex-col *:flex-1">
          <SpeedTiers team={team} pool={pool} />
        </div>
      )}
    </>
  );
}

export function PoolChip({ filters, className }: { filters: PoolFilters; className?: string }) {
  const pool = buildPool(filters);
  return (
    <span title={t.teamPool} className={cn("rounded-full border-2 px-3 py-1 text-[0.8125rem] font-bold whitespace-nowrap text-stat-down", className)}>
      {poolLabel(filters)} · <span className="tabular-nums">{pool.size}</span>
    </span>
  );
}

function TeraToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-heading text-[1.375rem] text-subtle">
      <input type="checkbox" checked={on} onChange={(event) => onChange(event.target.checked)} className="size-4.5 accent-primary" />
      {t.tera}
    </label>
  );
}

export function SheetAnalysis({ slots, stocks, name, pool: filters, onPool }: { slots: Slots; stocks: Stocks; name: string; pool: PoolFilters; onPool?: (filters: PoolFilters) => void }) {
  const [view, setView] = useState<View>("summary");
  const [full, setFull] = useState(false);
  const [tera, setTera] = useState(false);
  const [teras, setTeras] = useState<Teras>({});
  const teraAllowed = filters.gen >= 9;
  const useTera = tera && teraAllowed;
  const panelView = VIEWS.some((v) => v.value === view) ? view : "summary";
  const shared = { slots, stocks, filters, useTera, teras, onPool, onTera: (species: string, type: string) => setTeras((now) => ({ ...now, [species]: type })) };
  return (
    <>
      <div className="flex flex-none items-center gap-2.5">
        <h2 className="m-0 flex-1 font-heading text-[2rem] leading-none font-normal">{t.analysis}</h2>
        <button type="button" onClick={() => setFull(true)} className={cn(buttonClass, "min-h-10 px-3 text-[1.3125rem]")}>
          <Maximize2 aria-hidden="true" />
          {t.full}
        </button>
      </div>
      <Tabs views={VIEWS} view={panelView} onView={setView} />
      <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-2 [scrollbar-color:var(--cell-hi)_transparent] [scrollbar-width:thin]">
        <Views view={panelView} {...shared} narrow />
      </div>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="inset-0 top-0 left-0 flex h-(--screen-h) w-(--screen-w) max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none"
        >
          <div className="flex min-h-19 flex-none flex-wrap items-center gap-4 border-b-4 border-red bg-ink py-3 pr-4 pl-4 sm:pr-8 sm:pl-10">
            <DialogTitle className="m-0 truncate font-heading text-[2.375rem] leading-none font-normal">
              <span className="text-muted-foreground">{name} ·</span> {t.analysis}
            </DialogTitle>
            <Tabs views={FULL_VIEWS} view={view} onView={setView} className="max-w-full bg-background" />
            <div className="flex-1" />
            {teraAllowed && <TeraToggle on={tera} onChange={setTera} />}
            <PoolChip filters={filters} className="max-sm:hidden" />
            <DialogPrimitive.Close
              aria-label={t.close}
              className="grid size-12 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-5 sm:px-10">
            <Views view={view} {...shared} narrow={false} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
