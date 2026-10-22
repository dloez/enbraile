import { GENS, type Gen } from "@/analysis/dex";
import type { Pool, PoolFilters } from "@/analysis/pool";
import { fieldClass, Segmented, Toggle } from "@/components/controls";

export function PoolBar({
  filters,
  pool,
  onChange,
}: {
  filters: PoolFilters;
  pool: Pool;
  onChange: (filters: PoolFilters) => void;
}) {
  const set = (patch: Partial<PoolFilters>) => onChange({ ...filters, ...patch });
  const excluded = Object.entries(pool.excluded)
    .map(([why, n]) => `${n} ${why}`)
    .join(" · ");

  return (
    <section aria-label="Pool" className="flex flex-wrap items-center gap-3.5 rounded-2xl border-3 bg-card px-3.5 py-2.5">
      <span className="font-heading text-lg">Pool</span>
      <Segmented
        label="Generation"
        options={GENS.map((g) => ({ value: g, label: g }))}
        value={filters.gen}
        onChange={(gen: Gen) => set({ gen, speciesGen: gen })}
      />
      <Toggle pressed={filters.noLegendary} onChange={(noLegendary) => set({ noLegendary })}>
        No legendaries
      </Toggle>
      <Toggle pressed={filters.noMythical} onChange={(noMythical) => set({ noMythical })}>
        No mythicals
      </Toggle>
      <Toggle pressed={filters.fullyEvolved} onChange={(fullyEvolved) => set({ fullyEvolved })}>
        Fully evolved
      </Toggle>
      <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
        Max BST
        <input
          type="range"
          min={150}
          max={800}
          step={5}
          value={filters.maxBst}
          onChange={(e) => set({ maxBst: Number(e.target.value) })}
          className="w-40 accent-primary"
        />
        <input
          type="number"
          min={150}
          max={800}
          step={5}
          value={filters.maxBst}
          aria-label="Max base stat total"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) set({ maxBst: Math.min(800, Math.max(150, v)) });
          }}
          className={`${fieldClass} w-20 tabular-nums`}
        />
      </label>
      <span className="text-sm text-muted-foreground" title={excluded || undefined}>
        <span className="tabular-nums text-foreground">{pool.size}</span> Pokémon in the pool
      </span>
    </section>
  );
}
