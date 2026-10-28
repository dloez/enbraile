import type { Gen } from "../../shared/dex";
import type { Pool, PoolFilters } from "@/analysis/pool";
import { fieldClass, Segmented, Toggle } from "@/components/controls";
import { SelectField } from "@/components/select-field";
import { useMediaQuery } from "@/hooks/use-media-query";
import { messages } from "../../shared/i18n";
import { MAX_BST, MIN_BST, POOL_GENS } from "../../shared/pool";

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
      {pool && (
        <span className="text-sm text-muted-foreground" title={excluded || undefined}>
          <span className="tabular-nums text-foreground">{pool.size}</span> {t.inPool}
        </span>
      )}
    </section>
  );
}
