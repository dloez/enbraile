import { and, eq, ne } from "drizzle-orm";
import type { Person } from "../../shared/runs.js";
import { bot } from "./bot.js";
import { db } from "./db.js";
import { messages, runMembers, runs } from "./schema.js";

const waitMs = 1500;
const lookupMs = 10_000;
const keptMs = 60_000;
const downMs = 30_000;
const batch = 50;

const known = new Map<string, { name: string | null; until: number }>();
const asking = new Map<string, Promise<void>>();
let downUntil = 0;

async function ask(ids: string[]): Promise<Record<string, string> | null> {
  try {
    const response = await bot("names", lookupMs, { method: "POST", body: { ids } });
    if (!response?.ok) return null;
    const { names } = (await response.json()) as { names?: Record<string, unknown> };
    return Object.fromEntries(Object.entries(names ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""));
  } catch (error) {
    console.error("bot names", (error as Error).message);
    return null;
  }
}

async function keep(id: string, name: string): Promise<void> {
  await Promise.all([
    db.update(runMembers).set({ name }).where(and(eq(runMembers.discordId, id), ne(runMembers.name, name))),
    db.update(messages).set({ name }).where(and(eq(messages.discordId, id), eq(messages.author, "member"), ne(messages.name, name))),
    db.update(runs).set({ startedByName: name }).where(and(eq(runs.startedBy, id), ne(runs.startedByName, name))),
  ]);
}

async function lookUp(chunk: string[]): Promise<void> {
  const started = Date.now();
  const names = await ask(chunk);
  const now = Date.now();
  console.log("bot names", { ids: chunk.length, ms: now - started, answered: names !== null });
  if (!names) {
    downUntil = now + downMs;
    return;
  }
  const changed = chunk.filter((id) => names[id] && known.get(id)?.name !== names[id]);
  for (const id of chunk) known.set(id, { name: names[id] ?? null, until: now + keptMs });
  await Promise.all(changed.map((id) => keep(id, names[id]!))).catch((error: Error) => console.error("keep names", error.message));
}

export type Names = (discordId: string | null, stored: string) => Person;

export async function currentNames(ids: Array<string | null>): Promise<Names> {
  const now = Date.now();
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id && /^\d{1,20}$/.test(id))))];
  const missing = wanted.filter((id) => (known.get(id)?.until ?? 0) <= now && !asking.has(id));
  const flights: Promise<void>[] = [];
  if (missing.length && now >= downUntil && process.env.BOT_URL) {
    for (let index = 0; index < missing.length; index += batch) {
      const chunk = missing.slice(index, index + batch);
      const flight = lookUp(chunk).finally(() => chunk.forEach((id) => asking.delete(id)));
      for (const id of chunk) asking.set(id, flight);
      flights.push(flight);
    }
  }
  if (flights.length) {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([Promise.all(flights), new Promise((resolve) => (timer = setTimeout(resolve, waitMs)))]);
    clearTimeout(timer);
  }
  const at = Date.now();
  return (discordId, stored) => {
    const entry = discordId ? known.get(discordId) : undefined;
    return entry && entry.until > at && entry.name ? { name: entry.name, who: discordId, live: true } : { name: stored, who: discordId, live: false };
  };
}
