import { describe, expect, it } from "vitest";
import { damageTaken, moveVsMon, moveVsType } from "@/analysis/chart";

describe("damageTaken", () => {
  it("uses Showdown's type chart", () => {
    expect(damageTaken(9, "Electric", ["Ice", "Water"], null)).toBe(2);
    expect(damageTaken(9, "Fighting", ["Ice", "Water"], null)).toBe(2);
    expect(damageTaken(9, "Ground", ["Flying"], null)).toBe(0);
    expect(damageTaken(9, "Fire", ["Steel", "Psychic"], null)).toBe(2);
  });

  it("counts abilities that change matchups", () => {
    expect(damageTaken(9, "Ground", ["Steel", "Psychic"], "levitate")).toBe(0);
    expect(damageTaken(9, "Electric", ["Electric"], "voltabsorb")).toBe(0);
    expect(damageTaken(9, "Fire", ["Ice", "Water"], "thickfat")).toBe(0.5);
    expect(damageTaken(9, "Ice", ["Ice", "Water"], "thickfat")).toBe(0.125);
    expect(damageTaken(9, "Fire", ["Grass"], "dryskin")).toBe(2.5);
    expect(damageTaken(9, "Water", ["Grass"], "dryskin")).toBe(0);
  });

  it("lets only super-effective hits through Wonder Guard", () => {
    expect(damageTaken(9, "Fire", ["Bug", "Ghost"], "wonderguard")).toBe(2);
    expect(damageTaken(9, "Water", ["Bug", "Ghost"], "wonderguard")).toBe(0);
  });
});

describe("generations", () => {
  it("uses each generation's type chart", () => {
    expect(damageTaken(5, "Ghost", ["Steel"], null)).toBe(0.5);
    expect(damageTaken(6, "Ghost", ["Steel"], null)).toBe(1);
    expect(damageTaken(1, "Ghost", ["Psychic"], null)).toBe(0);
    expect(damageTaken(1, "Bug", ["Poison"], null)).toBe(2);
  });

  it("ignores abilities before Gen 3 and those a generation does not have", () => {
    expect(damageTaken(2, "Ground", ["Electric"], "levitate")).toBe(2);
    expect(damageTaken(5, "Fire", ["Normal"], "fluffy")).toBe(1);
    expect(damageTaken(7, "Fire", ["Normal"], "fluffy")).toBe(2);
  });
});

describe("moves", () => {
  it("handles moves with their own matchups", () => {
    expect(moveVsType(9, { id: "freezedry", type: "Ice" }, "Water", null)).toBe(2);
    expect(moveVsType(9, { id: "flyingpress", type: "Fighting" }, "Grass", null)).toBe(2);
    expect(moveVsType(9, { id: "tackle", type: "Normal" }, "Ghost", "scrappy")).toBe(1);
    expect(moveVsType(9, { id: "thousandarrows", type: "Ground" }, "Flying", null)).toBe(1);
  });

  it("applies the defender's ability", () => {
    expect(moveVsMon(9, { id: "earthquake", type: "Ground" }, null, ["Steel", "Psychic"], "levitate")).toBe(0);
    expect(moveVsMon(9, { id: "surf", type: "Water" }, null, ["Bug", "Ghost"], "wonderguard")).toBe(0);
  });
});
