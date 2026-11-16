import { bot } from "./bot.js";

const timeoutMs = 1500;
const keptMs = 60_000;
const downMs = 30_000;
const batch = 50;

const known = new Map<string, { name: string | null; until: number }>();
let downUntil = 0;

async function ask(ids: string[]): Promise<Record<string, string> | null> {
  try {
    const response = await bot("names", timeoutMs, { method: "POST", body: { ids } });
    if (!response?.ok) return null;
    const { names } = (await response.json()) as { names?: Record<string, unknown> };
    return Object.fromEntries(Object.entries(names ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""));
  } catch (error) {
    console.error("bot names", (error as Error).message);
    return null;
  }
}

export type Names = (discordId: string | null, stored: string) => string;

export async function currentNames(ids: Array<string | null>): Promise<Names> {
  const now = Date.now();
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id && /^\d{1,20}$/.test(id))))];
  const missing = wanted.filter((id) => (known.get(id)?.until ?? 0) <= now);
  if (missing.length && now >= downUntil && process.env.BOT_URL) {
    const chunks = Array.from({ length: Math.ceil(missing.length / batch) }, (_, index) => missing.slice(index * batch, (index + 1) * batch));
    const answers = await Promise.all(chunks.map(ask));
    answers.forEach((names, index) => {
      if (!names) {
        downUntil = now + downMs;
        return;
      }
      for (const id of chunks[index]!) known.set(id, { name: names[id] ?? null, until: now + keptMs });
    });
  }
  return (discordId, stored) => {
    const entry = discordId ? known.get(discordId) : undefined;
    return (entry && entry.until > now && entry.name) || stored;
  };
}
