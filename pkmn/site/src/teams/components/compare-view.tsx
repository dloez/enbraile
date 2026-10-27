import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { attacks, calcHit, koLine, memberName, scoreboard, type ScoreRow } from "@/analysis/compare";
import type { Gen } from "../../../shared/dex";
import { buildTeam, type Member } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool } from "@/analysis/pool";
import { spriteOf } from "@/analysis/sprite";
import { analyze, type Analysis } from "@/analysis/team";
import { buttonClass } from "@/components/controls";
import { SelectField } from "@/components/select-field";
import { PLAYER_FILL, playerColour } from "@/components/player-badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PoolChip } from "@/teams/components/sheet-analysis";
import { liveSlots } from "@/teams/dex";
import { MAX_TEAM_SIZE, stockOf, type Stocks } from "@/teams/team";
import { showdownTeam } from "@/teams/showdown";
import { MIN_COMPARED, teamPage, type TeamPage } from "../../../shared/team";

interface Compared {
  id: string;
  name: string;
  owner: { id: string; name: string };
  size: number;
  team: Member[];
  analysis: Analysis;
}

function stocksOf(page: TeamPage): Stocks {
  return new Map(page.sources.map((s) => [s.id, stockOf(s)]));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function usePages(ids: readonly string[]) {
  const [pages, setPages] = useState<TeamPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    let live = true;
    setPages(null);
    setError(null);
    Promise.all(key.split(",").map((id) => api(`/teams/${encodeURIComponent(id)}`, teamPage))).then(
      (next) => live && setPages(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return { pages, error };
}

function compare(pages: readonly TeamPage[]) {
  const filters = pages[0].pool;
  const pool = buildPool(filters);
  const teams: Compared[] = [];
  const empty: string[] = [];
  for (const page of pages) {
    const stocks = stocksOf(page);
    const text = showdownTeam(liveSlots(page.slots, stocks), stocks);
    const team = buildTeam(filters.gen, parsePaste(text, MAX_TEAM_SIZE)).team;
    if (team.length === 0) empty.push(page.name);
    else teams.push({ id: page.id, name: page.name, owner: page.owner, size: page.slots.length, team, analysis: analyze(team, pool) });
  }
  return { filters, teams, empty, rows: teams.length >= MIN_COMPARED ? scoreboard(filters.gen, teams) : [] };
}

export function CompareDialog({ ids, onClose }: { ids: readonly string[] | null; onClose: () => void }) {
  const wide = useMediaQuery("(min-width: 64rem)");
  return (
    <Dialog open={ids !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="inset-0 top-0 left-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none"
      >
        {ids && <Comparison ids={ids} wide={wide} />}
      </DialogContent>
    </Dialog>
  );
}

const closeClass =
  "grid flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50";

function Comparison({ ids, wide }: { ids: readonly string[]; wide: boolean }) {
  const { pages, error } = usePages(ids);
  const result = useMemo(() => (pages ? compare(pages) : null), [pages]);
  const title = `Compare ${ids.length} teams`;
  return (
    <>
      {wide ? (
        <div className="flex min-h-19 flex-none items-center gap-4 border-b-4 border-red bg-ink pr-8 pl-10">
          <DialogTitle className="m-0 flex-1 truncate font-heading text-[2.5rem] leading-none font-normal">{title}</DialogTitle>
          {result && <PoolChip filters={result.filters} />}
          <DialogPrimitive.Close aria-label="Close" className={cn(closeClass, "size-12")}>
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
      ) : (
        <div className="flex h-15 flex-none items-center gap-2.5 border-b-4 border-red bg-ink px-3">
          <DialogPrimitive.Close aria-label="Back to Teams" className={cn(closeClass, "size-11")}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
          <DialogTitle className="m-0 flex-1 truncate font-heading text-[1.875rem] leading-none font-normal">{title}</DialogTitle>
        </div>
      )}
      {error && (
        <p role="alert" className="m-auto px-4 text-destructive">
          {error}
        </p>
      )}
      {!error && !result && <p className="m-auto font-heading text-2xl text-muted-foreground">Loading…</p>}
      {result && (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto *:flex-none", wide ? "px-10 pt-5 pb-8" : "px-4 pt-4 pb-8")}>
          {!wide && <PoolChip filters={result.filters} className="self-start" />}
          {result.empty.length > 0 && (
            <p className="m-0 text-sm font-bold text-warning">
              No Pokémon to compare in {result.empty.join(", ")}
            </p>
          )}
          {result.teams.length < MIN_COMPARED ? (
            <p className="m-auto font-heading text-2xl text-muted-foreground">Pick at least two teams with Pokémon</p>
          ) : wide ? (
            <div className="flex flex-1! items-start gap-6">
              <WideScoreboard teams={result.teams} rows={result.rows} />
              <HeadToHead teams={result.teams} gen={result.filters.gen} wide />
            </div>
          ) : (
            <>
              <TeamHeads teams={result.teams} />
              <PhoneScoreboard teams={result.teams} rows={result.rows} />
              <HeadToHead teams={result.teams} gen={result.filters.gen} wide={false} />
            </>
          )}
        </div>
      )}
    </>
  );
}

function OwnerMark({ owner, className }: { owner: Compared["owner"]; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span
        aria-hidden="true"
        className={cn("grid size-5 flex-none place-items-center rounded-[5px] font-heading text-base leading-none text-ink", PLAYER_FILL[playerColour(owner.id)])}
      >
        {owner.name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate text-[0.8125rem] font-bold text-muted-foreground">{owner.name}</span>
    </span>
  );
}

function Sprites({ team, size }: { team: readonly Member[]; size: "md" | "sm" }) {
  return (
    <span className="flex flex-wrap">
      {team.map((m, at) => (
        <span key={at} title={memberName(m)} className={cn("flex items-center justify-center overflow-hidden", size === "md" ? "h-9 w-10" : "h-7.5 w-8.5")}>
          <img
            src={spriteOf(m)}
            alt=""
            className={cn("flex-none [image-rendering:pixelated]", size === "md" ? "-mx-1 -mt-2 -mb-1 size-12" : "-mx-0.75 -mt-1.5 -mb-0.75 size-10")}
          />
        </span>
      ))}
    </span>
  );
}

const cellBest = (best: boolean) => (best ? "bg-green/12 text-green" : "text-foreground");

function WideScoreboard({ teams, rows }: { teams: readonly Compared[]; rows: readonly ScoreRow[] }) {
  const grid = { gridTemplateColumns: `210px repeat(${teams.length}, minmax(0, 1fr))` };
  return (
    <section aria-label="Scoreboard" className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden rounded-[18px] border-3 bg-card">
      <div role="table" aria-label="Scoreboard" className="flex flex-1 flex-col">
        <div role="row" className="grid bg-box" style={grid}>
          <span role="columnheader" className="self-end px-4 py-3 font-heading text-[1.625rem] leading-none">
            Scoreboard
          </span>
          {teams.map((t) => (
            <span key={t.id} role="columnheader" className="flex min-w-0 flex-col justify-end border-l-3 border-cell px-3 pt-2.5 pb-2">
              <OwnerMark owner={t.owner} className="mb-0.5" />
              <span className="truncate font-heading text-[1.875rem] leading-none">{t.name}</span>
              <span className="mt-1">
                <Sprites team={t.team} size="md" />
              </span>
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.label} role="row" className="grid min-h-11 flex-1 border-t-2 border-cell" style={grid}>
            <span role="rowheader" className="flex items-center px-4 text-sm font-bold text-subtle">
              {row.label}
            </span>
            {row.cells.map((c, at) => (
              <span key={at} role="cell" className={cn("flex min-w-0 items-center gap-2 border-l-3 border-cell px-3", cellBest(c.best))}>
                <span className="font-heading text-2xl leading-none">{c.value}</span>
                <span className="truncate text-xs font-bold text-muted-foreground">{c.note}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamHeads({ teams }: { teams: readonly Compared[] }) {
  return (
    <ol aria-label="Teams" className="m-0 flex list-none flex-col gap-2 p-0">
      {teams.map((t, at) => (
        <li key={t.id} className="flex items-center gap-2.5 rounded-[14px] border-3 bg-card px-3 py-2">
          <span className="w-7 flex-none text-center font-heading text-[1.75rem] leading-none text-primary">{at + 1}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <OwnerMark owner={t.owner} />
            <span className="truncate font-heading text-[1.625rem] leading-none">{t.name}</span>
            <Sprites team={t.team} size="sm" />
          </span>
        </li>
      ))}
    </ol>
  );
}

function PhoneScoreboard({ teams, rows }: { teams: readonly Compared[]; rows: readonly ScoreRow[] }) {
  const grid = { gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` };
  return (
    <section aria-labelledby="compare-scoreboard" className="flex flex-col overflow-hidden rounded-[18px] border-3 bg-card">
      <h2 id="compare-scoreboard" className="m-0 bg-box px-3.5 py-2.5 font-heading text-[1.625rem] leading-none font-normal">
        Scoreboard
      </h2>
      <div role="table" aria-labelledby="compare-scoreboard" className="flex flex-col">
        <div role="row" className="grid border-t-2 border-cell bg-box" style={grid}>
          {teams.map((t, at) => (
            <span key={t.id} role="columnheader" className="px-2.5 py-1 font-heading text-xl text-primary">
              {at + 1}
              <span className="sr-only"> {t.name}</span>
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.label} role="rowgroup" className="flex flex-col border-t-2 border-cell">
            <span className="px-3 pt-1.5 text-[0.8125rem] font-bold text-subtle">{row.label}</span>
            <div role="row" className="grid" style={grid}>
              {row.cells.map((c, at) => (
                <span key={at} role="cell" className={cn("flex min-w-0 flex-col px-2.5 pt-0.5 pb-2", cellBest(c.best))}>
                  <span className="font-heading text-2xl leading-none">{c.value}</span>
                  <span className="truncate text-[0.6875rem] font-bold text-muted-foreground">{c.note}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Pick {
  team: number;
  mon: number | null;
}

const statLine = (m: Member) => `HP ${m.stats.hp} · Atk ${m.stats.atk} · Def ${m.stats.def} · SpA ${m.stats.spa} · SpD ${m.stats.spd} · Spe ${m.stats.spe}`;

function firstAttacker(team: readonly Member[]): number {
  return Math.max(0, team.findIndex((m) => attacks(m).length > 0));
}

function HeadToHead({ teams, gen, wide }: { teams: readonly Compared[]; gen: Gen; wide: boolean }) {
  const [attacker, setAttacker] = useState<Pick>({ team: 0, mon: null });
  const [defender, setDefender] = useState<Pick>({ team: 1, mon: 0 });
  const [move, setMove] = useState(0);
  const ta = teams[Math.min(attacker.team, teams.length - 1)];
  const tb = teams[Math.min(defender.team, teams.length - 1)];
  const ai = attacker.mon === null ? firstAttacker(ta.team) : Math.min(attacker.mon, ta.team.length - 1);
  const bi = Math.min(defender.mon ?? 0, tb.team.length - 1);
  const A = ta.team[ai];
  const B = tb.team[bi];
  const moves = attacks(A);
  const mi = Math.min(move, Math.max(0, moves.length - 1));
  const M = moves[mi];
  const hit = M ? calcHit(gen, A, M, B) : null;
  const teamOptions = teams.map((t, at) => ({ value: String(at), label: `${t.name} · ${t.owner.name}` }));
  const tone = !hit ? "text-muted-foreground" : hit.max >= 100 ? "text-coral" : hit.max >= 50 ? "text-warning" : "text-green";
  const fill = !hit ? "bg-muted-foreground" : hit.max >= 100 ? "bg-coral" : hit.max >= 50 ? "bg-warning" : "bg-green";
  const lo = hit ? Math.min(100, hit.min) : 0;
  const hi = hit ? Math.min(100, hit.max) : 0;

  function side(label: string, pick: Pick, team: Compared, at: number, onPick: (pick: Pick) => void) {
    const m = team.team[at];
    return (
      <div className="flex flex-col gap-2 rounded-xl border-3 border-cell bg-box px-3 py-2.5">
        <span className="font-heading text-[1.1875rem] text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2.5">
          <span className={cn("flex flex-none items-center justify-center overflow-hidden", wide ? "h-14 w-16" : "h-13 w-14")}>
            <img src={spriteOf(m)} alt="" className={cn("flex-none [image-rendering:pixelated]", wide ? "-mx-1.5 -mt-2.5 -mb-2 size-19" : "-mx-1.5 -mt-2 -mb-1.5 size-17")} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SelectField
              label={`${label}'s team`}
              size="sm"
              className="w-full"
              value={String(teams.indexOf(team))}
              options={teamOptions}
              onChange={(v) => {
                onPick({ team: Number(v), mon: label === "Attacker" ? null : 0 });
                if (label === "Attacker") setMove(0);
              }}
            />
            <SelectField
              label={label}
              size="sm"
              className="w-full"
              value={String(at)}
              options={team.team.map((x, i) => ({ value: String(i), label: memberName(x) }))}
              onChange={(v) => {
                onPick({ ...pick, mon: Number(v) });
                if (label === "Attacker") setMove(0);
              }}
            />
          </div>
        </div>
        <span className="text-[0.8125rem] font-bold text-muted-foreground">{statLine(m)}</span>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="compare-calc"
      className={cn("flex flex-col gap-3 rounded-[18px] border-3 bg-card", wide ? "w-115 flex-none self-start px-4.5 py-4" : "p-3.5")}
    >
      <h2 id="compare-calc" className={cn("m-0 font-heading leading-none font-normal", wide ? "text-[1.875rem]" : "text-[1.625rem]")}>
        Head to head
      </h2>
      {side("Attacker", attacker, ta, ai, setAttacker)}
      {side("Defender", defender, tb, bi, setDefender)}
      <div className="flex items-center gap-2">
        <span className="font-heading text-[1.1875rem] text-muted-foreground">Move</span>
        <SelectField
          label="Move"
          className="min-w-0 flex-1"
          value={String(mi)}
          options={moves.length ? moves.map((mv, i) => ({ value: String(i), label: mv.power ? `${mv.name} · ${mv.type} · ${mv.power}` : `${mv.name} · ${mv.type}` })) : [{ value: "0", label: "No damaging move" }]}
          disabled={moves.length === 0}
          onChange={(v) => setMove(Number(v))}
        />
      </div>
      <div className={cn("flex flex-col gap-2 rounded-xl border-3 bg-ink p-3.5", hit && hit.max >= 100 ? "border-coral" : "border-border")}>
        <span className={cn("font-heading leading-none", wide ? "text-[2.5rem]" : "text-4xl", tone)}>{hit ? `${hit.min.toFixed(1)}–${hit.max.toFixed(1)}%` : "—"}</span>
        <span className="flex h-3.5 overflow-hidden rounded-[5px] bg-cell">
          <span className={cn("block", fill)} style={{ width: `${lo}%` }} />
          <span className={cn("block opacity-45", fill)} style={{ width: `${hi - lo}%` }} />
        </span>
        <span className="text-[0.9375rem] font-extrabold">{M ? koLine(hit) : `${memberName(A)} has no damaging move`}</span>
        {M && hit && (
          <span className="text-[0.8125rem] leading-snug text-subtle">
            {M.name}
            {M.power ? ` ${M.power} power` : ""} · ×{hit.mult}
            {A.types.includes(M.type) ? " · STAB" : ""} · Level {A.set.level}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setAttacker({ team: teams.indexOf(tb), mon: bi });
          setDefender({ team: teams.indexOf(ta), mon: ai });
          setMove(0);
        }}
        className={cn(buttonClass, "self-start px-3.5 text-[1.375rem]")}
      >
        ⇄ Swap sides
      </button>
    </section>
  );
}
