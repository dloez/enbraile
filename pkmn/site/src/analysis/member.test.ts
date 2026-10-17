import { describe, expect, it } from "vitest";
import { buildMember, buildTeam } from "@/analysis/member";
import { parsePaste } from "@/analysis/paste";

function one(gen: Parameters<typeof buildMember>[0], text: string) {
  const member = buildMember(gen, parsePaste(text)[0]);
  if (!member) throw new Error(text);
  return member;
}

describe("buildMember", () => {
  it("takes the generation's typing and base stats", () => {
    expect(one(5, "Clefable\n- Moonblast")).toMatchObject({ types: ["Normal"], base: { spa: 85 } });
    expect(one(9, "Clefable\n- Moonblast")).toMatchObject({ types: ["Fairy"], base: { spa: 95 } });
  });

  it("marks moves from later generations and unknown moves", () => {
    const m = one(5, "Clefable\n- Moonblast\n- Not A Move\n- Softboiled");
    expect(m.moves.map((mv) => [mv.id, mv.notInGen, mv.unknown])).toEqual([
      ["moonblast", true, false],
      ["notamove", false, true],
      ["softboiled", false, false],
    ]);
  });

  it("takes a move's category from its type before Gen 4", () => {
    expect(one(3, "Tyranitar\n- Crunch").moves[0].category).toBe("Special");
    expect(one(4, "Tyranitar\n- Crunch").moves[0].category).toBe("Physical");
  });

  it("types Hidden Power, Tera Blast and -ate moves", () => {
    expect(one(5, "Latios\n- Hidden Power [Fire]").moves[0].type).toBe("Fire");
    expect(one(9, "Dragonite\nTera Type: Normal\n- Tera Blast").moves[0].type).toBe("Normal");
    expect(one(9, "Sylveon\nAbility: Pixilate\n- Hyper Voice").moves[0].type).toBe("Fairy");
  });

  it("computes real stats", () => {
    const latios = one(5, "Latios\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Draco Meteor");
    expect(latios.stats).toEqual({ hp: 301, atk: 194, def: 196, spa: 359, spd: 257, spe: 350 });
    expect(one(9, "Shedinja\nLevel: 50\n- Shadow Sneak").stats.hp).toBe(1);
  });

  it("has no abilities before Gen 3 and flags legendaries", () => {
    expect(one(2, "Snorlax\n- Rest").ability).toBeNull();
    expect(one(5, "Latios\n- Recover")).toMatchObject({ ability: "levitate", legendary: true, mythical: false });
    expect(one(5, "Mew\n- Recover")).toMatchObject({ legendary: false, mythical: true });
  });

  it("collects species it cannot find", () => {
    const { team, failed } = buildTeam(9, parsePaste("Pikachu\n- Tackle\n\nNotamon\n- Tackle"));
    expect(team.map((m) => m.species)).toEqual(["Pikachu"]);
    expect(failed).toEqual(["Notamon"]);
  });
});
