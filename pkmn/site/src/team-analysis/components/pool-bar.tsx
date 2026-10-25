import { GENS, type Gen } from "@/analysis/dex";
import type { Pool, PoolFilters } from "@/analysis/pool";
import { fieldClass, Segmented, Toggle } from "@/components/controls";
import { MAX_BST, MIN_BST } from "../../../shared/pool";

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
    <section aria-label="Pool" className="flex flex-wrap items-center gap-3.5 rounded-2xl border-3 bg-card px-3.5 py-2.5">
      <span className="font-heading text-lg">Pool</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        Data
        <Segmented
          label="Generation"
          options={GENS.map((g) => ({ value: g, label: g, disabled: fixed }))}
          value={filters.gen}
          onChange={(gen: Gen) => set({ gen, speciesGen: Math.min(filters.speciesGen, gen) as Gen })}
        />
      </span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        Species up to
        <Segmented
          label="Species up to"
          options={GENS.map((g) => ({ value: g, label: g, disabled: fixed || g > filters.gen }))}
          value={Math.min(filters.speciesGen, filters.gen) as Gen}
          onChange={(speciesGen: Gen) => set({ speciesGen })}
        />
      </span>
      <Toggle pressed={filters.noLegendary} disabled={fixed} onChange={(noLegendary) => set({ noLegendary })}>
        No legendaries
      </Toggle>
      <Toggle pressed={filters.noMythical} disabled={fixed} onChange={(noMythical) => set({ noMythical })}>
        No mythicals
      </Toggle>
      <Toggle pressed={filters.fullyEvolved} disabled={fixed} onChange={(fullyEvolved) => set({ fullyEvolved })}>
        Fully evolved
      </Toggle>
      <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
        Max BST
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
          aria-label="Max base stat total"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) set({ maxBst: Math.min(MAX_BST, Math.max(MIN_BST, Math.round(v))) });
          }}
          className={`${fieldClass} w-20 tabular-nums`}
        />
      </label>
      {pool && (
        <span className="text-sm text-muted-foreground" title={excluded || undefined}>
          <span className="tabular-nums text-foreground">{pool.size}</span> Pokémon in the pool
        </span>
      )}
    </section>
  );
}
