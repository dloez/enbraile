import { describe, expect, it } from "vitest";
import { describePokemon } from "@/open-sheet/dex";
import type { SheetPokemon } from "@/open-sheet/schema";
import type { Member, Slots } from "@/open-sheet/team";
import {
  analysed,
  damagingType,
  defensiveChart,
  offensiveCoverage,
  speedOrder,
} from "@/open-sheet/analysis";

function sheetMon(species: string, types: string[], ability: string, nature = "hardy"): SheetPokemon {
  return {
    species,
    nickname: null,
    gender: "M",
    shiny: false,
    level: 50,
    nature,
    ability,
    abilities: { base: [ability], hidden: [] },
    types,
  };
}

const pokemon = [
  sheetMon("walrein", ["ice", "water"], "thickfat", "hasty"),
  sheetMon("bronzong", ["steel", "psychic"], "levitate"),
  sheetMon("jolteon", ["electric"], "voltabsorb", "timid"),
  sheetMon("shedinja", ["bug", "ghost"], "wonderguard"),
  sheetMon("notamon", ["fire"], "blaze"),
];
const mons = pokemon.map(describePokemon);

function member(index: number, moves: (string | null)[] = [null, null, null, null], ability: string | null = null): Member {
  return { index, species: pokemon[index].species, item: null, ability, moves };
}

function row<T extends { type: string }>(rows: T[], type: string): T {
  const found = rows.find((r) => r.type === type);
  if (!found) throw new Error(type);
  return found;
}

describe("analysed", () => {
  it("keeps empty slots and unknown species out", () => {
    const slots: Slots = [member(0), null, member(4), null, null, null];
    expect(analysed(slots, mons).map((a) => a.slot)).toEqual([0]);
  });
});

describe("speedOrder", () => {
  it("orders members by their Level 50 speed range", () => {
    const team = analysed([member(0), member(1), member(2), null, null, null], mons);
    expect(speedOrder(team).map((s) => [s.mon.species.id, s.low, s.high])).toEqual([
      ["jolteon", 148, 165],
      ["walrein", 77, 93],
      ["bronzong", 38, 53],
    ]);
  });
});

describe("defensiveChart", () => {
  it("counts weak, resist and immune members per type and flags holes", () => {
    const chart = defensiveChart(analysed([member(0), member(1), member(2), member(3), null, null], mons));
    expect(chart).toHaveLength(18);
    expect(row(chart, "Ground")).toMatchObject({ weak: 1, resist: 0, immune: 2, hole: false });
    expect(row(chart, "Fire")).toMatchObject({ weak: 2, resist: 1, immune: 0, hole: true });
    expect(row(chart, "Electric")).toMatchObject({ weak: 1, resist: 0, immune: 2 });
  });

  it("uses a member's picked ability over its current one", () => {
    const team = analysed([member(1, undefined, "heatproof"), null, null, null, null, null], mons);
    expect(row(defensiveChart(team), "Ground")).toMatchObject({ weak: 1, immune: 0, hole: true });
  });
});

describe("damagingType", () => {
  it("keeps attacking moves and drops status and fixed-damage ones", () => {
    expect(damagingType("earthquake")).toBe("Ground");
    expect(damagingType("lowkick")).toBe("Fighting");
    expect(damagingType("toxic")).toBeNull();
    expect(damagingType("seismictoss")).toBeNull();
    expect(damagingType("fissure")).toBeNull();
    expect(damagingType("counter")).toBeNull();
    expect(damagingType("psywave")).toBeNull();
    expect(damagingType("hiddenpower")).toBeNull();
    expect(damagingType("notamove")).toBeNull();
  });
});

describe("offensiveCoverage", () => {
  it("takes picked moves and falls back to STAB", () => {
    const team = analysed(
      [member(0, ["icebeam", "toxic", null, null]), member(2), member(1, ["protect", null, null, null]), null, null, null],
      mons,
    );
    const { sources } = offensiveCoverage(team);
    expect(sources.map((s) => [s.mon.species.id, s.types, s.stab])).toEqual([
      ["walrein", ["Ice"], false],
      ["jolteon", ["Electric"], true],
      ["bronzong", ["Steel", "Psychic"], true],
    ]);
  });

  it("lists Steel as uncovered when nothing hits it super-effectively", () => {
    const team = analysed([member(0, ["icebeam", "surf", null, null]), member(2, ["thunderbolt", null, null, null]), null, null, null, null], mons);
    const { rows } = offensiveCoverage(team);
    expect(row(rows, "Steel").hitters).toEqual([]);
    expect(row(rows, "Flying").hitters).toEqual([0, 1]);
    expect(row(rows, "Ground").hitters).toEqual([0]);
  });
});
