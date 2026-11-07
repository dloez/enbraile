export type Track = { id: string; query: string; title: string; artist?: string | null; artwork?: string | null; durationMs: number; url: string | null; requestedBy: string };
export type Loop = "off" | "track" | "queue";
export type View = { channelId: string | null; tracks: Track[]; current: number; paused: boolean; loading: boolean; volume: number; loop: Loop; autoplay: boolean; autoplayEndsAt: number | null; autoplayNext: Track | null; positionMs: number; listeners: number; active: boolean };
export type Song = { videoId: string; url: string; title: string; artist: string; album: string | null; durationMs: number; artwork: string | null; plays: string | null };
export type Me = { user: { name: string; image: string | null }; discordId: string; member: boolean; canManage: boolean; canPlay: boolean };
export type HistoryEntry = { id: number; query: string; title: string; url: string | null; requestedBy: string; playedAt: number };
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
