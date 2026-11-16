import type { Language } from "../shared/bundle";
import type { Voice } from "../shared/voices";
import type { CallState, JoinRefusal, MapPage, MapsPage, Rating, ReplyEvent, RunSheet, Transcript } from "../shared/runs";

export class SignedOut extends Error {}

export class Refused extends Error {
  constructor(readonly status: number) {
    super(`refused: ${status}`);
  }
}

export function signIn(): void {
  location.href = `https://enbraile.vip/?return=${encodeURIComponent(location.href)}`;
}

const callMs = 10000;
const openMs = 20000;

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: "include",
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(callMs),
  });
  if (response.status === 401) throw new SignedOut();
  if (!response.ok) throw new Refused(response.status);
  return (await response.json()) as T;
}

export const fetchMaps = () => call<MapsPage>("maps");
export const fetchMap = (game: string, map: string) => call<MapPage>(`maps/${encodeURIComponent(game)}/${encodeURIComponent(map)}`);
export const fetchRun = (id: string) => call<RunSheet>(`runs/${encodeURIComponent(id)}`);
export const fetchTranscript = (id: string, after: number, rungsAfter: number) =>
  call<Transcript>(`runs/${encodeURIComponent(id)}/messages?after=${after}&rungsAfter=${rungsAfter}`);
export const startRun = (game: string, map: string, language: Language, voice: Voice) => call<{ id: string }>("runs", { method: "POST", body: { game, map, language, voice } });
export const changeVoice = (id: string, voice: Voice) => call<{ voice: Voice }>(`runs/${encodeURIComponent(id)}`, { method: "PATCH", body: { voice } });
export const joinRun = (id: string) => call<{ id: string }>(`runs/${encodeURIComponent(id)}/join`, { method: "POST" });
export const rateCard = (id: string, card: number, rating: Rating) => call<{ rating: Rating }>(`runs/${encodeURIComponent(id)}/cards/${card}/feedback`, { method: "PUT", body: { rating } });
export const fetchCall = (id: string) => call<CallState>(`runs/${encodeURIComponent(id)}/voice`);

export async function bringCoach(id: string): Promise<{ channelId: string } | { error: JoinRefusal }> {
  const response = await fetch(`/api/runs/${encodeURIComponent(id)}/voice/join`, { credentials: "include", method: "POST", signal: AbortSignal.timeout(callMs) });
  if (response.status === 401) throw new SignedOut();
  if (response.ok || response.status === 409 || response.status === 503) return (await response.json()) as { channelId: string } | { error: JoinRefusal };
  throw new Refused(response.status);
}

export type Listener = { opened: () => void; heard: (event: ReplyEvent) => void };

async function listen(path: string, body: unknown, listener: Listener): Promise<void> {
  const opening = new AbortController();
  const timer = setTimeout(() => opening.abort(), openMs);
  const response = await fetch(`/api/${path}`, {
    signal: opening.signal,
    credentials: "include",
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).finally(() => clearTimeout(timer));
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

export const sendMessage = (id: string, text: string, revision: boolean, listener: Listener) => listen(`runs/${encodeURIComponent(id)}/messages`, { text, revision }, listener);
export const askMore = (id: string, card: number, listener: Listener) => listen(`runs/${encodeURIComponent(id)}/cards/${card}/more`, undefined, listener);
