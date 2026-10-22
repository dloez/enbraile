import { useEffect, useMemo, useState } from "react";
import { buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool, legality } from "@/analysis/pool";
import { analyze } from "@/analysis/team";
import { ArchetypeCard, Checklist } from "@/components/analysis/archetype";
import { ArchetypeMap, SpeedTiers } from "@/components/analysis/charts";
import { Segmented } from "@/components/controls";
import { toolPage } from "@/components/page";
import { cn } from "@/lib/utils";
import { MemberCards, Matrices } from "@/components/analysis/members";
import { PoolBar } from "@/team-analysis/components/pool-bar";
import { CompareView } from "@/team-analysis/components/compare-view";
import { PoolView } from "@/team-analysis/components/pool-view";
import { TeamGraph } from "@/components/analysis/team-graph";
import { TeamInput, teamStatus } from "@/team-analysis/components/team-input";
import { loadDrafts, saveDrafts, type Drafts } from "@/team-analysis/drafts";

type View = "analyse" | "pool" | "compare";

const VIEWS: readonly { value: View; label: string }[] = [
  { value: "analyse", label: "Analyse" },
  { value: "pool", label: "Pool" },
  { value: "compare", label: "Compare" },
];

export function TeamAnalysisPage() {
  const [drafts, setDrafts] = useState<Drafts>(loadDrafts);
  const [text, setText] = useState(drafts.paste);
  const [view, setView] = useState<View>("analyse");
  const { filters, useTera } = drafts;

  useEffect(() => saveDrafts(drafts), [drafts]);

  const update = (patch: Partial<Drafts>) => setDrafts((d) => ({ ...d, ...patch }));
  const pool = useMemo(() => buildPool(filters), [filters]);
  const built = useMemo(() => buildTeam(filters.gen, parsePaste(drafts.paste)), [filters.gen, drafts.paste]);
  const analysis = useMemo(
    () => (built.team.length ? analyze(built.team, pool, { useTera }) : null),
    [built, pool, useTera],
  );
  const legal = (m: Parameters<typeof legality>[0]) => legality(m, filters);
  const status = teamStatus(built.team, built.failed, legal);
  const top = analysis?.archetype[0];

  return (
    <main className={cn(toolPage, "gap-4.5 pt-5 pb-10")}>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Views" options={VIEWS} value={view} onChange={setView} />
      </div>
      <PoolBar filters={filters} pool={pool} onChange={(f) => update({ filters: f })} />
      {view === "pool" && <PoolView pool={pool} team={built.team} />}
      {view === "compare" && (
        <CompareView slots={drafts.compare} current={drafts.paste} pool={pool} onSlots={(compare) => update({ compare })} />
      )}
      {view === "analyse" && (
        <>
          <TeamInput
            draft={text}
            committed={drafts.paste}
            team={built.team}
            archetype={top ? top.name : null}
            status={status}
            useTera={useTera}
            teraAllowed={filters.gen >= 9}
            onDraft={setText}
            onAnalyse={(paste) => {
              setText(paste);
              update({ paste });
            }}
            onTera={(on) => update({ useTera: on })}
          />
          {analysis && (
            <>
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <ArchetypeCard analysis={analysis} />
                <Checklist analysis={analysis} />
              </div>
              <TeamGraph team={built.team} analysis={analysis} />
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <ArchetypeMap team={built.team} analysis={analysis} pool={pool} />
                <SpeedTiers team={built.team} pool={pool} />
              </div>
              <h2 className="m-0 mt-1.5 font-heading text-4xl">Members</h2>
              <MemberCards team={built.team} analysis={analysis} legality={legal} />
              <Matrices team={built.team} analysis={analysis} pool={pool} />
            </>
          )}
        </>
      )}
    </main>
  );
}
