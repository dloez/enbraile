import { describe, expect, it } from "vitest";
import type { Gen } from "@/analysis/dex";
import { buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool, DEFAULT_FILTERS } from "@/analysis/pool";
import { SAMPLES } from "@/analysis/samples";
import { analyze, classify, FEATURES } from "@/analysis/team";

function sample(name: string, gen: Gen) {
  const { team, failed } = buildTeam(gen, parsePaste(SAMPLES[name]));
  expect(failed).toEqual([]);
  return analyze(team, buildPool({ ...DEFAULT_FILTERS, gen }));
}

describe("analyze", () => {
  it.each([
    ["Gen 5 Balance (BW)", 9, "Balance"],
    ["Gen 5 Balance (BW)", 5, "Balance"],
    ["Hyper Offense", 9, "Hyper Offense"],
    ["Balance", 9, "Balance"],
    ["Stall", 9, "Stall"],
  ] as const)("classifies the %s sample in Gen %i as PokeGraph does", (name, gen, archetype) => {
    expect(sample(name, gen).archetype[0].name).toBe(archetype);
  });

  it("gives PokeGraph's roles", () => {
    expect(sample("Gen 5 Balance (BW)", 5).members.map((m) => [m.member.species, m.roles.join("/")])).toEqual([
      ["Ferrothorn", "Hazard setter/Wall"],
      ["Jellicent", "Wall"],
      ["Excadrill", "Hazard removal/Wallbreaker/Revenge killer"],
      ["Latios", "Wallbreaker/Fast attacker"],
      ["Volcarona", "Setup sweeper"],
      ["Conkeldurr", "Wallbreaker/Priority"],
    ]);
  });

  it("writes PokeGraph's checklist", () => {
    const texts = sample("Gen 5 Balance (BW)", 5).checks.map((c) => `${c.level} ${c.text}`);
    expect(texts).toEqual(
      expect.arrayContaining([
        "good Hazards: Ferrothorn",
        "good Hazard removal: Excadrill",
        "good Speed control / priority: Excadrill, Conkeldurr",
        "good Reliable recovery on 3/6: Ferrothorn, Jellicent, Volcarona.",
        "good Attack split: 10 physical / 6 special moves.",
      ]),
    );
    const stall = sample("Stall", 9).checks.map((c) => `${c.level} ${c.text}`);
    expect(stall).toEqual(
      expect.arrayContaining([
        "info No Choice Scarf, priority or speed control (normal for stall, which out-lasts rather than out-speeds).",
        "good Reliable recovery on 6/6: Blissey, Toxapex, Corviknight, Clodsire, Dondozo, Gholdengo.",
        "bad 3 members are weak to Electric (resisted by 1).",
        "bad 3 members are weak to Ground (resisted by 1).",
        "warn Weaknesses with no resist on the team: Dark.",
      ]),
    );
  });

  it("links members that cover each other's weaknesses", () => {
    const a = sample("Gen 5 Balance (BW)", 5);
    const ferro = a.members.findIndex((m) => m.member.species === "Ferrothorn");
    const jelli = a.members.findIndex((m) => m.member.species === "Jellicent");
    const edge = a.edges.find((e) => e.from === ferro && e.to === jelli);
    expect(edge?.types).toContain("Fire");
    expect(edge?.mutual).toBe(true);
  });

  it("counts Tera typing only when asked and only in Gen 9", () => {
    const { team } = buildTeam(9, parsePaste("Dragonite\nTera Type: Normal\n- Extreme Speed"));
    const pool = buildPool(DEFAULT_FILTERS);
    expect(analyze(team, pool).members[0].def.Ice).toBe(4);
    expect(analyze(team, pool, { useTera: true }).members[0].def.Ghost).toBe(0);
  });
});

describe("classify", () => {
  it("is closest to the prototype it is given", () => {
    const proto = Object.fromEntries(FEATURES.map((f) => [f.key, 0.15])) as Parameters<typeof classify>[0];
    expect(classify({ ...proto, bulk: 0.88, recovery: 0.9, status: 0.55, setup: 0.1, offItems: 0 })[0].name).toBe("Stall");
  });
});
