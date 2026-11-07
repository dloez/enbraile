import { db, getValue, setValue } from "./db.ts";
import * as player from "./player.ts";

export type Track = { id: string; query: string; title: string; artist: string | null; artwork: string | null; durationMs: number; url: string | null; requestedBy: string };
export type Loop = "off" | "track" | "queue";

type State = {
  channelId: string | null;
  tracks: Track[];
  current: number;
  paused: boolean;
  volume: number;
  loop: Loop;
  autoplay: boolean;
  autoplayNext: Track | null;
  positionMs: number;
  generation: number;
  listeners: number;
  emptySince: number | null;
  idleSince: number | null;
  pausedSince: number | null;
  lastHumanAt: number;
  active: boolean;
  failures: number;
};

export type View = {
  channelId: string | null;
  tracks: Track[];
  current: number;
  paused: boolean;
  volume: number;
  loop: Loop;
  autoplay: boolean;
  autoplayEndsAt: number | null;
  autoplayNext: Track | null;
  positionMs: number;
  listeners: number;
  active: boolean;
};

export type Settings = { djRoleId: string | null };
export type HistoryEntry = { id: number; query: string; title: string; url: string | null; requestedBy: string; playedAt: number };
export type Playlist = { id: string; name: string; ownerId: string; ownerName: string; trackCount: number };
export type PlaylistTrack = { id: string; query: string; title: string };
export type QueueItem = { query: string; title?: string; artist?: string | null; artwork?: string | null; durationMs?: number };
export type EnqueueResult = { ok: true; added: number; position: number };

export type Command =
  | { action: "skip" | "pause" | "resume" | "stop" | "shuffle" | "clear" | "keepGoing" }
  | { action: "seek"; positionMs: number }
  | { action: "volume"; volume: number }
  | { action: "loop"; loop: Loop }
  | { action: "autoplay"; on: boolean }
  | { action: "remove"; id: string }
  | { action: "move"; id: string; to: number };

const TICK_MS = 15_000;
const EMPTY_LEAVE_MS = 60_000;
const IDLE_LEAVE_MS = 5 * 60_000;
const PAUSED_LEAVE_MS = 15 * 60_000;
const AUTOPLAY_LIMIT_MS = 60 * 60_000;
const MAX_FAILURES_IN_A_ROW = 5;
const HISTORY_KEPT = 200;

const blank = (): State => ({
  channelId: null,
  tracks: [],
  current: -1,
  paused: false,
  volume: 1,
  loop: "off",
  autoplay: false,
  autoplayNext: null,
  positionMs: 0,
  generation: 0,
  listeners: 0,
  emptySince: null,
  idleSince: null,
  pausedSince: null,
  lastHumanAt: 0,
  active: false,
  failures: 0,
});

export function displayName(query: string): string {
  const search = query.match(/^https:\/\/music\.youtube\.com\/search\?q=([^#]+)/)?.[1];
  return search ? decodeURIComponent(search) : query;
}

function videoId(url: string | null): string | null {
  return url?.match(/[?&]v=([\w-]{11})/)?.[1] ?? null;
}

const state: State = { ...blank(), ...getValue<State>("state") };
const watchers = new Set<(view: View) => void>();
let ticker: ReturnType<typeof setInterval> | undefined;

function save(): void {
  setValue("state", state);
  const current = view();
  for (const watcher of watchers) watcher(current);
}

export function watch(watcher: (view: View) => void): () => void {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

export function settings(): Settings {
  return { djRoleId: getValue<string | null>("djRoleId") ?? null };
}

export function setSettings(next: Settings): void {
  setValue("djRoleId", next.djRoleId);
  save();
}

export function view(): View {
  return {
    channelId: state.channelId,
    tracks: state.tracks,
    current: state.current,
    paused: state.paused,
    volume: state.volume,
    loop: state.loop,
    autoplay: state.autoplay,
    autoplayEndsAt: state.autoplay ? state.lastHumanAt + AUTOPLAY_LIMIT_MS : null,
    autoplayNext: state.autoplay && state.current === state.tracks.length - 1 ? state.autoplayNext : null,
    positionMs: state.positionMs,
    listeners: state.listeners,
    active: state.active,
  };
}

function startCurrent(offsetMs = 0): void {
  const track = state.tracks[state.current];
  if (!track) return;
  state.generation += 1;
  state.positionMs = offsetMs;
  state.paused = false;
  state.pausedSince = null;
  state.idleSince = null;
  save();
  player.play(track.query, offsetMs, state.volume, state.generation);
  const next = state.tracks[state.current + 1];
  if (next) player.prepare(next.query);
}

async function related(): Promise<Track | null> {
  const last = [...state.tracks].reverse().find((track) => videoId(track.url));
  const id = videoId(last?.url ?? null);
  if (!id) return null;
  const tracks = await player.related(id);
  const played = new Set(state.tracks.map((track) => videoId(track.url)));
  for (const row of db.prepare("SELECT url FROM history ORDER BY id DESC LIMIT 100").all() as { url: string | null }[]) played.add(videoId(row.url));
  const pick = tracks.find((track) => videoId(track.url) && !played.has(videoId(track.url)));
  return pick ? { id: crypto.randomUUID(), query: pick.url, title: pick.title, artist: null, artwork: null, durationMs: 0, url: pick.url, requestedBy: "autoplay" } : null;
}

async function planAutoplay(): Promise<void> {
  const last = state.tracks.at(-1);
  if (!state.active || !state.autoplay || !last || state.current !== state.tracks.length - 1 || state.autoplayNext) return;
  const pick = await related().catch((error: Error) => (console.error("related", error.message), null));
  if (!pick || !state.active || !state.autoplay || state.autoplayNext || state.tracks.at(-1)?.id !== last.id) return;
  state.autoplayNext = pick;
  save();
  player.prepare(pick.query);
}

const plan = () => void planAutoplay();

async function advance(): Promise<void> {
  if (state.loop !== "track") state.current += 1;
  if (state.current >= state.tracks.length) {
    if (state.loop === "queue" && state.tracks.length) state.current = 0;
    else {
      const planned = state.autoplayNext;
      state.autoplayNext = null;
      const next = state.autoplay ? (planned ?? (await related().catch((error: Error) => (console.error("related", error.message), null)))) : null;
      if (next) {
        state.tracks.push(next);
        state.current = state.tracks.length - 1;
      } else {
        state.current = state.tracks.length;
        state.positionMs = 0;
        state.idleSince = Date.now();
        save();
        return;
      }
    }
  }
  startCurrent();
}

function end(): void {
  if (state.active) player.leave();
  if (ticker) clearInterval(ticker);
  ticker = undefined;
  Object.assign(state, { ...blank(), volume: state.volume, loop: state.loop, generation: state.generation, lastHumanAt: state.lastHumanAt });
  save();
}

function startTicking(): void {
  if (!ticker) ticker = setInterval(() => void tick().catch((error: Error) => console.error("tick", error.message)), TICK_MS);
}

export async function expand(url: string): Promise<{ title: string; url: string }[]> {
  return player.expand(url);
}

export async function enqueue(channelId: string, items: QueueItem[], requestedBy: string): Promise<EnqueueResult> {
  const before = state.tracks.length;
  const position = before - Math.max(state.current, 0);
  const wasPlaying = state.active && state.current >= 0 && state.current < before;
  state.tracks.push(...items.map((item) => ({ id: crypto.randomUUID(), query: item.query, title: item.title ?? displayName(item.query), artist: item.artist ?? null, artwork: item.artwork ?? null, durationMs: item.durationMs ?? 0, url: null, requestedBy })));
  state.lastHumanAt = Date.now();
  state.autoplayNext = null;
  if (!state.active || state.channelId !== channelId) {
    await player.join(channelId);
    state.channelId = channelId;
    state.active = true;
    startTicking();
  }
  if (wasPlaying) {
    save();
    if (state.current + 1 === before) player.prepare(state.tracks[before]!.query);
  } else {
    state.current = before;
    startCurrent();
  }
  return { ok: true, added: items.length, position };
}

export async function command(command: Command): Promise<void> {
  if (!state.active) return;
  state.lastHumanAt = Date.now();
  switch (command.action) {
    case "keepGoing":
      break;
    case "skip": {
      player.halt();
      const looped = state.loop;
      if (looped === "track") state.loop = "off";
      await advance();
      state.loop = looped;
      save();
      plan();
      return;
    }
    case "pause":
      player.pause();
      state.paused = true;
      state.pausedSince = Date.now();
      break;
    case "resume":
      player.resume();
      state.paused = false;
      state.pausedSince = null;
      break;
    case "stop":
      end();
      return;
    case "clear":
      state.tracks = state.tracks.slice(0, state.current + 1);
      break;
    case "shuffle": {
      const upcoming = state.tracks.slice(state.current + 1);
      for (let i = upcoming.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [upcoming[i], upcoming[j]] = [upcoming[j]!, upcoming[i]!];
      }
      state.tracks = [...state.tracks.slice(0, state.current + 1), ...upcoming];
      break;
    }
    case "seek":
      startCurrent(Math.max(0, command.positionMs));
      return;
    case "volume":
      state.volume = Math.min(2, Math.max(0, command.volume));
      startCurrent(player.status().positionMs);
      return;
    case "loop":
      state.loop = command.loop;
      break;
    case "autoplay":
      state.autoplay = command.on;
      if (!command.on) state.autoplayNext = null;
      break;
    case "remove": {
      const index = state.tracks.findIndex((track) => track.id === command.id);
      if (index > state.current) state.tracks.splice(index, 1);
      break;
    }
    case "move": {
      const index = state.tracks.findIndex((track) => track.id === command.id);
      if (index > state.current) {
        const [track] = state.tracks.splice(index, 1);
        const to = Math.min(state.tracks.length, Math.max(state.current + 1, command.to));
        state.tracks.splice(to, 0, track!);
      }
      break;
    }
  }
  save();
  plan();
}

player.onPlayerEvent((event) => {
  if (!state.active || event.generation !== state.generation) return;
  if (event.type === "started") {
    const track = state.tracks[state.current];
    if (track) {
      const firstStart = track.url === null || track.requestedBy === "autoplay";
      Object.assign(track, { title: event.title, artist: track.artist ?? event.artist, artwork: track.artwork ?? event.artwork, durationMs: event.durationMs || track.durationMs, url: event.url });
      if (firstStart) {
        db.prepare("INSERT INTO history (query, title, url, requested_by, played_at) VALUES (?, ?, ?, ?, ?)").run(track.query, track.title, track.url, track.requestedBy, Date.now());
        db.prepare("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT ?)").run(HISTORY_KEPT);
      }
    }
    state.failures = 0;
    save();
    plan();
    return;
  }
  if (event.type === "failed") {
    state.failures += 1;
    console.error("track failed", state.tracks[state.current]?.query, event.error);
    if (state.failures >= MAX_FAILURES_IN_A_ROW) return end();
  }
  void advance();
});

async function tick(): Promise<void> {
  if (!state.active) return;
  const now = Date.now();
  const status = player.status();
  if (!status.connected && state.channelId) {
    await player.join(state.channelId);
    if (state.current >= 0 && state.current < state.tracks.length) startCurrent(state.positionMs);
    return;
  }
  if (state.current >= 0 && state.current < state.tracks.length) state.positionMs = status.positionMs;
  state.listeners = status.listeners;
  state.emptySince = state.listeners === 0 ? (state.emptySince ?? now) : null;
  const autoplayOver = state.autoplay && (state.listeners === 0 || now - state.lastHumanAt >= AUTOPLAY_LIMIT_MS);
  const expired = autoplayOver || (state.emptySince !== null && now - state.emptySince >= EMPTY_LEAVE_MS) || (state.idleSince !== null && now - state.idleSince >= IDLE_LEAVE_MS) || (state.pausedSince !== null && now - state.pausedSince >= PAUSED_LEAVE_MS);
  if (expired) return end();
  save();
}

export function snapshot(): void {
  if (state.active && state.current >= 0 && state.current < state.tracks.length) state.positionMs = player.status().positionMs;
  setValue("state", state);
}

export async function resumeAfterRestart(): Promise<void> {
  if (!state.active || !state.channelId) return;
  try {
    await player.join(state.channelId);
    startTicking();
    if (state.current >= 0 && state.current < state.tracks.length) startCurrent(state.positionMs);
  } catch (error) {
    console.error("resume", (error as Error).message);
    end();
  }
}

export function history(): HistoryEntry[] {
  return (db.prepare("SELECT * FROM history ORDER BY id DESC LIMIT 50").all() as { id: number; query: string; title: string; url: string | null; requested_by: string; played_at: number }[]).map((row) => ({ id: row.id, query: row.query, title: row.title, url: row.url, requestedBy: row.requested_by, playedAt: row.played_at }));
}

export function playlists(): Playlist[] {
  return (db.prepare("SELECT p.id, p.name, p.owner_id, p.owner_name, COUNT(t.id) AS track_count FROM playlist p LEFT JOIN playlist_track t ON t.playlist_id = p.id GROUP BY p.id ORDER BY p.name COLLATE NOCASE").all() as { id: string; name: string; owner_id: string; owner_name: string; track_count: number }[]).map((row) => ({ id: row.id, name: row.name, ownerId: row.owner_id, ownerName: row.owner_name, trackCount: row.track_count }));
}

export function playlistTracks(id: string): PlaylistTrack[] {
  return db.prepare("SELECT id, query, title FROM playlist_track WHERE playlist_id = ? ORDER BY position").all(id) as PlaylistTrack[];
}

const owns = (id: string, userId: string) => db.prepare("SELECT 1 FROM playlist WHERE id = ? AND owner_id = ?").get(id, userId) !== undefined;

export function createPlaylist(name: string, ownerId: string, ownerName: string): string {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO playlist (id, name, owner_id, owner_name, created_at) VALUES (?, ?, ?, ?, ?)").run(id, name.trim().slice(0, 100), ownerId, ownerName, Date.now());
  return id;
}

export function renamePlaylist(id: string, userId: string, name: string): boolean {
  if (!owns(id, userId)) return false;
  db.prepare("UPDATE playlist SET name = ? WHERE id = ?").run(name.trim().slice(0, 100), id);
  return true;
}

export function deletePlaylist(id: string, userId: string): boolean {
  if (!owns(id, userId)) return false;
  db.prepare("DELETE FROM playlist_track WHERE playlist_id = ?").run(id);
  db.prepare("DELETE FROM playlist WHERE id = ?").run(id);
  return true;
}

export function addToPlaylist(id: string, userId: string, items: { query: string; title: string }[]): boolean {
  if (!owns(id, userId)) return false;
  let position = (db.prepare("SELECT COALESCE(MAX(position), -1) AS top FROM playlist_track WHERE playlist_id = ?").get(id) as { top: number }).top;
  const insert = db.prepare("INSERT INTO playlist_track (id, playlist_id, position, query, title) VALUES (?, ?, ?, ?, ?)");
  for (const item of items) insert.run(crypto.randomUUID(), id, ++position, item.query, item.title);
  return true;
}

export function removeFromPlaylist(id: string, userId: string, trackId: string): boolean {
  if (!owns(id, userId)) return false;
  db.prepare("DELETE FROM playlist_track WHERE id = ? AND playlist_id = ?").run(trackId, id);
  return true;
}

export function movePlaylistTrack(id: string, userId: string, trackId: string, to: number): boolean {
  if (!owns(id, userId)) return false;
  const tracks = playlistTracks(id);
  const from = tracks.findIndex((track) => track.id === trackId);
  if (from < 0) return true;
  const [track] = tracks.splice(from, 1);
  tracks.splice(Math.min(tracks.length, Math.max(0, to)), 0, track!);
  const update = db.prepare("UPDATE playlist_track SET position = ? WHERE id = ?");
  tracks.forEach((entry, position) => update.run(position, entry.id));
  return true;
}
