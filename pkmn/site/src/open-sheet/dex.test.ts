import { Dex } from "@pkmn/dex";
import { describe, expect, it } from "vitest";
import { canLearn, describeItem, describeMove, describePokemon, describeTm, moveStats, MOVES, statAt, tmLabels } from "@/open-sheet/dex";
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

describe("canLearn", () => {
  const moves = { relearner: ["brine"], tms: ["icebeam"], unchecked: ["protect"] };

  it("answers from the export's learnable moves", () => {
    const mon = describePokemon({ ...walrein, moves }, 0);
    expect(mon.learnable?.relearner.map((m) => [m.name, m.type, m.category, m.power])).toEqual([
      ["Brine", "Water", "Special", 65],
    ]);
    expect(canLearn(mon, "brine")).toBe("yes");
    expect(canLearn(mon, "icebeam")).toBe("yes");
    expect(canLearn(mon, "protect")).toBe("unchecked");
    expect(canLearn(mon, "surf")).toBe("no");
  });

  it("knows nothing when the export has no moves", () => {
    const mon = describePokemon(walrein, 0);
    expect(mon.learnable).toBeNull();
    expect(canLearn(mon, "surf")).toBeNull();
  });
});

describe("describeMove", () => {
  it("carries the description and the stats line", () => {
    const brine = describeMove("brine");
    expect(brine.desc).toBe("Power doubles if the target's HP is 50% or less.");
    expect(moveStats(brine)).toBe("Special · 65 · 100%");
    expect(moveStats(describeMove("protect"))).toBe("Status");
  });
});

describe("tmLabels", () => {
  it("maps each TM's move to its label", () => {
    expect(tmLabels([{ item: "tm78", move: "protect" }]).get("protect")).toBe("TM78");
  });
});

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

describe("MOVES", () => {
  it("lists every Gen 1–5 move once, Hidden Power without its typed copies", () => {
    expect(MOVES).toHaveLength(558);
    expect(new Set(MOVES.map((m) => m.id)).size).toBe(MOVES.length);
    expect(MOVES.find((m) => m.id === "hiddenpower")?.name).toBe("Hidden Power");
    expect(MOVES.some((m) => m.id === "fusionbolt")).toBe(true);
    expect(MOVES.some((m) => m.id === "fairywind")).toBe(false);
    expect(MOVES.some((m) => m.id === "struggle")).toBe(false);
  });

  it("describes an unknown move by its raw id", () => {
    expect(describeMove("madeup")).toEqual({
      id: "madeup",
      name: "madeup",
      known: false,
      marked: true,
      type: null,
      category: null,
      power: null,
      accuracy: null,
      desc: "",
    });
    expect(describeMove("icebeam").type).toBe("Ice");
  });
});
