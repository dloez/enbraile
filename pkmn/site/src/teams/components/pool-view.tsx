import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { typesIn } from "../../../shared/dex";
import type { Member } from "@/analysis/member";
import type { Metric, Pool, PoolMember } from "@/analysis/pool";
import { BASE_STATS, correlations, describe, histogram, typeBreakdown } from "@/analysis/stats";
import { TypeDot } from "@/components/marks";
import { fieldClass, Panel, Segmented, Toggle } from "@/components/controls";
import { SelectField } from "@/components/select-field";
import { useMediaQuery } from "@/hooks/use-media-query";
import { spriteOf, spriteOfName } from "@/analysis/sprite";
import { typeLabel } from "../../../shared/dex-text";
import { locale, messages } from "../../../shared/i18n";

const t = messages({
  en: {
    labels: { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe", bst: "BST", phys: "Phys bulk", spec: "Spec bulk" } as Record<string, string>,
    distribution: "Distribution",
    stat: "Stat",
    median: (n: number) => `median ${n}`,
    pokemon: "Pokémon",
    search: "Search",
    type: "Type",
    allTypes: "All types",
    cellValues: "Cell values",
    baseStats: "Base stats",
    baseStatsTitle: "Base stats",
    percentiles: "Percentiles",
    teamOnly: "Team only",
    types: "Types",
    legendaryMark: "L",
    mythicalMark: "M",
    shadedNote: "shaded: percentile · L legendary · M mythical",
    more: (name: string, n: number) => `${name} and ${n} more`,
    noMatch: "No Pokémon match this pool.",
    pool: "Pool",
    nothingExcluded: "nothing excluded",
    medianBst: "Median BST",
    mean: (n: number) => `mean ${n}`,
    medianSpeed: "Median Speed",
    p75: (n: number) => `P75 base ${n}`,
    fastest: "Fastest",
    highestBst: "Highest BST",
    monoType: "Mono-type",
    count: (n: number) => `${n} Pokémon`,
    columns: ["", "Mean", "SD", "Min", "P10", "P25", "Median", "P75", "P90", "Max"],
    bulkNote: "Physical and special bulk are HP × Def and HP × SpD, the quantities the weighted defence uses.",
    mono: (n: number) => `${n} mono-type`,
    typesNote: "Count and mean BST of the Pokémon carrying each type.",
    correlations: "Correlations",
    correlationsNote: "Pearson r across the pool: green rise together, cyan trade off.",
  },
  es: {
    labels: { hp: "PS", atk: "Atq", def: "Def", spa: "AtE", spd: "DfE", spe: "Vel", bst: "BST", phys: "Aguante fís.", spec: "Aguante esp." },
    distribution: "Distribución",
    stat: "Estadística",
    median: (n: number) => `mediana ${n}`,
    pokemon: "Pokémon",
    search: "Buscar",
    type: "Tipo",
    allTypes: "Todos los tipos",
    cellValues: "Valores de celda",
    baseStats: "Valores base",
    baseStatsTitle: "Estadísticas base",
    percentiles: "Percentiles",
    teamOnly: "Solo el equipo",
    types: "Tipos",
    legendaryMark: "L",
    mythicalMark: "S",
    shadedNote: "sombreado: percentil · L legendario · S singular",
    more: (name: string, n: number) => `${name} y ${n} más`,
    noMatch: "Ningún Pokémon encaja en esta reserva.",
    pool: "Reserva",
    nothingExcluded: "nada excluido",
    medianBst: "BST mediano",
    mean: (n: number) => `media ${n}`,
    medianSpeed: "Velocidad mediana",
    p75: (n: number) => `P75 base ${n}`,
    fastest: "Más rápido",
    highestBst: "Mayor BST",
    monoType: "Monotipo",
    count: (n: number) => `${n} Pokémon`,
    columns: ["", "Media", "DE", "Mín", "P10", "P25", "Mediana", "P75", "P90", "Máx"],
    bulkNote: "El aguante físico y el especial son PS × Def y PS × DfE, las magnitudes que usa la defensa ponderada.",
    mono: (n: number) => `${n} monotipo`,
    typesNote: "Número y BST medio de los Pokémon de cada tipo.",
    correlations: "Correlaciones",
    correlationsNote: "r de Pearson en la reserva: en verde suben juntas, en cian se compensan.",
  },
});

const LABEL = t.labels;

const DESCRIBED: Metric[] = ["hp", "atk", "def", "spa", "spd", "spe", "bst", "phys", "spec"];
const HIST: Metric[] = ["hp", "atk", "def", "spa", "spd", "spe", "bst"];

type SortKey = "name" | (typeof BASE_STATS)[number] | "bst";

const n0 = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString(locale) : v >= 100 ? v.toFixed(0) : v.toFixed(1));

function Tile({ label, value, sub, sprite }: { label: string; value: string; sub: string; sprite?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border-3 bg-card px-3.5 py-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {sprite && <img src={sprite} alt="" className="-my-1.5 size-10 [image-rendering:pixelated]" />}
        <span className="tabular-nums text-2xl font-medium">{value}</span>
      </span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

function Histogram({ pool, team }: { pool: Pool; team: readonly Member[] }) {
  const [k, setK] = useState<Metric>("spe");
  const bins = histogram(pool, k);
  const max = Math.max(...bins.map((b) => b.count), 1);
  const { min, max: top } = pool.dist[k];
  const x = (v: number) => `${(((v - min) / Math.max(1, top - min)) * 100).toFixed(1)}%`;
  const median = pool.quantile(k, 0.5);
  const desktop = useMediaQuery("(min-width: 40rem)");
  const stats = HIST.map((m) => ({ value: m, label: LABEL[m] }));
  return (
    <Panel
      title={t.distribution}
      aside={
        desktop ? (
          <Segmented className="ml-auto" label={t.stat} value={k} onChange={setK} options={stats} />
        ) : (
          <SelectField className="ml-auto" label={t.stat} size="sm" value={k} onChange={(v) => setK(v as Metric)} options={stats} />
        )
      }
    >
      <div className="relative flex h-57.5 items-end gap-0.75 border-b pb-5.5">
        {bins.map((b) => (
          <span
            key={b.from}
            title={`${Math.round(b.from)}–${Math.round(b.to)}: ${b.count}`}
            className="flex-1 rounded-t-sm bg-secondary"
            style={{ height: `${(b.count / max) * 100}%` }}
          />
        ))}
        <span className="absolute top-0 bottom-5.5 border-l-2 border-dashed border-chart-3" style={{ left: x(median) }} />
        <span className="absolute -top-0.5 translate-x-1.5 text-xs text-muted-foreground" style={{ left: x(median) }}>
          {t.median(Math.round(median))}
        </span>
        {team.map((m, i) => {
          const v = k === "bst" ? m.bst : m.base[k as (typeof BASE_STATS)[number]];
          return (
            <img
              key={i}
              src={spriteOf(m)}
              alt={m.set.species}
              title={`${m.set.species} · ${v}`}
              className="absolute size-8 -translate-x-1/2 [image-rendering:pixelated]"
              style={{ left: x(v), bottom: i % 2 ? 150 : 176 }}
            />
          );
        })}
        <span className="absolute bottom-0 left-0 tabular-nums text-xs text-muted-foreground">{Math.round(min)}</span>
        <span className="absolute right-0 bottom-0 tabular-nums text-xs text-muted-foreground">{Math.round(top)}</span>
      </div>
    </Panel>
  );
}

function PoolTable({ pool, team }: { pool: Pool; team: readonly Member[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"value" | "pct">("value");
  const [teamOnly, setTeamOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "bst", desc: true });
  const teamIds = useMemo(() => new Set(team.map((m) => m.id)), [team]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (m: PoolMember, k: SortKey) => (k === "name" ? 0 : k === "bst" ? m.bst : m.st[k]);
    return pool.members
      .filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!type || m.types.includes(type)) && (!teamOnly || teamIds.has(m.id)))
      .sort((a, b) => {
        const d = sort.key === "name" ? a.name.localeCompare(b.name) : value(a, sort.key) - value(b, sort.key);
        return sort.desc ? -d : d;
      });
  }, [pool, query, type, teamOnly, teamIds, sort]);
  const column = (key: SortKey, label: string) => (
    <th key={key} className="border-b px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground first:text-left">
      <button
        type="button"
        onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : key !== "name" })}
        className={cn("cursor-pointer", sort.key === key && "text-primary")}
      >
        {label}
        {sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
  const shade = (k: Metric, v: number) => ({ background: `color-mix(in oklch, var(--chart-2) ${Math.round(pool.pct(k, v) * 45)}%, transparent)` });
  return (
    <Panel title={t.pokemon} aside={<span className="ml-auto tabular-nums text-xs text-muted-foreground">{rows.length}</span>}>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className={cn(fieldClass, "w-56")}>
          <span className="text-muted-foreground">{t.search}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <SelectField
          label={t.type}
          size="sm"
          all={t.allTypes}
          value={type}
          options={typesIn(pool.filters.gen).map((value) => ({ value, label: typeLabel(value) }))}
          onChange={setType}
        />
        <Segmented
          label={t.cellValues}
          value={mode}
          onChange={setMode}
          options={[
            { value: "value", label: t.baseStats },
            { value: "pct", label: t.percentiles },
          ]}
        />
        <Toggle pressed={teamOnly} onChange={setTeamOnly} disabled={team.length === 0}>
          {t.teamOnly}
        </Toggle>
      </div>
      <div className="max-h-120 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-card">
            <tr>
              {column("name", t.pokemon)}
              <th className="border-b px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">{t.types}</th>
              {BASE_STATS.map((k) => column(k, LABEL[k]))}
              {column("bst", LABEL.bst)}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={cn("border-b border-border/50", teamIds.has(m.id) && "bg-accent/60")}>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-2">
                    <img src={spriteOfName(m.name)} alt="" loading="lazy" className="-my-1.5 size-8 [image-rendering:pixelated]" />
                    <span className="font-semibold">{m.name}</span>
                    {m.legendary && <span className="text-xs text-muted-foreground">{t.legendaryMark}</span>}
                    {m.mythical && <span className="text-xs text-muted-foreground">{t.mythicalMark}</span>}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <span className="inline-flex gap-2.5">
                    {m.types.map((type) => (
                      <span key={type} className="inline-flex items-center gap-1.25">
                        <TypeDot type={type} />
                        {typeLabel(type)}
                      </span>
                    ))}
                  </span>
                </td>
                {BASE_STATS.map((k) => (
                  <td key={k} className="px-2 py-1 text-right tabular-nums" style={shade(k, m.st[k])}>
                    {mode === "value" ? m.st[k] : Math.round(pool.pct(k, m.st[k]) * 100)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right tabular-nums" style={shade("bst", m.bst)}>
                  {mode === "value" ? m.bst : Math.round(pool.pct("bst", m.bst) * 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="text-xs text-muted-foreground">{t.shadedNote}</span>
    </Panel>
  );
}

export function PoolView({ pool, team }: { pool: Pool; team: readonly Member[] }) {
  const fastest = pool.members.filter((m) => m.st.spe === pool.dist.spe.max);
  const strongest = pool.members.filter((m) => m.bst === pool.dist.bst.max);
  const mono = pool.members.filter((m) => m.types.length === 1).length;
  const types = typeBreakdown(pool);
  const topCount = Math.max(...types.map((row) => row.count), 1);
  const r = correlations(pool);
  const names = (ms: PoolMember[]) => (ms.length > 2 ? t.more(ms[0].name, ms.length - 1) : ms.map((m) => m.name).join(", "));

  if (pool.size === 0) {
    return <p className="m-0 rounded-2xl border-3 bg-card p-6 text-sm text-muted-foreground">{t.noMatch}</p>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={t.pool} value={String(pool.size)} sub={Object.entries(pool.excluded).map(([w, n]) => `${n} ${w}`).join(" · ") || t.nothingExcluded} />
        <Tile label={t.medianBst} value={String(Math.round(pool.quantile("bst", 0.5)))} sub={t.mean(Math.round(describe(pool, "bst").mean))} />
        <Tile label={t.medianSpeed} value={String(Math.round(pool.quantile("spe", 0.5)))} sub={t.p75(Math.round(pool.quantile("spe", 0.75)))} />
        <Tile label={t.fastest} value={String(pool.dist.spe.max)} sub={names(fastest)} sprite={fastest[0] && spriteOfName(fastest[0].name)} />
        <Tile label={t.highestBst} value={String(pool.dist.bst.max)} sub={names(strongest)} sprite={strongest[0] && spriteOfName(strongest[0].name)} />
        <Tile label={t.monoType} value={`${Math.round((mono / pool.size) * 100)}%`} sub={t.count(mono)} />
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title={t.baseStatsTitle}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {t.columns.map((h) => (
                    <th key={h} className="border-b px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DESCRIBED.map((k) => {
                  const d = describe(pool, k);
                  return (
                    <tr key={k} className="border-b border-border/50">
                      <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{LABEL[k]}</td>
                      {[d.mean, d.sd, d.min, d.p10, d.p25, d.median, d.p75, d.p90, d.max].map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                          {n0(v)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <span className="text-xs text-muted-foreground">{t.bulkNote}</span>
        </Panel>
        <Histogram pool={pool} team={team} />
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title={t.types}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {types.map((row) => (
              <div key={row.type} title={t.mono(row.mono)} className="grid min-h-6.5 grid-cols-[80px_minmax(0,1fr)_28px_40px] items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <TypeDot type={row.type} />
                  {typeLabel(row.type)}
                </span>
                <span className="h-1.5 rounded-sm bg-secondary">
                  <span
                    className="block h-1.5 rounded-sm"
                    style={{ width: `${(row.count / topCount) * 100}%`, background: `var(--type-${row.type.toLowerCase()})` }}
                  />
                </span>
                <span className="text-right tabular-nums">{row.count}</span>
                <span className="text-right tabular-nums text-muted-foreground">{Math.round(row.meanBst)}</span>
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{t.typesNote}</span>
        </Panel>
        <Panel title={t.correlations}>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.75 text-xs">
              <thead>
                <tr>
                  <th />
                  {BASE_STATS.map((k) => (
                    <th key={k} className="px-1.5 text-xs font-semibold text-muted-foreground">
                      {LABEL[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.map((row, i) => (
                  <tr key={i}>
                    <th className="pr-1.5 text-left text-xs text-muted-foreground">{LABEL[BASE_STATS[i]]}</th>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className="h-8.5 w-14.5 rounded-sm text-center tabular-nums"
                        style={{
                          background: `color-mix(in oklch, ${v >= 0 ? "var(--chart-2)" : "var(--primary)"} ${Math.round(Math.abs(v) * 60)}%, transparent)`,
                        }}
                      >
                        {i === j ? "1" : v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-xs text-muted-foreground">{t.correlationsNote}</span>
        </Panel>
      </div>
      <PoolTable pool={pool} team={team} />
    </div>
  );
}
