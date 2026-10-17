import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, metricsFor, OHKO, pressure, SCORE_ROWS, verdict, WALL, winCounts, winners, type Pressure } from "@/analysis/compare";
import { typesIn } from "@/analysis/dex";
import { buildTeam, STATS, type Member } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import type { Pool } from "@/analysis/pool";
import { SAMPLES } from "@/analysis/samples";
import { analyze, type Analysis } from "@/analysis/team";
import { TypeDot } from "@/open-sheet/components/marks";
import { Radar } from "@/team-analysis/components/archetype";
import { buttonClass, fieldClass, Panel, primaryClass, Segmented } from "@/team-analysis/components/controls";
import { MAX_TEAMS, MIN_TEAMS, type CompareSlot } from "@/team-analysis/drafts";
import { spriteOf } from "@/team-analysis/sprite";

const SERIES = [
  { text: "text-chart-1", bg: "bg-chart-1", border: "border-chart-1", stroke: "stroke-chart-1", fill: "fill-chart-1/15" },
  { text: "text-chart-2", bg: "bg-chart-2", border: "border-chart-2", stroke: "stroke-chart-2", fill: "fill-chart-2/15" },
  { text: "text-chart-3", bg: "bg-chart-3", border: "border-chart-3", stroke: "stroke-chart-3", fill: "fill-chart-3/10" },
  { text: "text-chart-4", bg: "bg-chart-4", border: "border-chart-4", stroke: "stroke-chart-4", fill: "fill-chart-4/10" },
] as const;

interface Result {
  name: string;
  team: Member[];
  failed: string[];
  analysis: Analysis;
}

function SlotEditor({
  slot,
  index,
  canRemove,
  current,
  onChange,
  onRemove,
}: {
  slot: CompareSlot;
  index: number;
  canRemove: boolean;
  current: string;
  onChange: (slot: CompareSlot) => void;
  onRemove: () => void;
}) {
  const s = SERIES[index];
  return (
    <section aria-label={slot.name} className={cn("flex min-w-0 flex-col gap-2.5 rounded-2xl border border-t-3 bg-card p-3.5", s.border)}>
      <div className="flex items-center gap-2">
        <span className={cn("size-3 flex-none rounded-full", s.bg)} aria-hidden="true" />
        <input
          value={slot.name}
          maxLength={40}
          aria-label="Team name"
          onChange={(e) => onChange({ ...slot, name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent font-heading text-lg font-semibold outline-none"
        />
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${slot.name}`} className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <textarea
        spellCheck={false}
        value={slot.text}
        aria-label={`${slot.name} as Showdown text`}
        onChange={(e) => onChange({ ...slot, text: e.target.value })}
        placeholder="Paste a Showdown team"
        className="h-32 resize-y rounded-lg border bg-muted p-2.5 font-mono text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap gap-2">
        <label className={cn(fieldClass, "pr-1.5")}>
          <span className="text-muted-foreground">Sample</span>
          <select
            value=""
            onChange={(e) => {
              const text = SAMPLES[e.target.value];
              if (text) onChange({ name: e.target.value, text });
            }}
            className="bg-transparent"
          >
            <option value="" disabled>
              Pick…
            </option>
            {Object.keys(SAMPLES).map((n) => (
              <option key={n} value={n} className="bg-card">
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!current.trim()} onClick={() => onChange({ ...slot, text: current })} className={buttonClass}>
          Use current team
        </button>
      </div>
    </section>
  );
}

function Scoreboard({ results, pool }: { results: Result[]; pool: Pool }) {
  const metrics = results.map((r) => metricsFor(r.team, r.analysis, pool));
  const wins = winCounts(metrics);
  return (
    <Panel title="Scoreboard" aside={<span className="text-xs text-muted-foreground">★ best on each metric, none on a tie</span>}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b px-2.5 py-1.75 text-left text-xs font-semibold text-muted-foreground">Metric</th>
              {results.map((r, i) => (
                <th key={i} className={cn("border-b px-2.5 py-1.75 text-right text-xs font-semibold", SERIES[i].text)}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCORE_ROWS.map((row) => {
              if ("group" in row)
                return (
                  <tr key={row.group}>
                    <td colSpan={results.length + 1} className="px-2.5 pt-3.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {row.group}
                    </td>
                  </tr>
                );
              const win = winners(row, metrics);
              return (
                <tr key={row.k} className="border-b border-border/50">
                  <td className="px-2.5 py-1.75" title={row.hint}>
                    {row.label}
                    {row.hint && <span className="ml-1 text-muted-foreground">?</span>}
                  </td>
                  {metrics.map((m, i) => (
                    <td key={i} className={cn("px-2.5 py-1.75 text-right font-mono whitespace-nowrap", win[i] && SERIES[i].text)}>
                      {win[i] && "★ "}
                      {format(m[row.k], row.fmt)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2.5 py-2 font-semibold">Stars</td>
              {wins.map((w, i) => (
                <td key={i} className={cn("px-2.5 py-2 text-right font-mono font-semibold", SERIES[i].text)}>
                  {w}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function HeadToHead({ results, gen }: { results: Result[]; gen: Pool["filters"]["gen"] }) {
  const P = useMemo(
    () => results.map((A) => results.map((B) => (A === B ? null : pressure(gen, A.team, B.team)))),
    [results, gen],
  );
  const [pair, setPair] = useState<[number, number]>([0, 1]);
  const [ai, bi] = pair[0] < results.length && pair[1] < results.length && pair[0] !== pair[1] ? pair : [0, 1];
  const detail = P[ai][bi] as Pressure;
  const pairs = results.flatMap((_, i) => results.map((_, j) => [i, j] as [number, number])).filter(([i, j]) => i !== j);
  return (
    <Panel title="Head-to-head" aside={<span className="text-xs text-muted-foreground">strongest hit on each defender, % HP, full HP, no field</span>}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {pairs.map(([i, j]) => {
          const p = P[i][j] as Pressure;
          const rev = P[j][i] as Pressure;
          const ahead = p.mean > rev.mean;
          const on = i === ai && j === bi;
          return (
            <button
              key={`${i}-${j}`}
              type="button"
              aria-pressed={on}
              onClick={() => setPair([i, j])}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                ahead ? "bg-accent" : "bg-muted",
                on && "border-primary",
              )}
            >
              <span className="text-xs font-semibold">
                <span className={SERIES[i].text}>{results[i].name}</span> <span className="text-muted-foreground">→</span>{" "}
                <span className={SERIES[j].text}>{results[j].name}</span>
              </span>
              <span className="font-mono text-[30px] leading-none font-medium">{p.mean.toFixed(0)}%</span>
              <span className="text-xs text-muted-foreground">mean pressure</span>
              <span className="flex gap-3 text-xs">
                <span>
                  <span className="font-mono">{p.ohko}</span> <span className="text-muted-foreground">OHKO</span>
                </span>
                <span>
                  <span className="font-mono">{p.twohko}</span> <span className="text-muted-foreground">2HKO</span>
                </span>
                <span>
                  <span className="font-mono">{p.walls}</span> <span className="text-muted-foreground">walls it</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">
        {results[ai].name} hitting {results[bi].name}
      </span>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {detail.per.map((x, k) => {
          const lo = Math.min(x.min, 100);
          const hi = Math.min(x.max, 100);
          return (
            <li key={k} className="grid grid-cols-[40px_minmax(0,128px)_minmax(0,1fr)_92px] items-center gap-2.5 text-xs">
              <img src={spriteOf(x.def)} alt="" className="size-10 [image-rendering:pixelated]" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{x.def.set.species}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {x.by && x.move ? `${x.by.set.species} · ${x.move.name}${x.mult !== 1 ? ` ×${x.mult}` : ""}` : "no damaging move"}
                </span>
              </span>
              <span className="relative h-3.5 overflow-hidden rounded bg-secondary" title={verdict(x)}>
                <span className={cn("absolute inset-y-0 left-0", x.min >= OHKO ? "bg-primary" : x.max < WALL ? "bg-muted-foreground/50" : "bg-chart-3")} style={{ width: `${lo}%` }} />
                <span className={cn("absolute inset-y-0 opacity-45", x.min >= OHKO ? "bg-primary" : "bg-chart-3")} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-muted-foreground" />
              </span>
              <span className="text-right font-mono">
                {x.min.toFixed(0)}–{x.max.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-xs text-muted-foreground">
        Real sets at their level, EVs, IVs and nature, with Choice Band and Specs, Life Orb, Expert Belt, Assault Vest, Huge Power, Multiscale and the like. Variable-power and multi-hit moves count as one hit.
      </p>
    </Panel>
  );
}

function ByType({ results }: { results: Result[] }) {
  const [side, setSide] = useState<"def" | "off" | "stats">("def");
  const types = typesIn(results[0].analysis.gen);
  const maxStat = Math.max(...results.flatMap((r) => STATS.map((k) => r.team.reduce((a, m) => a + m.base[k], 0))), 1);
  return (
    <Panel
      title="By type"
      aside={
        <Segmented
          className="ml-auto"
          label="Side"
          value={side}
          onChange={setSide}
          options={[
            { value: "def", label: "Defence" },
            { value: "off", label: "Offence" },
            { value: "stats", label: "Stat totals" },
          ]}
        />
      }
    >
      {side === "stats" ? (
        <div className="flex flex-col gap-2.5">
          {STATS.map((k) => (
            <div key={k} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-2 text-xs">
              <span className="font-semibold text-muted-foreground">{k.toUpperCase()}</span>
              <div className="flex flex-col gap-0.5">
                {results.map((r, i) => {
                  const v = r.team.reduce((a, m) => a + m.base[k], 0);
                  return (
                    <span key={i} className="flex items-center gap-2">
                      <span className={cn("h-2.5 rounded-sm", SERIES[i].bg)} style={{ width: `${(v / maxStat) * 85}%` }} />
                      <span className="font-mono text-[11px]">{v}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-[11px]">
            <thead>
              <tr>
                <th />
                {types.map((t) => (
                  <th key={t} className="p-0.5 font-semibold text-muted-foreground">
                    <span className="inline-flex flex-col items-center gap-0.75">
                      <TypeDot type={t} />
                      {t.slice(0, 3)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <th className={cn("pr-2 text-left text-xs whitespace-nowrap", SERIES[i].text)}>{r.name}</th>
                  {types.map((t) => {
                    if (side === "def") {
                      const d = r.analysis.tDef.find((x) => x.type === t);
                      if (!d) return <td key={t} />;
                      return (
                        <td
                          key={t}
                          title={`Best switch-in: ${r.team[d.best.idx].set.species}, D ${d.best.D.toFixed(2)}`}
                          className={cn("h-10 min-w-7.5 rounded-[5px] text-center font-mono leading-tight", d.best.D < 1 ? "bg-destructive-soft" : "bg-background")}
                        >
                          <span className="text-destructive">{d.weak || "·"}</span>
                          <br />
                          <span className="text-chart-2">{d.resist || "·"}</span>
                        </td>
                      );
                    }
                    const o = r.analysis.tOff.find((x) => x.type === t);
                    if (!o) return <td key={t} />;
                    return (
                      <td
                        key={t}
                        title={o.bestO.move ? `${r.team[o.bestO.idx].set.species}: ${o.bestO.move.name}, O ${o.bestO.O.toFixed(2)}` : "no damaging move"}
                        className={cn("h-10 min-w-7.5 rounded-[5px] text-center font-mono leading-tight", o.se === 0 ? "bg-destructive-soft" : "bg-background")}
                      >
                        <span className="text-chart-2">{o.se}</span>
                        <br />
                        <span className="text-muted-foreground">{o.bestO.move ? o.bestO.O.toFixed(1) : "—"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {side !== "stats" && (
        <span className="text-xs text-muted-foreground">
          {side === "def" ? (
            <>
              <span className="text-destructive">weak</span> over <span className="text-chart-2">resist</span> per type; shaded: best switch-in below 1.00 weighted bulk
            </>
          ) : (
            <>
              members hitting the type <span className="text-chart-2">super-effectively</span> over the best weighted hit; shaded: nothing super-effective
            </>
          )}
        </span>
      )}
    </Panel>
  );
}

export function CompareView({
  slots,
  current,
  pool,
  onSlots,
}: {
  slots: CompareSlot[];
  current: string;
  pool: Pool;
  onSlots: (slots: CompareSlot[]) => void;
}) {
  const [editing, setEditing] = useState(slots);
  const gen = pool.filters.gen;
  const results = useMemo(
    () =>
      slots.map((s, i) => {
        const { team, failed } = buildTeam(gen, parsePaste(s.text));
        return { name: s.name || `Team ${i + 1}`, team, failed, analysis: analyze(team, pool) };
      }),
    [slots, gen, pool],
  );
  const ready = results.length >= MIN_TEAMS && results.every((r) => r.team.length > 0);
  const dirty = JSON.stringify(editing) !== JSON.stringify(slots);
  const failures = results.flatMap((r) => r.failed.map((f) => `${r.name}: ${f}`));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {editing.map((slot, i) => (
          <SlotEditor
            key={i}
            slot={slot}
            index={i}
            current={current}
            canRemove={editing.length > MIN_TEAMS}
            onChange={(s) => setEditing(editing.map((x, j) => (j === i ? s : x)))}
            onRemove={() => setEditing(editing.filter((_, j) => j !== i))}
          />
        ))}
        {editing.length < MAX_TEAMS && (
          <button
            type="button"
            onClick={() => setEditing([...editing, { name: `Team ${String.fromCharCode(65 + editing.length)}`, text: "" }])}
            className="flex min-h-33 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-sm font-semibold text-muted-foreground"
          >
            + Add team
            <span className="text-xs font-normal">paste, sample or the current team</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onSlots(editing)} disabled={!dirty && ready} className={primaryClass}>
          Compare
        </button>
        {failures.length > 0 && <span className="text-[13px] text-destructive">Not found: {failures.join(", ")}.</span>}
        {!ready && <span className="text-[13px] text-muted-foreground">Give at least two teams a Pokémon each, then compare.</span>}
      </div>
      {ready && (
        <>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            {results.map((r, i) => (
              <div key={i} className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border border-t-3 bg-card p-3", SERIES[i].border)}>
                <div className="flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1 truncate font-heading text-base font-semibold", SERIES[i].text)}>{r.name}</span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.75 text-[11px] font-semibold text-chart-3">
                    {r.analysis.archetype[0].name} {Math.round(r.analysis.archetype[0].pct * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {r.team.map((m, k) => (
                    <span key={k} className="grid h-12 place-items-center rounded-lg bg-box" title={m.set.species}>
                      <img src={spriteOf(m)} alt={m.set.species} className="size-11 [image-rendering:pixelated]" />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
            <Scoreboard results={results} pool={pool} />
            <HeadToHead results={results} gen={gen} />
          </div>
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Panel title="Fingerprints">
              <div className="flex justify-center">
                <Radar
                  size={340}
                  label="Archetype fingerprints of the compared teams"
                  series={results.map((r, i) => ({
                    name: `${i}`,
                    features: r.analysis.features,
                    stroke: SERIES[i].stroke,
                    fill: SERIES[i].fill,
                    dashed: i % 2 === 1,
                  }))}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {results.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className={cn("w-4 border-t-2", SERIES[i].border, i % 2 === 1 && "border-dashed")} />
                    {r.name}
                  </span>
                ))}
              </div>
            </Panel>
            <ByType results={results} />
          </div>
        </>
      )}
    </div>
  );
}
