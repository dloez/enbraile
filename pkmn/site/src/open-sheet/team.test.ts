import { describe, expect, it } from "vitest";
import { describePokemon } from "@/open-sheet/dex";
import type { Sheet, SheetPokemon } from "@/open-sheet/schema";
import {
  addMember,
  emptySlots,
  giveItem,
  itemsLeft,
  liveSlots,
  memberMon,
  nextTeamName,
  removeMember,
  setAbility,
  setasNeeded,
  setMove,
  slotOf,
  takeItem,
  teach,
  type Slots,
} from "@/open-sheet/team";

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

const pelipper: SheetPokemon = { ...walrein, species: "pelipper", ability: "keeneye", abilities: { base: ["keeneye"], hidden: ["drizzle"] }, types: ["water", "flying"] };

const sheet: Sheet = {
  pokemon: [walrein, pelipper, { ...walrein, nickname: "Wally" }],
  items: [
    { item: "leftovers", quantity: 1 },
    { item: "tinymushroom", quantity: 1 },
  ],
  tms: [{ item: "tm13", move: "icebeam" }],
};

const mons = sheet.pokemon.map(describePokemon);

function team(...indexes: number[]): Slots {
  return indexes.reduce<Slots>((slots, index) => addMember(slots, mons[index]) ?? slots, emptySlots());
}

describe("members", () => {
  it("fills the first free slot and refuses a seventh", () => {
    const slots = removeMember(team(0, 1, 2), 1);
    expect(slotOf(addMember(slots, mons[1])!, mons, 1)).toBe(1);
    const full = team(0, 1, 2, 0, 1, 2);
    expect(addMember(full, mons[0])).toBeNull();
  });

  it("drops a member whose Pokémon is no longer at its index", () => {
    const slots = team(0);
    expect(memberMon(slots[0], mons)?.species.id).toBe("walrein");
    const replaced = [describePokemon(pelipper, 0)];
    expect(memberMon(slots[0], replaced)).toBeUndefined();
  });

  it("frees a stale member's slot and item", () => {
    const held = giveItem(sheet, team(0), 0, "leftovers")!;
    const replaced = [describePokemon(pelipper, 0), mons[1]];
    const live = liveSlots(held, replaced);
    expect(live[0]).toBeNull();
    expect(itemsLeft(sheet, live, "leftovers")).toBe(1);
    expect(slotOf(addMember(live, replaced[1])!, replaced, 1)).toBe(0);
  });
});

describe("items", () => {
  it("lets no more members hold an item than the tab has", () => {
    const slots = giveItem(sheet, team(0, 1), 0, "leftovers")!;
    expect(itemsLeft(sheet, slots, "leftovers")).toBe(0);
    expect(giveItem(sheet, slots, 1, "leftovers")).toBeNull();
    expect(giveItem(sheet, slots, 0, "leftovers")?.[0]?.item).toBe("leftovers");
    expect(giveItem(sheet, takeItem(slots, 0), 1, "leftovers")?.[1]?.item).toBe("leftovers");
  });

  it("refuses an item the tab does not have", () => {
    expect(giveItem(sheet, team(0), 0, "choiceband")).toBeNull();
  });
});

describe("abilities", () => {
  it("counts a Mini Seta for each member off its current ability", () => {
    let slots = team(0, 1);
    slots = setAbility(slots, 0, "drizzle", "bigpecks");
    slots = setAbility(slots, 1, "drizzle", "keeneye");
    expect(setasNeeded(slots, mons)).toBe(2);
    slots = setAbility(slots, 0, "bigpecks", "bigpecks");
    expect(slots[0]?.ability).toBeNull();
    expect(setasNeeded(slots, mons)).toBe(1);
  });
});

describe("moves", () => {
  it("teaches into the first free slot, never twice, and over the last when full", () => {
    let slots = teach(team(0), 0, "icebeam");
    slots = teach(slots, 0, "icebeam");
    expect(slots[0]?.moves).toEqual(["icebeam", null, null, null]);
    slots = setMove(slots, 0, 1, "surf");
    slots = setMove(slots, 0, 2, "rest");
    slots = setMove(slots, 0, 3, "sleeptalk");
    expect(teach(slots, 0, "blizzard")[0]?.moves).toEqual(["icebeam", "surf", "rest", "blizzard"]);
  });

  it("starts a new member with the moves it knows now", () => {
    const moves = { current: ["storedpower", "brine"], relearner: [], tms: [], unchecked: [] };
    const slots = addMember(emptySlots(), describePokemon({ ...walrein, moves }, 0));
    expect(slots?.[0]?.moves).toEqual(["storedpower", "brine", null, null]);
  });

  it("moves a picked move out of the slot that already had it", () => {
    const slots = setMove(teach(team(0), 0, "icebeam"), 0, 2, "icebeam");
    expect(slots[0]?.moves).toEqual([null, null, "icebeam", null]);
  });
});

describe("nextTeamName", () => {
  it("takes the lowest number not in use", () => {
    expect(nextTeamName([])).toBe("Team 1");
    expect(nextTeamName(["Team 1", "Team 3"])).toBe("Team 2");
    expect(nextTeamName(["Team 1", "Team 1 copy"])).toBe("Team 2");
  });
});
