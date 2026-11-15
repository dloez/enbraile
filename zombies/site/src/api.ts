import type { Language } from "../shared/bundle";
import type { MapsPage, RunSheet, Transcript } from "../shared/runs";

export type Me = { user: { name: string; image: string | null; discordId: string } };

export class SignedOut extends Error {}

export class Refused extends Error {
  constructor(readonly status: number) {
    super(`refused: ${status}`);
  }
}

export function signIn(): void {
  location.href = `https://enbraile.vip/?return=${encodeURIComponent(location.href)}`;
}

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: "include",
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 401) throw new SignedOut();
  if (!response.ok) throw new Refused(response.status);
  return (await response.json()) as T;
}

export const fetchMe = () => call<Me>("me");
export const fetchMaps = () => call<MapsPage>("maps");
export const fetchRun = (id: string) => call<RunSheet>(`runs/${encodeURIComponent(id)}`);
export const fetchTranscript = (id: string, after: number) => call<Transcript>(`runs/${encodeURIComponent(id)}/messages?after=${after}`);
export const startRun = (game: string, map: string, language: Language) => call<{ id: string }>("runs", { method: "POST", body: { game, map, language } });
export const joinRun = (id: string) => call<{ id: string }>(`runs/${encodeURIComponent(id)}/join`, { method: "POST" });
export const sendMessage = (id: string, text: string) => call<{ ok: true }>(`runs/${encodeURIComponent(id)}/messages`, { method: "POST", body: { text } });
