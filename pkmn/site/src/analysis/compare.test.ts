import { describe, expect, it } from "vitest";
import { metricsFor, pressure, SCORE_ROWS, verdict, winCounts, winners } from "@/analysis/compare";
import { buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";
import { buildPool, DEFAULT_FILTERS } from "@/analysis/pool";
import { SAMPLES } from "@/analysis/samples";
import { analyze } from "@/analysis/team";

const pool = buildPool(DEFAULT_FILTERS);

function load(name: string) {
  const { team } = buildTeam(9, parsePaste(SAMPLES[name]));
  return { team, analysis: analyze(team, pool) };
}

const ho = load("Hyper Offense");
const stall = load("Stall");

describe("metricsFor", () => {
  it("gives PokeGraph's pool-independent metrics", () => {
    expect(metricsFor(ho.team, ho.analysis, pool)).toMatchObject({
      size: 6,
      archetype: "Hyper Offense (97%)",
      bst: 3425,
      sum_hp: 530,
      sum_spe: 623,
      weakTotal: 26,
      resistTotal: 45,
      immuneTotal: 6,
      stacked: 3,
      unresisted: 1,
      seCovered: 18,
      uncovered: 0,
      synEdges: 28,
      mutual: 13,
      hazards: 1,
      removal: 1,
      recovery: 0,
      pivots: 1,
      priority: 1,
      maxSpe: 421,
    });
    expect(metricsFor(stall.team, stall.analysis, pool)).toMatchObject({
      bst: 3040,
      weakTotal: 15,
      resistTotal: 42,
      immuneTotal: 8,
      stacked: 2,
      synEdges: 20,
      mutual: 8,
      recovery: 6,
      pivots: 2,
      priority: 0,
      maxSpe: 204,
    });
  });
});

describe("pressure", () => {
  const row = (p: ReturnType<typeof pressure>) =>
    p.per.map((x) => `${x.def.species}:${x.by?.species}:${x.move?.name}:${x.min.toFixed(1)}-${x.max.toFixed(1)}`);

  it("matches PokeGraph's damage calc", () => {
    const p = pressure(9, ho.team, stall.team);
    expect(row(p)).toEqual([
      "Blissey:Iron Valiant:Focus Blast:52.4-61.7",
      "Toxapex:Dragapult:Draco Meteor:64.1-76.0",
      "Corviknight:Iron Moth:Fiery Dance:72.0-84.8",
      "Clodsire:Roaring Moon:Earthquake:74.1-87.5",
      "Dondozo:Dragapult:Draco Meteor:74.4-87.8",
      "Gholdengo:Roaring Moon:Knock Off:92.9-109.5",
    ]);
    expect([p.mean.toFixed(2), p.ohko, p.twohko, p.walls]).toEqual(["77.91", 0, 6, 0]);
  });

  it("matches it the other way round, with Body Press and immunities", () => {
    const p = pressure(9, stall.team, ho.team);
    expect(row(p)).toEqual([
      "Glimmora:Gholdengo:Make It Rain:128.0-151.5",
      "Iron Moth:Clodsire:Earthquake:171.4-203.3",
      "Kingambit:Corviknight:Body Press:77.4-91.5",
      "Dragapult:Gholdengo:Shadow Ball:88.0-104.1",
      "Roaring Moon:Corviknight:Body Press:58.1-68.9",
      "Iron Valiant:Gholdengo:Make It Rain:172.3-203.5",
    ]);
    expect([p.mean.toFixed(2), p.ohko, p.twohko, p.walls]).toEqual(["90.67", 3, 3, 0]);
  });

  it("names the outcome", () => {
    expect(verdict({ min: 100, max: 120, mult: 1 })).toBe("OHKO");
    expect(verdict({ min: 90, max: 105, mult: 1 })).toBe("possible OHKO");
    expect(verdict({ min: 55, max: 65, mult: 1 })).toBe("2HKO");
    expect(verdict({ min: 20, max: 30, mult: 1 })).toBe("walls it");
  });
});

describe("scoreboard", () => {
  it("stars the best team per metric, none on a tie", () => {
    const ms = [metricsFor(ho.team, ho.analysis, pool), metricsFor(stall.team, stall.analysis, pool)];
    const byKey = (k: string) => {
      const r = SCORE_ROWS.find((x) => "k" in x && x.k === k);
      if (!r) throw new Error(k);
      return winners(r, ms);
    };
    expect(byKey("bst")).toEqual([true, false]);
    expect(byKey("weakTotal")).toEqual([false, true]);
    expect(byKey("uncovered")).toEqual([false, false]);
    expect(byKey("hazards")).toEqual([false, false]);
    const wins = winCounts(ms);
    expect(wins[0] + wins[1]).toBeGreaterThan(0);
  });
});
