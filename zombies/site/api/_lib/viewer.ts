import type { Viewer } from "../../shared/bundle.js";
import { requireEnv } from "./env.js";

export const devUserCookie = "zombies_dev_user";

export function devUsers(): Viewer[] | null {
  const list = process.env.DEV_USER_ID;
  if (!list) return null;
  return list
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [discordId = entry, name] = entry.split(":");
      return { discordId, name: name || `Local ${index + 1}`, image: null };
    });
}

function cookieValue(cookie: string | undefined, name: string): string | undefined {
  return cookie
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

export async function viewerOf(cookie: string | undefined): Promise<Viewer | null> {
  const dev = devUsers();
  if (dev) {
    const raw = cookieValue(cookie, devUserCookie);
    const picked = raw && decodeURIComponent(raw);
    return dev.find((user) => user.discordId === picked) ?? dev[0] ?? null;
  }
  if (!cookie) return null;
  const response = await fetch(`${requireEnv("ROOT_URL")}/api/me`, { headers: { cookie } });
  if (!response.ok) return null;
  const { user } = (await response.json()) as { user: { name: string; image: string | null; discordId: string | null } | null };
  return user?.discordId ? { name: user.name, image: user.image, discordId: user.discordId } : null;
}
