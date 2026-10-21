import { useMemo, useState } from "react";
import { buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool, legality, type PoolFilters } from "@/analysis/pool";
import { analyze } from "@/analysis/team";
import type { Mon } from "@/open-sheet/dex";
import { showdownTeam } from "@/open-sheet/showdown";
import type { Slots } from "@/open-sheet/team";
import { TeamAnalysis } from "@/open-sheet/components/team-analysis";
import { ArchetypeCard, Checklist } from "@/components/analysis/archetype";
import { ArchetypeMap } from "@/components/analysis/charts";
import { Segmented } from "@/components/controls";
import { Matrices, MemberCards } from "@/components/analysis/members";
import { TeamGraph } from "@/components/analysis/team-graph";

export const SHEET_POOL: PoolFilters = { gen: 9, speciesGen: 5, noLegendary: false, noMythical: false, fullyEvolved: true, maxBst: 800 };

type View = "summary" | "graph" | "archetype" | "members" | "matrices";

const VIEWS: readonly { value: View; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "graph", label: "Graph" },
  { value: "archetype", label: "Archetype" },
  { value: "members", label: "Members" },
  { value: "matrices", label: "Matrices" },
];

export function SheetAnalysis({ slots, mons }: { slots: Slots; mons: readonly Mon[] }) {
  const [view, setView] = useState<View>("summary");
  const pool = buildPool(SHEET_POOL);
  const text = showdownTeam(slots, mons);
  const team = useMemo(() => buildTeam(SHEET_POOL.gen, parsePaste(text)).team, [text]);
  const analysis = useMemo(() => (team.length ? analyze(team, pool) : null), [team, pool]);
  if (!analysis) return null;

  return (
    <section aria-label="Analysis" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 font-heading text-xl font-semibold">Analysis</h3>
        <Segmented label="Analysis view" options={VIEWS} value={view} onChange={setView} className="max-w-full overflow-x-auto" />
        <span
          title="Showdown's Gen 9 data, species up to Gen 5, fully evolved"
          className="ml-auto rounded-full border bg-card px-2.5 py-1.5 text-xs font-semibold text-chart-3"
        >
          Pool · Gen 1–5 species · fully evolved · <span className="font-mono">{pool.size}</span>
        </span>
      </div>
      {view === "summary" && (
        <>
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ArchetypeCard analysis={analysis} />
            <Checklist analysis={analysis} />
          </div>
          <TeamAnalysis slots={slots} mons={mons} />
        </>
      )}
      {view === "graph" && <TeamGraph team={team} analysis={analysis} height={520} />}
      {view === "archetype" && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ArchetypeCard analysis={analysis} />
          <ArchetypeMap team={team} analysis={analysis} pool={pool} />
        </div>
      )}
      {view === "members" && <MemberCards team={team} analysis={analysis} legality={(m) => legality(m, SHEET_POOL)} />}
      {view === "matrices" && <Matrices team={team} analysis={analysis} pool={pool} />}
    </section>
  );
}
