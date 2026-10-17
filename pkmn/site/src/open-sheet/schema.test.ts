import { describe, expect, it } from "vitest";
import { checkSheet, readSheet, tabName } from "@/open-sheet/schema";

const sheet = {
  pokemon: [
    {
      species: "walrein",
      nickname: null,
      gender: "M",
      shiny: false,
      level: 42,
      nature: "modest",
      ability: "thickfat",
      abilities: { base: ["thickfat", "icebody"], hidden: ["oblivious"] },
      types: ["ice", "water"],
    },
  ],
  items: [{ item: "leftovers", quantity: 2 }],
  tms: [{ item: "tm13", move: "icebeam" }],
};

function without(key: string): unknown {
  return Object.fromEntries(Object.entries(sheet).filter(([k]) => k !== key));
}

describe("checkSheet", () => {
  it("accepts an export", () => {
    expect(checkSheet(sheet)).toEqual({ ok: true, sheet });
  });

  it("accepts the nulls the export may write", () => {
    const [mon] = sheet.pokemon;
    const nulls = { ...mon, gender: null, level: null, nature: null, ability: null, abilities: null };
    expect(checkSheet({ ...sheet, pokemon: [nulls] }).ok).toBe(true);
  });

  it("accepts the learnable moves of an export made with --moves", () => {
    const moves = { current: ["brine"], relearner: ["brine"], tms: ["icebeam"], unchecked: ["protect"] };
    const result = checkSheet({ ...sheet, pokemon: [{ ...sheet.pokemon[0], moves }] });
    expect(result.ok && result.sheet.pokemon[0].moves).toEqual(moves);
  });

  it("names a missing top-level list", () => {
    expect(checkSheet(without("pokemon"))).toEqual({ ok: false, reason: "has no `pokemon` list" });
    expect(checkSheet(without("tms"))).toEqual({ ok: false, reason: "has no `tms` list" });
  });

  it("names a missing field by its path", () => {
    const { species: _, ...mon } = sheet.pokemon[0];
    expect(checkSheet({ ...sheet, pokemon: [mon] })).toEqual({ ok: false, reason: "has no `pokemon[0].species`" });
  });

  it("names a field of the wrong type", () => {
    const items = [{ item: "leftovers", quantity: "2" }];
    expect(checkSheet({ ...sheet, items })).toEqual({ ok: false, reason: "has `items[0].quantity` that is not a number" });
  });

  it("refuses an invalid value", () => {
    const pokemon = [{ ...sheet.pokemon[0], gender: "X" }];
    expect(checkSheet({ ...sheet, pokemon })).toEqual({ ok: false, reason: "has an invalid `pokemon[0].gender`" });
  });

  it("refuses something that is not an object", () => {
    expect(checkSheet([])).toEqual({ ok: false, reason: "is not an export" });
  });
});

describe("readSheet", () => {
  it("refuses text that is not JSON", () => {
    expect(readSheet("{")).toEqual({ ok: false, reason: "is not JSON" });
  });

  it("reads an export", () => {
    expect(readSheet(JSON.stringify(sheet)).ok).toBe(true);
  });
});

describe("tabName", () => {
  it("drops the export's suffix", () => {
    expect(tabName("MIRAMEEE-open-sheet.json")).toBe("MIRAMEEE");
  });

  it("drops only the extension from another name", () => {
    expect(tabName("rival.json")).toBe("rival");
  });

  it("keeps a name with nothing left", () => {
    expect(tabName(".json")).toBe(".json");
  });
});
