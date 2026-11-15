import type { Language } from "../shared/bundle";
import type { MapsPage, ReplyEvent, RunSheet, Transcript } from "../shared/runs";

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
export const fetchTranscript = (id: string, after: number, rungsAfter: number) =>
  call<Transcript>(`runs/${encodeURIComponent(id)}/messages?after=${after}&rungsAfter=${rungsAfter}`);
export const startRun = (game: string, map: string, language: Language) => call<{ id: string }>("runs", { method: "POST", body: { game, map, language } });
export const joinRun = (id: string) => call<{ id: string }>(`runs/${encodeURIComponent(id)}/join`, { method: "POST" });
export type Listener = { opened: () => void; heard: (event: ReplyEvent) => void };

async function listen(path: string, body: unknown, listener: Listener): Promise<void> {
  const response = await fetch(`/api/${path}`, {
    credentials: "include",
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) throw new SignedOut();
  if (!response.ok || !response.body) throw new Refused(response.status);
  listener.opened();
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) listener.heard(JSON.parse(line) as ReplyEvent);
  }
}

export const sendMessage = (id: string, text: string, listener: Listener) => listen(`runs/${encodeURIComponent(id)}/messages`, { text }, listener);
export const askMore = (id: string, card: number, listener: Listener) => listen(`runs/${encodeURIComponent(id)}/cards/${card}/more`, undefined, listener);
