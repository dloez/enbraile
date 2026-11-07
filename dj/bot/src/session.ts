import { Container } from "@cloudflare/containers";
import type { Env } from "./env.js";

export type Track = { id: string; query: string; title: string; durationMs: number; url: string | null; requestedBy: string };
export type Loop = "off" | "track" | "queue";

export type SessionState = {
  guildId: string;
  channelId: string | null;
  tracks: Track[];
  current: number;
  paused: boolean;
  volume: number;
  loop: Loop;
  autoplay: boolean;
  positionMs: number;
  generation: number;
  listeners: number;
  emptySince: number | null;
  idleSince: number | null;
  pausedSince: number | null;
  lastHumanAt: number;
  active: boolean;
  lastTick: number | null;
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
  positionMs: number;
  listeners: number;
  active: boolean;
  hoursThisMonth: number;
  hourLimit: number;
};

export type Settings = { djRoleId: string | null; hourLimit: number };
export type HistoryEntry = { id: number; query: string; title: string; url: string | null; requestedBy: string; playedAt: number };
export type Playlist = { id: string; name: string; ownerId: string; ownerName: string; trackCount: number };
export type PlaylistTrack = { id: string; query: string; title: string };

export type Command =
  | { action: "skip" | "pause" | "resume" | "stop" | "shuffle" | "clear" | "keepGoing" }
  | { action: "seek"; positionMs: number }
  | { action: "volume"; volume: number }
  | { action: "loop"; loop: Loop }
  | { action: "autoplay"; on: boolean }
  | { action: "remove"; id: string }
  | { action: "move"; id: string; to: number };

export type ContainerEvent = { type: "started"; generation: number; title: string; durationMs: number; url: string } | { type: "ended" | "failed"; generation: number; error?: string } | { type: "stopping"; positionMs: number };

export type EnqueueResult = { ok: true; added: number; position: number } | { ok: false; reason: "limit" };

const TICK_SECONDS = 15;
const EMPTY_LEAVE_MS = 60_000;
const IDLE_LEAVE_MS = 5 * 60_000;
const PAUSED_LEAVE_MS = 15 * 60_000;
const AUTOPLAY_LIMIT_MS = 60 * 60_000;
const DEFAULT_HOUR_LIMIT = 200;
const MAX_FAILURES_IN_A_ROW = 5;
const HISTORY_KEPT = 200;

const blank = (guildId: string): SessionState => ({
  guildId,
  channelId: null,
  tracks: [],
  current: -1,
  paused: false,
  volume: 1,
  loop: "off",
  autoplay: false,
  positionMs: 0,
  generation: 0,
  listeners: 0,
  emptySince: null,
  idleSince: null,
  pausedSince: null,
  lastHumanAt: 0,
  active: false,
  lastTick: null,
  failures: 0,
});

const monthKey = () => `hours:${new Date().toISOString().slice(0, 7)}`;

export function displayName(query: string): string {
  return query.replace(/^ytsearch\d*:/, "").replace(/\s+audio$/, "");
}

function videoId(url: string | null): string | null {
  return url?.match(/[?&]v=([\w-]{11})/)?.[1] ?? null;
}

export class Session extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "2m";
  enableInternet = true;

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = { DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN, WORKER_URL: env.WORKER_URL, INTERNAL_SECRET: env.INTERNAL_SECRET };
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS playlist (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS playlist_track (id TEXT PRIMARY KEY, playlist_id TEXT NOT NULL, position INTEGER NOT NULL, query TEXT NOT NULL, title TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS playlist_track_order ON playlist_track (playlist_id, position);
        CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, title TEXT NOT NULL, url TEXT, requested_by TEXT NOT NULL, played_at INTEGER NOT NULL);
      `);
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/live") return super.fetch(request);
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify(await this.view()));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(): Promise<void> {}

  async webSocketClose(socket: WebSocket, code: number): Promise<void> {
    socket.close(code);
  }

  private async load(): Promise<SessionState> {
    return { ...blank(this.env.GUILD_ID), ...(await this.ctx.storage.get<SessionState>("state")) };
  }

  private async save(state: SessionState): Promise<void> {
    await this.ctx.storage.put("state", state);
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;
    const message = JSON.stringify(await this.viewOf(state));
    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        socket.close();
      }
    }
  }

  private async call(path: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const response = await this.containerFetch(new Request(`http://container${path}`, { method: "POST", body: JSON.stringify(body) }), 8080);
    const value = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(value.error ?? response.status));
    return value;
  }

  private async hours(): Promise<number> {
    return (await this.ctx.storage.get<number>(monthKey())) ?? 0;
  }

  async settings(): Promise<Settings> {
    return { djRoleId: (await this.ctx.storage.get<string | null>("djRoleId")) ?? null, hourLimit: (await this.ctx.storage.get<number>("hourLimit")) ?? DEFAULT_HOUR_LIMIT };
  }

  async setSettings(settings: Settings): Promise<void> {
    await this.ctx.storage.put("djRoleId", settings.djRoleId);
    await this.ctx.storage.put("hourLimit", Math.max(0, settings.hourLimit));
    await this.save(await this.load());
  }

  private async startCurrent(state: SessionState, offsetMs = 0): Promise<void> {
    const track = state.tracks[state.current];
    if (!track) return;
    state.generation += 1;
    state.positionMs = offsetMs;
    state.paused = false;
    state.pausedSince = null;
    state.idleSince = null;
    await this.save(state);
    await this.call("/play", { query: track.query, offsetMs, volume: state.volume, generation: state.generation });
    const next = state.tracks[state.current + 1];
    if (next) await this.call("/prepare", { query: next.query });
  }

  private async related(state: SessionState): Promise<Track | null> {
    const last = [...state.tracks].reverse().find((track) => videoId(track.url));
    const id = videoId(last?.url ?? null);
    if (!id) return null;
    const { tracks } = (await this.call("/related", { videoId: id })) as unknown as { tracks: { title: string; url: string }[] };
    const played = new Set(state.tracks.map((track) => videoId(track.url)));
    const recent = this.ctx.storage.sql.exec<{ url: string | null }>("SELECT url FROM history ORDER BY id DESC LIMIT 100").toArray();
    for (const row of recent) played.add(videoId(row.url));
    const pick = tracks.find((track) => videoId(track.url) && !played.has(videoId(track.url)));
    return pick ? { id: crypto.randomUUID(), query: pick.url, title: pick.title, durationMs: 0, url: pick.url, requestedBy: "autoplay" } : null;
  }

  private async advance(state: SessionState): Promise<void> {
    if (state.loop !== "track") state.current += 1;
    if (state.current >= state.tracks.length) {
      if (state.loop === "queue" && state.tracks.length) state.current = 0;
      else {
        const next = state.autoplay ? await this.related(state).catch((error: Error) => (console.error("related", error.message), null)) : null;
        if (next) {
          state.tracks.push(next);
          state.current = state.tracks.length - 1;
        } else {
          state.current = state.tracks.length;
          state.positionMs = 0;
          state.idleSince = Date.now();
          await this.save(state);
          return;
        }
      }
    }
    await this.startCurrent(state);
  }

  private async end(state: SessionState): Promise<void> {
    if (state.active) await this.call("/leave").catch(() => undefined);
    state.active = false;
    state.channelId = null;
    state.tracks = [];
    state.current = -1;
    state.positionMs = 0;
    state.paused = false;
    state.autoplay = false;
    state.emptySince = state.idleSince = state.pausedSince = state.lastTick = null;
    await this.save(state);
  }

  private async viewOf(state: SessionState): Promise<View> {
    const { hourLimit } = await this.settings();
    return {
      channelId: state.channelId,
      tracks: state.tracks,
      current: state.current,
      paused: state.paused,
      volume: state.volume,
      loop: state.loop,
      autoplay: state.autoplay,
      autoplayEndsAt: state.autoplay ? state.lastHumanAt + AUTOPLAY_LIMIT_MS : null,
      positionMs: state.positionMs,
      listeners: state.listeners,
      active: state.active,
      hoursThisMonth: await this.hours(),
      hourLimit,
    };
  }

  async view(): Promise<View> {
    return this.viewOf(await this.load());
  }

  async expand(url: string): Promise<{ title: string; url: string }[]> {
    const { tracks } = (await this.call("/expand", { url })) as unknown as { tracks: { title: string; url: string }[] };
    return tracks;
  }

  async enqueue(channelId: string, items: { query: string; title?: string }[], requestedBy: string): Promise<EnqueueResult> {
    const state = await this.load();
    if (!state.active && (await this.hours()) >= (await this.settings()).hourLimit) return { ok: false, reason: "limit" };
    const before = state.tracks.length;
    const position = before - Math.max(state.current, 0);
    const wasPlaying = state.active && state.current >= 0 && state.current < before;
    state.tracks.push(...items.map((item) => ({ id: crypto.randomUUID(), query: item.query, title: item.title ?? displayName(item.query), durationMs: 0, url: null, requestedBy })));
    state.lastHumanAt = Date.now();
    if (!state.active || state.channelId !== channelId) {
      await this.call("/join", { guildId: state.guildId, channelId });
      state.channelId = channelId;
      if (!state.active) {
        state.active = true;
        state.lastTick = Date.now();
        await this.schedule(TICK_SECONDS, "tick");
      }
    }
    if (wasPlaying) {
      await this.save(state);
      if (state.current + 1 === before) await this.call("/prepare", { query: state.tracks[before]!.query });
    } else {
      state.current = before;
      await this.startCurrent(state);
    }
    return { ok: true, added: items.length, position };
  }

  async command(command: Command): Promise<void> {
    const state = await this.load();
    if (!state.active) return;
    state.lastHumanAt = Date.now();
    switch (command.action) {
      case "keepGoing":
        break;
      case "skip":
        await this.call("/halt");
        await this.skip(state);
        return;
      case "pause":
        await this.call("/pause");
        state.paused = true;
        state.pausedSince = Date.now();
        break;
      case "resume":
        await this.call("/resume");
        state.paused = false;
        state.pausedSince = null;
        break;
      case "stop":
        await this.end(state);
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
        await this.startCurrent(state, Math.max(0, command.positionMs));
        return;
      case "volume": {
        state.volume = Math.min(2, Math.max(0, command.volume));
        const position = await this.position(state);
        await this.startCurrent(state, position);
        return;
      }
      case "loop":
        state.loop = command.loop;
        break;
      case "autoplay":
        state.autoplay = command.on;
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
    await this.save(state);
  }

  private async skip(state: SessionState): Promise<void> {
    const looped = state.loop;
    if (looped === "track") state.loop = "off";
    if (looped === "track") {
      await this.advance({ ...state, loop: "off" });
      const after = await this.load();
      after.loop = looped;
      await this.save(after);
      return;
    }
    await this.advance(state);
  }

  private async position(state: SessionState): Promise<number> {
    const status = await this.call("/status").catch(() => undefined);
    return Number(status?.positionMs ?? state.positionMs);
  }

  async event(event: ContainerEvent): Promise<void> {
    const state = await this.load();
    if (!state.active) return;
    if (event.type === "stopping") {
      state.positionMs = event.positionMs;
      await this.save(state);
      return;
    }
    if (event.generation !== state.generation) return;
    if (event.type === "started") {
      const track = state.tracks[state.current];
      if (track) {
        const firstStart = track.url === null || track.requestedBy === "autoplay";
        Object.assign(track, { title: event.title, durationMs: event.durationMs, url: event.url });
        if (firstStart) {
          this.ctx.storage.sql.exec("INSERT INTO history (query, title, url, requested_by, played_at) VALUES (?, ?, ?, ?, ?)", track.query, track.title, track.url, track.requestedBy, Date.now());
          this.ctx.storage.sql.exec("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT ?)", HISTORY_KEPT);
        }
      }
      state.failures = 0;
      await this.save(state);
      return;
    }
    if (event.type === "failed") {
      state.failures += 1;
      console.error("track failed", state.tracks[state.current]?.query, event.error);
      if (state.failures >= MAX_FAILURES_IN_A_ROW) {
        await this.end(state);
        return;
      }
    }
    await this.advance(state);
  }

  async tick(): Promise<void> {
    const state = await this.load();
    if (!state.active) return;
    await this.schedule(TICK_SECONDS, "tick");
    this.renewActivityTimeout();
    const now = Date.now();
    if (state.lastTick) await this.ctx.storage.put(monthKey(), (await this.hours()) + (now - state.lastTick) / 3_600_000);
    state.lastTick = now;
    const status = await this.call("/status").catch(() => undefined);
    if (!status?.connected && state.channelId) {
      await this.call("/join", { guildId: state.guildId, channelId: state.channelId });
      if (state.current >= 0 && state.current < state.tracks.length) await this.startCurrent(state, state.positionMs);
      return;
    }
    if (status && state.current >= 0 && state.current < state.tracks.length) state.positionMs = Number(status.positionMs ?? state.positionMs);
    state.listeners = Number(status?.listeners ?? state.listeners);
    state.emptySince = state.listeners === 0 ? (state.emptySince ?? now) : null;
    const autoplayOver = state.autoplay && (state.listeners === 0 || now - state.lastHumanAt >= AUTOPLAY_LIMIT_MS);
    const expired = autoplayOver || (state.emptySince !== null && now - state.emptySince >= EMPTY_LEAVE_MS) || (state.idleSince !== null && now - state.idleSince >= IDLE_LEAVE_MS) || (state.pausedSince !== null && now - state.pausedSince >= PAUSED_LEAVE_MS);
    if (expired) {
      await this.end(state);
      return;
    }
    await this.save(state);
  }

  async history(): Promise<HistoryEntry[]> {
    return this.ctx.storage.sql.exec<{ id: number; query: string; title: string; url: string | null; requested_by: string; played_at: number }>("SELECT * FROM history ORDER BY id DESC LIMIT 50").toArray().map((row) => ({ id: row.id, query: row.query, title: row.title, url: row.url, requestedBy: row.requested_by, playedAt: row.played_at }));
  }

  async playlists(): Promise<Playlist[]> {
    return this.ctx.storage.sql
      .exec<{ id: string; name: string; owner_id: string; owner_name: string; track_count: number }>("SELECT p.id, p.name, p.owner_id, p.owner_name, COUNT(t.id) AS track_count FROM playlist p LEFT JOIN playlist_track t ON t.playlist_id = p.id GROUP BY p.id ORDER BY p.name COLLATE NOCASE")
      .toArray()
      .map((row) => ({ id: row.id, name: row.name, ownerId: row.owner_id, ownerName: row.owner_name, trackCount: row.track_count }));
  }

  async playlistTracks(id: string): Promise<PlaylistTrack[]> {
    return this.ctx.storage.sql.exec<PlaylistTrack>("SELECT id, query, title FROM playlist_track WHERE playlist_id = ? ORDER BY position", id).toArray();
  }

  private owns(id: string, userId: string): boolean {
    return this.ctx.storage.sql.exec("SELECT 1 FROM playlist WHERE id = ? AND owner_id = ?", id, userId).toArray().length > 0;
  }

  async createPlaylist(name: string, ownerId: string, ownerName: string): Promise<string> {
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec("INSERT INTO playlist (id, name, owner_id, owner_name, created_at) VALUES (?, ?, ?, ?, ?)", id, name.trim().slice(0, 100), ownerId, ownerName, Date.now());
    return id;
  }

  async renamePlaylist(id: string, userId: string, name: string): Promise<boolean> {
    if (!this.owns(id, userId)) return false;
    this.ctx.storage.sql.exec("UPDATE playlist SET name = ? WHERE id = ?", name.trim().slice(0, 100), id);
    return true;
  }

  async deletePlaylist(id: string, userId: string): Promise<boolean> {
    if (!this.owns(id, userId)) return false;
    this.ctx.storage.sql.exec("DELETE FROM playlist_track WHERE playlist_id = ?", id);
    this.ctx.storage.sql.exec("DELETE FROM playlist WHERE id = ?", id);
    return true;
  }

  async addToPlaylist(id: string, userId: string, items: { query: string; title: string }[]): Promise<boolean> {
    if (!this.owns(id, userId)) return false;
    let position = this.ctx.storage.sql.exec<{ top: number }>("SELECT COALESCE(MAX(position), -1) AS top FROM playlist_track WHERE playlist_id = ?", id).one().top;
    for (const item of items) this.ctx.storage.sql.exec("INSERT INTO playlist_track (id, playlist_id, position, query, title) VALUES (?, ?, ?, ?, ?)", crypto.randomUUID(), id, ++position, item.query, item.title);
    return true;
  }

  async removeFromPlaylist(id: string, userId: string, trackId: string): Promise<boolean> {
    if (!this.owns(id, userId)) return false;
    this.ctx.storage.sql.exec("DELETE FROM playlist_track WHERE id = ? AND playlist_id = ?", trackId, id);
    return true;
  }

  async movePlaylistTrack(id: string, userId: string, trackId: string, to: number): Promise<boolean> {
    if (!this.owns(id, userId)) return false;
    const tracks = await this.playlistTracks(id);
    const from = tracks.findIndex((track) => track.id === trackId);
    if (from < 0) return true;
    const [track] = tracks.splice(from, 1);
    tracks.splice(Math.min(tracks.length, Math.max(0, to)), 0, track!);
    tracks.forEach((entry, position) => this.ctx.storage.sql.exec("UPDATE playlist_track SET position = ? WHERE id = ?", position, entry.id));
    return true;
  }
}
