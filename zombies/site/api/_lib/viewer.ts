import type { Viewer } from "../../shared/bundle.js";
import { requireEnv } from "./env.js";

export async function viewerOf(cookie: string | undefined): Promise<Viewer | null> {
  const devUser = process.env.DEV_USER_ID;
  if (devUser) return { name: "Local", image: null, discordId: devUser };
  if (!cookie) return null;
  const response = await fetch(`${requireEnv("ROOT_URL")}/api/me`, { headers: { cookie } });
  if (!response.ok) return null;
  const { user } = (await response.json()) as { user: { name: string; image: string | null; discordId: string | null } | null };
  return user?.discordId ? { name: user.name, image: user.image, discordId: user.discordId } : null;
}
