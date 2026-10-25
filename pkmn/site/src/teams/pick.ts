import { PICK_SIZE, type Slots } from "@/teams/team";

export type Scope = "all" | "six";

export interface Pick {
  scope: Scope;
  slots: number[] | null;
}

const key = (team: string) => `team-pick:${team}`;

export function loadPick(team: string): Pick {
  try {
    const raw = JSON.parse(localStorage.getItem(key(team)) ?? "null");
    if (!raw || typeof raw !== "object") return { scope: "all", slots: null };
    const slots = Array.isArray(raw.slots) ? raw.slots.filter((at: unknown): at is number => Number.isInteger(at)).slice(0, PICK_SIZE) : null;
    return { scope: raw.scope === "six" ? "six" : "all", slots };
  } catch {
    return { scope: "all", slots: null };
  }
}

export function savePick(team: string, pick: Pick) {
  try {
    localStorage.setItem(key(team), JSON.stringify(pick));
  } catch {
    return;
  }
}

export function filledAt(slots: Slots): number[] {
  return slots.flatMap((member, at) => (member ? [at] : []));
}

export function pickedOf(slots: Slots, pick: Pick): number[] {
  const filled = filledAt(slots);
  return (pick.slots ?? filled.slice(0, PICK_SIZE)).filter((at) => filled.includes(at));
}

export function togglePicked(picked: readonly number[], at: number): number[] | null {
  if (picked.includes(at)) return picked.filter((x) => x !== at);
  return picked.length < PICK_SIZE ? [...picked, at] : null;
}

export function analysedSlots(slots: Slots, picked: readonly number[]): Slots {
  return slots.map((member, at) => (picked.includes(at) ? member : null));
}
