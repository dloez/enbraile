import type { PublishedMap } from "../shared/bundle";

export type Me = { user: { name: string; image: string | null; discordId: string } };

export class SignedOut extends Error {}

export function signIn(): void {
  location.href = `https://enbraile.vip/?return=${encodeURIComponent(location.href)}`;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api/${path}`, { credentials: "include" });
  if (response.status === 401) throw new SignedOut();
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

export const fetchMe = () => get<Me>("me");
export const fetchMaps = () => get<{ maps: PublishedMap[] }>("maps").then((reply) => reply.maps);
