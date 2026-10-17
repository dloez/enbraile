import { describe, expect, it } from "vitest";
import { describePokemon } from "@/open-sheet/dex";
import type { Sheet, SheetPokemon } from "@/open-sheet/schema";
import { LEAGUE_EVS as EVS, readShowdownTeam, showdownMember, showdownTeam } from "@/open-sheet/showdown";
import type { Member, Slots } from "@/open-sheet/team";

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

const member = (index: number, species: string, extra: Partial<Member> = {}): Member => ({
  index,
  species,
  item: null,
  ability: null,
  moves: [null, null, null, null],
  ...extra,
});

describe("showdownMember", () => {
  it("writes a bare member with its current ability, level 50 and nature", () => {
    expect(showdownMember(member(0, "walrein"), describePokemon(walrein, 0))).toBe(
      ["Walrein (M)", "Ability: Big Pecks", "Level: 50", EVS, "Hasty Nature"].join("\n"),
    );
  });

  it("writes nickname, gender, item, picked ability, shiny and moves", () => {
    const mon = describePokemon({ ...walrein, nickname: "DUMBO", gender: "F", shiny: true }, 0);
    const m = member(0, "walrein", { item: "leftovers", ability: "drizzle", moves: ["surf", null, "icebeam", null] });
    expect(showdownMember(m, mon)).toBe(
      [
        "DUMBO (Walrein) (F) @ Leftovers",
        "Ability: Drizzle",
        "Level: 50",
        "Shiny: Yes",
        EVS,
        "Hasty Nature",
        "- Surf",
        "- Ice Beam",
      ].join("\n"),
    );
  });

  it("leaves out a genderless mark, a missing nature and a missing ability", () => {
    const mon = describePokemon({ ...walrein, gender: "N", nature: null, ability: null, abilities: null }, 0);
    expect(showdownMember(member(0, "walrein"), mon)).toBe(["Walrein", "Level: 50", EVS].join("\n"));
  });

  it("writes the league's EVs and no IVs", () => {
    const text = showdownMember(member(0, "walrein"), describePokemon(walrein, 0));
    expect(text).toContain(EVS);
    expect(text).not.toMatch(/IVs/);
  });
});

describe("readShowdownTeam", () => {
  const sheet: Sheet = {
    pokemon: [walrein, { ...walrein, nickname: "DUMBO" }],
    items: [
      { item: "leftovers", quantity: 1 },
      { item: "tinymushroom", quantity: 2 },
    ],
    tms: [],
  };
  const mons = sheet.pokemon.map(describePokemon);

  it("round-trips a copied team", () => {
    const slots: Slots = [
      member(1, "walrein", { item: "leftovers", ability: "drizzle", moves: ["surf", "icebeam", null, null] }),
      member(0, "walrein"),
      null,
      null,
      null,
      null,
    ];
    const read = readShowdownTeam(showdownTeam(slots, mons), sheet, mons);
    expect(read.left).toEqual([]);
    expect(read.added).toBe(2);
    expect(read.slots).toEqual(slots);
  });

  it("reads the first of a move's alternatives and a typed Hidden Power", () => {
    const read = readShowdownTeam("Walrein\n- Ice Beam / Blizzard\n- Hidden Power [Fire]", sheet, mons);
    expect(read.slots[0]?.moves).toEqual(["icebeam", "hiddenpower", null, null]);
  });

  it("prefers the Pokémon whose nickname matches", () => {
    const read = readShowdownTeam("DUMBO (Walrein)", sheet, mons);
    expect(read.slots[0]?.index).toBe(1);
  });

  it("leaves out what the sheet cannot back, and says why", () => {
    const text = [
      "Walrein @ Leftovers\nAbility: Swift Swim\n- Surf\n- Notamove\n- Hidden Power [Ice]",
      "Walrein @ Leftovers\nAbility: Big Pecks",
      "Walrein",
      "Snorlax",
    ].join("\n\n");
    const read = readShowdownTeam(text, sheet, mons);
    expect(read.added).toBe(2);
    expect(read.slots[0]).toEqual(member(0, "walrein", { item: "leftovers", moves: ["surf", "hiddenpower", null, null] }));
    expect(read.slots[1]).toEqual(member(1, "walrein"));
    expect(read.left).toEqual([
      "Walrein's Swift Swim: not one of its abilities",
      "Walrein's Notamove: not a move Showdown knows",
      "DUMBO's Leftovers: none left in the bag",
      "Walrein: every one in this sheet is already on the team",
      "Snorlax: not in this sheet",
    ]);
  });
});

describe("showdownTeam", () => {
  it("separates members with a blank line and skips empty, stale and unknown slots", () => {
    const mons = [
      describePokemon(walrein, 0),
      describePokemon({ ...walrein, species: "notamon" }, 1),
      describePokemon({ ...walrein, species: "pelipper", ability: "keeneye", abilities: null }, 2),
    ];
    const slots: Slots = [member(0, "walrein"), null, member(1, "notamon"), member(0, "snorlax"), member(2, "pelipper"), null];
    expect(showdownTeam(slots, mons)).toBe(
      [
        ["Walrein (M)", "Ability: Big Pecks", "Level: 50", EVS, "Hasty Nature"].join("\n"),
        ["Pelipper (M)", "Ability: Keen Eye", "Level: 50", EVS, "Hasty Nature"].join("\n"),
      ].join("\n\n"),
    );
  });
});
