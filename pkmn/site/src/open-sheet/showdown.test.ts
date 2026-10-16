import { describe, expect, it } from "vitest";
import { describePokemon } from "@/open-sheet/dex";
import type { SheetPokemon } from "@/open-sheet/schema";
import { showdownMember, showdownTeam } from "@/open-sheet/showdown";
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
      ["Walrein (M)", "Ability: Big Pecks", "Level: 50", "Hasty Nature"].join("\n"),
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
        "Hasty Nature",
        "- Surf",
        "- Ice Beam",
      ].join("\n"),
    );
  });

  it("leaves out a genderless mark, a missing nature and a missing ability", () => {
    const mon = describePokemon({ ...walrein, gender: "N", nature: null, ability: null, abilities: null }, 0);
    expect(showdownMember(member(0, "walrein"), mon)).toBe(["Walrein", "Level: 50"].join("\n"));
  });

  it("writes no IVs or EVs", () => {
    const text = showdownMember(member(0, "walrein"), describePokemon(walrein, 0));
    expect(text).not.toMatch(/IVs|EVs/);
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
        ["Walrein (M)", "Ability: Big Pecks", "Level: 50", "Hasty Nature"].join("\n"),
        ["Pelipper (M)", "Ability: Keen Eye", "Level: 50", "Hasty Nature"].join("\n"),
      ].join("\n\n"),
    );
  });
});
