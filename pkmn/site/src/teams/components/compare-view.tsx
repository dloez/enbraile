import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { attacks, bestHit, calcHit, koLine, memberName, scoreboard, type BestHit, type ScoreRow } from "@/analysis/compare";
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
  const [calc, setCalc] = useState<Calc>({ attacker: { team: 0, mon: null }, defender: { team: 1, mon: 0 }, move: 0 });
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
          {!wide && <PoolChip filters={result.filters} className="max-w-full self-start rounded-xl whitespace-normal" />}
          {result.empty.length > 0 && (
            <p className="m-0 text-sm font-bold text-warning">
              No Pokémon to compare in {result.empty.join(", ")}
            </p>
          )}
          {result.teams.length < MIN_COMPARED ? (
            <p className="m-auto font-heading text-2xl text-muted-foreground">Pick at least two teams with Pokémon</p>
          ) : wide ? (
            <>
              <div className="flex min-h-full items-start gap-6">
                <WideScoreboard teams={result.teams} rows={result.rows} />
                <HeadToHead teams={result.teams} gen={result.filters.gen} wide calc={calc} onCalc={setCalc} />
              </div>
              <Matchups teams={result.teams} gen={result.filters.gen} wide calc={calc} onCalc={setCalc} />
            </>
          ) : (
            <>
              <TeamHeads teams={result.teams} />
              <PhoneScoreboard teams={result.teams} rows={result.rows} />
              <HeadToHead teams={result.teams} gen={result.filters.gen} wide={false} calc={calc} onCalc={setCalc} />
              <Matchups teams={result.teams} gen={result.filters.gen} wide={false} calc={calc} onCalc={setCalc} />
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
        className={cn("grid size-5 flex-none place-items-center rounded-[5px] font-heading text-base leading-none text-ink", PLAYER_FILL[playerColour(owner.name)])}
      >
        {owner.name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate text-[0.8125rem] font-bold text-muted-foreground">{owner.name}</span>
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

interface Calc {
  attacker: Pick;
  defender: Pick;
  move: number;
}

function firstAttacker(team: readonly Member[]): number {
  return Math.max(0, team.findIndex((m) => attacks(m).length > 0));
}

function resolve(teams: readonly Compared[], calc: Calc) {
  const ta = teams[Math.min(calc.attacker.team, teams.length - 1)];
  const tb = teams[Math.min(calc.defender.team, teams.length - 1)];
  const ai = calc.attacker.mon === null ? firstAttacker(ta.team) : Math.min(calc.attacker.mon, ta.team.length - 1);
  const bi = Math.min(calc.defender.mon ?? 0, tb.team.length - 1);
  return { ta, tb, ai, bi };
}

const hitTone = (max: number) => (max >= 100 ? "text-coral" : max >= 50 ? "text-warning" : "text-green");

const teamOptionsOf = (teams: readonly Compared[]) => teams.map((t, at) => ({ value: String(at), label: `${t.name} · ${t.owner.name}` }));

function HeadToHead({ teams, gen, wide, calc, onCalc }: { teams: readonly Compared[]; gen: Gen; wide: boolean; calc: Calc; onCalc: (calc: Calc) => void }) {
  const { attacker, defender } = calc;
  const { ta, tb, ai, bi } = resolve(teams, calc);
  const A = ta.team[ai];
  const B = tb.team[bi];
  const moves = attacks(A);
  const mi = Math.min(calc.move, Math.max(0, moves.length - 1));
  const M = moves[mi];
  const hit = M ? calcHit(gen, A, M, B) : null;
  const teamOptions = teamOptionsOf(teams);
  const tone = hit ? hitTone(hit.max) : "text-muted-foreground";
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
              onChange={(v) => onPick({ team: Number(v), mon: label === "Attacker" ? null : 0 })}
            />
            <SelectField
              label={label}
              size="sm"
              className="w-full"
              value={String(at)}
              options={team.team.map((x, i) => ({ value: String(i), label: memberName(x) }))}
              onChange={(v) => onPick({ ...pick, mon: Number(v) })}
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
      {side("Attacker", attacker, ta, ai, (pick) => onCalc({ ...calc, attacker: pick, move: 0 }))}
      {side("Defender", defender, tb, bi, (pick) => onCalc({ ...calc, defender: pick }))}
      <div className="flex items-center gap-2">
        <span className="font-heading text-[1.1875rem] text-muted-foreground">Move</span>
        <SelectField
          label="Move"
          className="min-w-0 flex-1"
          value={String(mi)}
          options={moves.length ? moves.map((mv, i) => ({ value: String(i), label: mv.power ? `${mv.name} · ${mv.type} · ${mv.power}` : `${mv.name} · ${mv.type}` })) : [{ value: "0", label: "No damaging move" }]}
          disabled={moves.length === 0}
          onChange={(v) => onCalc({ ...calc, move: Number(v) })}
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
        onClick={() => onCalc({ attacker: { team: teams.indexOf(tb), mon: bi }, defender: { team: teams.indexOf(ta), mon: ai }, move: 0 })}
        className={cn(buttonClass, "self-start px-3.5 text-[1.375rem]")}
      >
        ⇄ Swap sides
      </button>
    </section>
  );
}

interface Shown {
  value: string;
  tone: string;
  move: string;
}

function shown(hit: BestHit | null): Shown {
  if (!hit) return { value: "—", tone: "text-muted-foreground", move: "No attack" };
  if (!hit.damage) return { value: "0%", tone: "text-muted-foreground", move: hit.name };
  return { value: `${Math.round(hit.damage.max)}%`, tone: hitTone(hit.damage.max), move: hit.name };
}

function HitLine({ arrow, hit, first, wide }: { arrow: string; hit: Shown; first: string; wide: boolean }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span aria-hidden="true" className="flex-none text-[0.8125rem] font-extrabold text-faint">
        {arrow}
      </span>
      <span className={cn("flex-none font-heading leading-none", wide ? "text-2xl" : "text-xl", hit.tone)}>{hit.value}</span>
      {wide && <span className="min-w-0 truncate text-xs font-bold text-muted-foreground">{hit.move}</span>}
      {first && <span className="ml-auto flex-none font-heading text-base leading-none text-primary">{first}</span>}
    </span>
  );
}

function Matchups({ teams, gen, wide, calc, onCalc }: { teams: readonly Compared[]; gen: Gen; wide: boolean; calc: Calc; onCalc: (calc: Calc) => void }) {
  const [axes, setAxes] = useState({ rows: 0, cols: 1 });
  const rows = Math.min(axes.rows, teams.length - 1);
  const clamped = Math.min(axes.cols, teams.length - 1);
  const cols = clamped === rows ? (rows === 0 ? 1 : 0) : clamped;
  const tr = teams[rows];
  const tc = teams[cols];
  const { ta, tb, ai, bi } = resolve(teams, calc);
  const teamOptions = teamOptionsOf(teams);
  const grid = { gridTemplateColumns: wide ? `210px repeat(${tc.team.length}, minmax(120px, 1fr))` : `96px repeat(${tc.team.length}, 92px)` };

  function field(label: string, value: number, onChange: (at: number) => void) {
    return (
      <span className={cn("flex items-center gap-2", wide ? "w-70" : "w-full")}>
        <span className={cn("flex-none font-heading text-[1.1875rem] text-muted-foreground", !wide && "w-17")}>{label}</span>
        <SelectField label={label} size="sm" className="min-w-0 flex-1" value={String(value)} options={teamOptions} onChange={(v) => onChange(Number(v))} />
      </span>
    );
  }

  const rowsField = field("Rows", rows, (at) => setAxes(at === cols ? { rows: at, cols: rows } : { rows: at, cols }));
  const colsField = field("Columns", cols, (at) => setAxes(at === rows ? { rows: cols, cols: at } : { rows, cols: at }));
  const swap = (
    <button type="button" aria-label="Swap rows and columns" onClick={() => setAxes({ rows: cols, cols: rows })} className={cn(buttonClass, "flex-none px-3.5 text-[1.375rem]")}>
      ⇄
    </button>
  );

  function pick(i: number, j: number, hit: BestHit | null) {
    onCalc({ attacker: { team: rows, mon: i }, defender: { team: cols, mon: j }, move: hit?.move ?? 0 });
    if (!wide) document.getElementById("compare-calc")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-labelledby="compare-matchups" className={cn("flex flex-col overflow-hidden rounded-[18px] border-3 bg-card", wide && "mt-2")}>
      {wide ? (
        <div className="flex items-center gap-3 bg-box px-4 py-3.5">
          <h2 id="compare-matchups" className="m-0 flex-1 font-heading text-[1.875rem] leading-none font-normal">
            Matchups
          </h2>
          {rowsField}
          {swap}
          {colsField}
        </div>
      ) : (
        <div className="flex flex-col gap-2 bg-box px-3.5 pt-2.5 pb-3">
          <h2 id="compare-matchups" className="m-0 font-heading text-[1.625rem] leading-none font-normal">
            Matchups
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {rowsField}
              {colsField}
            </div>
            {swap}
          </div>
          <span className="text-xs font-bold text-muted-foreground">→ row hits column · ← column hits row</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <div role="table" aria-labelledby="compare-matchups" className="flex flex-col" style={wide ? { minWidth: 210 + tc.team.length * 120 } : { width: 96 + tc.team.length * 92 }}>
          <div role="row" className="grid border-t-2 border-cell bg-box" style={grid}>
            {wide ? (
              <span role="columnheader" className="flex flex-col justify-center px-4 py-2 text-xs font-bold text-muted-foreground">
                <span>→ row hits column</span>
                <span>← column hits row</span>
              </span>
            ) : (
              <span role="columnheader" className="sticky left-0 z-1 border-r-3 border-cell bg-box" />
            )}
            {tc.team.map((m, j) => (
              <span key={j} role="columnheader" className={cn("flex min-w-0 flex-col justify-end", wide ? "border-l-3 border-cell px-3 py-2" : "px-2 py-1.5")}>
                <span className={cn("truncate font-heading leading-none", wide ? "text-2xl" : "text-[1.1875rem]")}>{memberName(m)}</span>
                <span className={cn("font-bold text-muted-foreground", wide ? "text-xs" : "text-[0.6875rem]")}>Spe {m.stats.spe}</span>
              </span>
            ))}
          </div>
          {tr.team.map((R, i) => (
            <div key={i} role="row" className="grid border-t-2 border-cell" style={grid}>
              <span
                role="rowheader"
                className={cn("flex min-w-0 flex-col justify-center", wide ? "px-4" : "sticky left-0 z-1 border-r-3 border-cell bg-card px-2")}
              >
                <span className={cn("truncate font-heading leading-none", wide ? "text-2xl" : "text-[1.1875rem]")}>{memberName(R)}</span>
                <span className={cn("font-bold text-muted-foreground", wide ? "text-xs" : "text-[0.6875rem]")}>Spe {R.stats.spe}</span>
              </span>
              {tc.team.map((C, j) => {
                const out = bestHit(gen, R, C);
                const back = bestHit(gen, C, R);
                const first = R.stats.spe > C.stats.spe ? "out" : R.stats.spe < C.stats.spe ? "back" : "tie";
                const mark = (side: string) => (first === side ? "1st" : first === "tie" ? "tie" : "");
                const on = (ta === tr && ai === i && tb === tc && bi === j) || (ta === tc && ai === j && tb === tr && bi === i);
                const outShown = shown(out);
                const backShown = shown(back);
                const faster = first === "tie" ? "Speed tie" : `${memberName(first === "out" ? R : C)} moves first`;
                return (
                  <span key={j} role="cell" className={cn("flex min-w-0", wide ? "border-l-3 border-cell p-1.5" : "p-1")}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${memberName(R)} hits ${memberName(C)} for ${outShown.value}, ${memberName(C)} hits ${memberName(R)} for ${backShown.value}, ${faster}`}
                      onClick={() => pick(i, j, out)}
                      className={cn(
                        "flex min-w-0 flex-1 cursor-pointer flex-col justify-center border-3 text-left outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
                        wide ? "min-h-16 gap-1 rounded-[10px] px-2.5 py-1.5" : "min-h-14 gap-0.5 rounded-[9px] px-1.5 py-1",
                        on ? "border-primary bg-box" : "border-cell bg-ink",
                      )}
                    >
                      <HitLine arrow="→" hit={outShown} first={mark("out")} wide={wide} />
                      <HitLine arrow="←" hit={backShown} first={mark("back")} wide={wide} />
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
