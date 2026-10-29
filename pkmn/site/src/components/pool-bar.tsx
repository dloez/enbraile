import type { Gen } from "../../shared/dex";
import type { Pool, PoolFilters } from "@/analysis/pool";
import { fieldClass, Segmented, Toggle } from "@/components/controls";
import { SelectField } from "@/components/select-field";
import { useMediaQuery } from "@/hooks/use-media-query";
import { messages } from "../../shared/i18n";
import { MAX_BST, MIN_BST, POOL_GENS, type FreePool } from "../../shared/pool";

const t = messages({
  en: {
    gen: (g: number) => `Gen ${g}`,
    pool: "Pool",
    data: "Data",
    generation: "Generation",
    speciesUpTo: "Species up to",
    movesUpTo: "Moves up to",
    noLegendary: "No legendaries",
    noMythical: "No mythicals",
    fullyEvolved: "Fully evolved",
    maxBst: "Max BST",
    maxBstLabel: "Max base stat total",
    inPool: "Pokémon in the pool",
    filter: "Any Pokémon filter",
    pick: "Pick from",
    tms: "TMs",
    anyMove: "Any move",
    tmGen: (g: number) => `Gen ${g} TMs`,
  },
  es: {
    gen: (g: number) => `Gen. ${g}`,
    pool: "Reserva",
    data: "Datos",
    generation: "Generación",
    speciesUpTo: "Especies hasta",
    movesUpTo: "Movimientos hasta",
    noLegendary: "Sin legendarios",
    noMythical: "Sin singulares",
    fullyEvolved: "Totalmente evolucionados",
    maxBst: "BST máx.",
    maxBstLabel: "Total máximo de estadísticas base",
    inPool: "Pokémon en la reserva",
    filter: "Filtro de Cualquier Pokémon",
    pick: "Elegir de",
    tms: "MT",
    anyMove: "Cualquier movimiento",
    tmGen: (g: number) => `MT de la Gen. ${g}`,
  },
});

function GenPick({ label, value, disabled, onChange }: { label: string; value: Gen; disabled: (gen: Gen) => boolean; onChange: (gen: Gen) => void }) {
  const desktop = useMediaQuery("(min-width: 40rem)");
  return desktop ? (
    <Segmented label={label} options={POOL_GENS.map((g) => ({ value: g, label: g, disabled: disabled(g) }))} value={value} onChange={onChange} />
  ) : (
    <SelectField
      label={label}
      size="sm"
      disabled={POOL_GENS.every(disabled)}
      options={POOL_GENS.map((g) => ({ value: String(g), label: t.gen(g), disabled: disabled(g) }))}
      value={String(value)}
      onChange={(v) => onChange(Number(v) as Gen)}
    />
  );
}

type LimitFilters = Pick<FreePool, "noLegendary" | "noMythical" | "fullyEvolved" | "maxBst">;

function Limits({ filters, fixed, set }: { filters: LimitFilters; fixed: boolean; set: (patch: Partial<LimitFilters>) => void }) {
  return (
    <>
      <Toggle pressed={filters.noLegendary} disabled={fixed} onChange={(noLegendary) => set({ noLegendary })}>
        {t.noLegendary}
      </Toggle>
      <Toggle pressed={filters.noMythical} disabled={fixed} onChange={(noMythical) => set({ noMythical })}>
        {t.noMythical}
      </Toggle>
      <Toggle pressed={filters.fullyEvolved} disabled={fixed} onChange={(fullyEvolved) => set({ fullyEvolved })}>
        {t.fullyEvolved}
      </Toggle>
      <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
        {t.maxBst}
        <input
          type="range"
          min={MIN_BST}
          max={MAX_BST}
          step={5}
          disabled={fixed}
          value={filters.maxBst}
          onChange={(e) => set({ maxBst: Number(e.target.value) })}
          className="w-40 accent-primary"
        />
        <input
          type="number"
          min={MIN_BST}
          max={MAX_BST}
          step={5}
          disabled={fixed}
          value={filters.maxBst}
          aria-label={t.maxBstLabel}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) set({ maxBst: Math.min(MAX_BST, Math.max(MIN_BST, Math.round(v))) });
          }}
          className={`${fieldClass} w-20 tabular-nums`}
        />
      </label>
    </>
  );
}

export function FreePoolBar({ filters, onChange }: { filters: FreePool; onChange: (filters: FreePool) => void }) {
  const set = (patch: Partial<FreePool>) => onChange({ ...filters, ...patch });
  const tms = filters.tms;
  const flip = (g: Gen) => {
    const now = tms === "any" ? [] : tms;
    set({ tms: (now.includes(g) ? now.filter((n) => n !== g) : [...now, g]).sort((x, y) => x - y) });
  };
  return (
    <section aria-label={t.filter} className="flex flex-none flex-wrap items-center gap-3 rounded-xl bg-box px-3 py-2.5">
      <span className="font-heading text-lg">{t.pick}</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {t.speciesUpTo}
        <GenPick label={t.speciesUpTo} disabled={() => false} value={filters.speciesGen} onChange={(speciesGen) => set({ speciesGen })} />
      </span>
      <Limits filters={filters} fixed={false} set={set} />
      <span role="group" aria-label={t.tms} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span className="mr-0.5">{t.tms}</span>
        <Toggle pressed={tms === "any"} onChange={() => set({ tms: "any" })}>
          {t.anyMove}
        </Toggle>
        {POOL_GENS.map((g) => (
          <Toggle key={g} pressed={tms !== "any" && tms.includes(g)} title={t.tmGen(g)} onChange={() => flip(g)}>
            <span aria-hidden="true">{g}</span>
            <span className="sr-only">{t.tmGen(g)}</span>
          </Toggle>
        ))}
      </span>
    </section>
  );
}

export function PoolBar({
  filters,
  pool,
  onChange,
}: {
  filters: PoolFilters;
  pool?: Pool;
  onChange?: (filters: PoolFilters) => void;
}) {
  const fixed = !onChange;
  const set = (patch: Partial<PoolFilters>) => onChange?.({ ...filters, ...patch });
  const excluded = pool
    ? Object.entries(pool.excluded)
        .map(([why, n]) => `${n} ${why}`)
        .join(" · ")
    : "";

  return (
    <section aria-label={t.pool} className="flex flex-wrap items-center gap-3.5 rounded-2xl border-3 bg-card px-3.5 py-2.5">
      <span className="font-heading text-lg">{t.pool}</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {t.data}
        <GenPick
          label={t.generation}
          disabled={() => fixed}
          value={filters.gen}
          onChange={(gen) => set({ gen, speciesGen: Math.min(filters.speciesGen, gen) as Gen, movesGen: Math.min(filters.movesGen, gen) as Gen })}
        />
      </span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {t.speciesUpTo}
        <GenPick
          label={t.speciesUpTo}
          disabled={(g) => fixed || g > filters.gen}
          value={Math.min(filters.speciesGen, filters.gen) as Gen}
          onChange={(speciesGen) => set({ speciesGen })}
        />
      </span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {t.movesUpTo}
        <GenPick
          label={t.movesUpTo}
          disabled={(g) => fixed || g > filters.gen}
          value={Math.min(filters.movesGen, filters.gen) as Gen}
          onChange={(movesGen) => set({ movesGen })}
        />
      </span>
      <Limits filters={filters} fixed={fixed} set={set} />
      {pool && (
        <span className="text-sm text-muted-foreground" title={excluded || undefined}>
          <span className="tabular-nums text-foreground">{pool.size}</span> {t.inPool}
        </span>
      )}
    </section>
  );
}
