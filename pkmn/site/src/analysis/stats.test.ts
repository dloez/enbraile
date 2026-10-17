import { describe as group, expect, it } from "vitest";
import { buildPool, DEFAULT_FILTERS } from "@/analysis/pool";
import { correlations, describe, histogram, typeBreakdown } from "@/analysis/stats";

const pool = buildPool({ ...DEFAULT_FILTERS, gen: 5 });

group("pool statistics", () => {
  it("describes a stat in order", () => {
    const d = describe(pool, "spe");
    expect(d.min).toBeLessThanOrEqual(d.p10);
    expect(d.p10).toBeLessThanOrEqual(d.p25);
    expect(d.p25).toBeLessThanOrEqual(d.median);
    expect(d.median).toBeLessThanOrEqual(d.p75);
    expect(d.p75).toBeLessThanOrEqual(d.p90);
    expect(d.p90).toBeLessThanOrEqual(d.max);
    expect(d.sd).toBeGreaterThan(0);
  });

  it("bins every member once", () => {
    const bins = histogram(pool, "bst", 12);
    expect(bins).toHaveLength(12);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(pool.size);
  });

  it("counts types, most common first, without types the generation lacks", () => {
    const types = typeBreakdown(pool);
    expect(types.map((t) => t.type)).not.toContain("Fairy");
    expect(types[0].count).toBeGreaterThanOrEqual(types[types.length - 1].count);
    expect(types.every((t) => t.mono <= t.count)).toBe(true);
  });

  it("correlates stats symmetrically", () => {
    const r = correlations(pool);
    expect(r[0][0]).toBe(1);
    expect(r[1][3]).toBeCloseTo(r[3][1]);
    expect(Math.abs(r[2][5])).toBeLessThanOrEqual(1);
  });
});
