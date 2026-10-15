import { Dex } from "@pkmn/dex";
import { describe, expect, it } from "vitest";
import { describeItem, describePokemon, describeTm, statAt } from "@/open-sheet/dex";
import type { SheetPokemon } from "@/open-sheet/schema";

const walrein: SheetPokemon = {
  species: "walrein",
  nickname: null,
  gender: "M",
  shiny: false,
  level: 59,
  nature: "hasty",
  ability: "bigpecks",
  abilities: { base: ["bigpecks", "gluttony"], hidden: ["drizzle"] },
  types: ["ice", "water"],
};

describe("describePokemon", () => {
  it("takes base stats, types and sprite from Showdown", () => {
    const mon = describePokemon(walrein, 0);
    expect(mon.species).toEqual({ id: "walrein", name: "Walrein", known: true, marked: false });
    expect(mon.stats?.map((s) => s.base)).toEqual([110, 80, 90, 95, 90, 65]);
    expect(mon.showdownTypes).toEqual(["Ice", "Water"]);
    expect(mon.mismatch).toBe(false);
    expect(mon.sprite).toBe("https://play.pokemonshowdown.com/sprites/gen5/walrein.png");
  });

  it("lists the export's abilities with descriptions and marks the current one", () => {
    const abilities = describePokemon(walrein, 0).abilities;
    expect(abilities.map((a) => [a.name, a.current, a.hidden])).toEqual([
      ["Big Pecks", true, false],
      ["Gluttony", false, false],
      ["Drizzle", false, true],
    ]);
    expect(abilities.every((a) => a.desc !== "")).toBe(true);
  });

  it("flags types that differ from Showdown's", () => {
    const mon = describePokemon({ ...walrein, types: ["ice"] }, 0);
    expect(mon.mismatch).toBe(true);
    expect(mon.filterTypes).toEqual(["Ice", "Water"]);
  });

  it("marks an unknown species and keeps its export types", () => {
    const mon = describePokemon({ ...walrein, species: "notamon", types: ["fire"] }, 0);
    expect(mon.species).toEqual({ id: "notamon", name: "notamon", known: false, marked: true });
    expect(mon.stats).toBeNull();
    expect(mon.sprite).toBeNull();
    expect(mon.mismatch).toBe(false);
    expect(mon.filterTypes).toEqual(["Fire"]);
  });

  it("keeps a current ability missing from the list", () => {
    const mon = describePokemon({ ...walrein, ability: "thickfat", abilities: null }, 0);
    expect(mon.abilities.map((a) => [a.id, a.current])).toEqual([["thickfat", true]]);
  });
});

describe("statAt", () => {
  it("gives Walrein's Level 50 range with a Hasty nature", () => {
    const nature = describePokemon(walrein, 0).nature;
    const species = Dex.forGen(9).species.get("walrein");
    expect([statAt("hp", species, 0, nature), statAt("hp", species, 31, nature)]).toEqual([170, 185]);
    expect([statAt("def", species, 0, nature), statAt("def", species, 31, nature)]).toEqual([85, 99]);
    expect([statAt("spe", species, 0, nature), statAt("spe", species, 31, nature)]).toEqual([77, 93]);
  });

  it("gives Shedinja its fixed 1 HP at any IV", () => {
    const species = Dex.forGen(9).species.get("shedinja");
    expect([statAt("hp", species, 0, null), statAt("hp", species, 31, null)]).toEqual([1, 1]);
    expect([statAt("atk", species, 0, null), statAt("atk", species, 31, null)]).toEqual([95, 110]);
  });
});

describe("describeItem", () => {
  it("sorts berries into their pocket", () => {
    expect(describeItem({ item: "sitrusberry", quantity: 1 }).pocket).toBe("berries");
    expect(describeItem({ item: "leftovers", quantity: 2 })).toMatchObject({ name: "Leftovers", pocket: "items", quantity: 2 });
  });

  it("labels tinymushroom without marking it", () => {
    expect(describeItem({ item: "tinymushroom", quantity: 7 })).toMatchObject({
      name: "Mini Seta (Tiny Mushroom)",
      known: false,
      marked: false,
      pocket: "items",
      icon: null,
    });
  });

  it("marks an unknown item by its raw ID", () => {
    expect(describeItem({ item: "madeupitem", quantity: 1 })).toMatchObject({ name: "madeupitem", marked: true });
  });
});

describe("describeTm", () => {
  it("gives the move's type, category, power, accuracy and description", () => {
    expect(describeTm({ item: "tm13", move: "icebeam" })).toEqual({
      label: "TM13",
      move: { id: "icebeam", name: "Ice Beam", known: true, marked: false },
      type: "Ice",
      category: "Special",
      power: 90,
      accuracy: 100,
      desc: "10% chance to freeze the target.",
    });
  });

  it("marks an unknown move", () => {
    expect(describeTm({ item: "tm99", move: "notamove" }).move).toMatchObject({ name: "notamove", marked: true });
  });
});
