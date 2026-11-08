export type Requester = { name: string; avatar: string | null };
export type AutoplayMode = "session" | "explore";
export type Track = { id: string; query: string; title: string; artist?: string | null; artwork?: string | null; durationMs: number; url: string | null; requestedBy: string; requester?: Requester | null; pickedBy?: AutoplayMode; replacing?: boolean };
export type Loop = "off" | "track" | "queue";
export type Listener = { id: string; name: string; avatar: string | null };
export type View = { channelId: string | null; tracks: Track[]; current: number; paused: boolean; loading: boolean; stalled?: boolean; volume: number; loop: Loop; autoplay: boolean; autoplayMode: AutoplayMode; autoplayEndsAt: number | null; autoplayUpcoming: Track[]; positionMs: number; listeners: number; people?: Listener[]; active: boolean; skipped: { id: string; title: string } | null };
export type ArtistRef = { id: string; name: string };
export type Song = { videoId: string; url: string; title: string; artist: string; artists?: ArtistRef[]; album: string | null; durationMs: number; artwork: string | null; plays: string | null };
export type Artist = { id: string; name: string; avatar: string | null; audience: string | null };
export type Release = { id: string; title: string; year: string | null; kind: "album" | "single"; artwork: string | null };
export type ArtistPage = Artist & { banner: string | null; songs: Song[]; releases: Release[]; related: Artist[] };
export type Album = Release & { artist: string; songs: Song[] };
export type Ticket = { ticket: string; url: string };
export type Me = { user: { name: string; image: string | null }; discordId: string; member: boolean; canManage: boolean; canPlay: boolean; state: View | null; live: Ticket | null };
export type HistoryEntry = { id: number; query: string; title: string; url: string | null; requestedBy: string; requester: Requester | null; playedAt: number; artist: string | null; artwork: string | null; durationMs: number };
export type SessionSummary = { id: number; startedAt: number; endedAt: number | null; live: boolean; songs: number; autoplay: number; requesters: { id: string; name: string; avatar: string | null; songs: number }[]; artworks: string[] };
export type SessionTrack = HistoryEntry & { pickedBy: AutoplayMode | null };
export type Playlist = { id: string; name: string; ownerId: string; ownerName: string; trackCount: number };
export type PlaylistTrack = { id: string; query: string; title: string };
export type SettingsData = { djRoleId: string | null; roles: { id: string; name: string }[] };

export class ApiError extends Error {}

export function signIn(): void {
  location.href = `https://enbraile.vip/?return=${encodeURIComponent(location.href)}`;
}

const REPLY_TIMEOUT_MS = 15_000;

let socket: WebSocket | null = null;
let ownerName = "";
let sequence = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

export function setOwnerName(name: string): void {
  ownerName = name;
}

export function attachSocket(next: WebSocket | null): void {
  socket = next;
  if (next) return;
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new ApiError("failed"));
    pending.delete(id);
  }
}

export function handleReply(message: { id: number; status: number; body: unknown }): void {
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  clearTimeout(entry.timer);
  const body = message.body as { error?: string };
  if (message.status >= 400) entry.reject(new ApiError(body?.error ?? "failed"));
  else entry.resolve(message.body);
}

function overSocket<T>(live: WebSocket, path: string, method: string, body: Record<string, unknown>): Promise<T> {
  const id = ++sequence;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new ApiError("failed"));
    }, REPLY_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    live.send(JSON.stringify({ id, method, path, body: { ...body, ownerName } }));
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (socket?.readyState === WebSocket.OPEN && path !== "me" && path !== "ticket") return overSocket<T>(socket, path, init?.method ?? "GET", init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  const response = await fetch(`/api/${path}`, { ...init, headers: { "content-type": "application/json" } });
  if (response.status === 401) {
    signIn();
    throw new ApiError("signedOut");
  }
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? "failed");
  return body;
}

export const get = <T,>(path: string) => request<T>(path);
export const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
