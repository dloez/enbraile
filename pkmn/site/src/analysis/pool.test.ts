import { describe, expect, it } from "vitest";
import { buildPool, DEFAULT_FILTERS } from "@/analysis/pool";

const names = (pool: ReturnType<typeof buildPool>) => new Set(pool.members.map((m) => m.name));

describe("buildPool", () => {
  it("keeps the generation's fully evolved species", () => {
    const g3 = names(buildPool({ ...DEFAULT_FILTERS, gen: 3 }));
    const g4 = names(buildPool({ ...DEFAULT_FILTERS, gen: 4 }));
    expect(g3.has("Porygon2")).toBe(true);
    expect(g4.has("Porygon2")).toBe(false);
    expect(g4.has("Porygon-Z")).toBe(true);
    expect(g3.has("Ivysaur")).toBe(false);
  });

  it("leaves out battle-only formes, megas and cosmetic copies", () => {
    const g7 = names(buildPool({ ...DEFAULT_FILTERS, gen: 7 }));
    expect(g7.has("Charizard-Mega-X")).toBe(false);
    expect(g7.has("Gastrodon")).toBe(true);
    expect(g7.has("Gastrodon-East")).toBe(false);
    expect(g7.has("Rotom-Wash")).toBe(true);
    expect(g7.has("Raichu-Alola")).toBe(true);
    expect(g7.has("Arceus")).toBe(true);
    expect(g7.has("Arceus-Fire")).toBe(false);
    expect(g7.has("Silvally-Water")).toBe(false);
    expect(g7.has("Giratina-Origin")).toBe(true);
  });

  it("keeps species Gen 9 dropped from its games", () => {
    expect(names(buildPool(DEFAULT_FILTERS)).has("Walrein")).toBe(true);
  });

  it("filters legendaries, mythicals and base stat total", () => {
    const pool = buildPool({ gen: 5, speciesGen: 5, noLegendary: true, noMythical: true, fullyEvolved: true, maxBst: 500 });
    const set = names(pool);
    expect(set.has("Latios")).toBe(false);
    expect(set.has("Mew")).toBe(false);
    expect(set.has("Salamence")).toBe(false);
    expect(set.has("Breloom")).toBe(true);
    expect(pool.excluded.legendary).toBeGreaterThan(0);
    expect(pool.members.every((m) => m.bst <= 500)).toBe(true);
  });

  it("ranks values inside the pool", () => {
    const pool = buildPool({ ...DEFAULT_FILTERS, gen: 5 });
    expect(pool.pct("spe", 0)).toBe(0);
    expect(pool.pct("spe", 1000)).toBe(1);
    expect(pool.ratio("spe", pool.dist.spe.median)).toBe(1);
    expect(pool.physShare.Fighting).toBeGreaterThan(0.5);
    expect(buildPool({ ...DEFAULT_FILTERS, gen: 3 }).physShare).toMatchObject({ Fighting: 1, Fire: 0 });
    expect(Object.keys(pool.physShare)).not.toContain("Fairy");
  });

  it("can hold species to an earlier generation than the data", () => {
    const pool = buildPool({ ...DEFAULT_FILTERS, speciesGen: 5 });
    const set = names(pool);
    expect(set.has("Clefable")).toBe(true);
    expect(set.has("Dragapult")).toBe(false);
    expect(pool.members.find((m) => m.name === "Clefable")?.types).toEqual(["Fairy"]);
  });
});
