import { describe, expect, it } from "vitest";
import { parsePaste } from "@/analysis/paste";

describe("parsePaste", () => {
  it("reads a Showdown set", () => {
    const [set] = parsePaste(`Rotom-W (Rotom-Wash) (F) @ Leftovers
Ability: Levitate
Level: 50
Tera Type: Steel
EVs: 252 HP / 212 Def / 44 Spe
Bold Nature
IVs: 0 Atk
- Hydro Pump
- Volt Switch`);
    expect(set).toMatchObject({
      species: "Rotom-Wash",
      nickname: "Rotom-W",
      gender: "F",
      item: "Leftovers",
      ability: "Levitate",
      level: 50,
      teraType: "Steel",
      nature: "Bold",
      moves: ["Hydro Pump", "Volt Switch"],
    });
    expect(set.evs).toEqual({ hp: 252, atk: 0, def: 212, spa: 0, spd: 0, spe: 44 });
    expect(set.ivs).toEqual({ hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 });
  });

  it("defaults to level 100, a neutral nature and 31 IVs", () => {
    const [set] = parsePaste("Pikachu\n- Thunderbolt");
    expect(set).toMatchObject({ species: "Pikachu", level: 100, nature: "Serious", item: "" });
    expect(set.ivs.spe).toBe(31);
  });

  it("splits members on blank lines, skips team headers and keeps six", () => {
    const text = ["=== [gen9] Team ===", ...Array.from({ length: 7 }, (_, i) => `Mon${i}\n- Tackle`)].join("\n\n");
    expect(parsePaste(text).map((s) => s.species)).toEqual(["Mon0", "Mon1", "Mon2", "Mon3", "Mon4", "Mon5"]);
  });
});
