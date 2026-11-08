import { db, getValue, setValue } from "./db.ts";
import { type ArtistRef, artistNames, type Seed, sessionRadio, type Song } from "./music.ts";
import { type Requester, requester } from "./client.ts";
import * as player from "./player.ts";

export type Track = { id: string; query: string; title: string; artist: string | null; artists?: ArtistRef[]; album?: string | null; albumId?: string | null; artwork: string | null; durationMs: number; url: string | null; requestedBy: string; requester?: Requester | null; pickedBy?: AutoplayMode; replacing?: boolean };
export type AutoplayMode = "session" | "explore";
export type Loop = "off" | "track" | "queue";

type State = {
  channelId: string | null;
  tracks: Track[];
  current: number;
  paused: boolean;
  loading: boolean;
  stalled: boolean;
  volume: number;
  loop: Loop;
  autoplay: boolean;
  autoplayMode: AutoplayMode;
  autoplayUpcoming: Track[];
  positionMs: number;
  generation: number;
  listeners: number;
  emptySince: number | null;
  idleSince: number | null;
  pausedSince: number | null;
  lastHumanAt: number;
  active: boolean;
  sessionId: number | null;
  failures: number;
  skipped: Skipped | null;
};

export type View = {
  channelId: string | null;
  tracks: Track[];
  current: number;
  paused: boolean;
  loading: boolean;
  stalled: boolean;
  volume: number;
  loop: Loop;
  autoplay: boolean;
  autoplayMode: AutoplayMode;
  autoplayEndsAt: number | null;
  autoplayUpcoming: Track[];
  positionMs: number;
  listeners: number;
  people: player.Listener[];
  active: boolean;
  skipped: Skipped | null;
};

export type Skipped = { id: string; title: string };

export type Settings = { djRoleId: string | null };
export type HistoryEntry = { id: number; query: string; title: string; url: string | null; requestedBy: string; requester: Requester | null; playedAt: number; artist: string | null; artwork: string | null; durationMs: number };
export type Playlist = { id: string; name: string; ownerId: string; ownerName: string; trackCount: number };
export type PlaylistTrack = { id: string; query: string; title: string };
export type QueueItem = { query: string; title?: string; artist?: string | null; artists?: ArtistRef[]; album?: string | null; albumId?: string | null; artwork?: string | null; durationMs?: number };
export type EnqueueResult = { ok: true; added: number; position: number };

export type Command =
  | { action: "skip" | "previous" | "pause" | "resume" | "stop" | "shuffle" | "clear" | "keepGoing" }
  | { action: "seek"; positionMs: number }
  | { action: "volume"; volume: number }
  | { action: "loop"; loop: Loop }
  | { action: "autoplay"; on: boolean }
  | { action: "autoplayMode"; mode: AutoplayMode }
  | { action: "swapPick"; id: string }
  | { action: "remove"; id: string }
  | { action: "move"; id: string; to: number };

const TICK_MS = 15_000;
const RESTART_WITHIN_MS = 3_000;
const EMPTY_LEAVE_MS = 60_000;
const IDLE_LEAVE_MS = 5 * 60_000;
const PAUSED_LEAVE_MS = 15 * 60_000;
const AUTOPLAY_LIMIT_MS = 60 * 60_000;
const MAX_FAILURES_IN_A_ROW = 5;
const REJOIN_ATTEMPTS = 4;
const HISTORY_KEPT = 20_000;
const PREPARED_AHEAD = 3;
const HUMAN_SEEDS = 5;
const AUTOPLAY_SEEDS = 2;
const ARTIST_COOLDOWN = 3;
const AUTOPLAY_AHEAD = 3;
const AUTOPLAY_SEED_WEIGHT = 0.3;
const STALE_AFTER_NEW_SEEDS = 3;
const LENGTH_MISMATCH_MS = 20_000;
const EXPLORE_SEEDS = 12;
const EXPLORE_SEEDS_PER_LISTENER = 3;
const SUGGESTIONS = 20;
const SUGGESTIONS_KEPT_MS = 10 * 60_000;

const blank = (): State => ({
  channelId: null,
  tracks: [],
  current: -1,
  paused: false,
  loading: false,
  stalled: false,
  volume: 1,
  loop: "off",
  autoplay: false,
  autoplayMode: "session",
  autoplayUpcoming: [],
  positionMs: 0,
  generation: 0,
  listeners: 0,
  emptySince: null,
  idleSince: null,
  pausedSince: null,
  lastHumanAt: 0,
  active: false,
  sessionId: null,
  failures: 0,
  skipped: null,
});

export function displayName(query: string): string {
  const search = query.match(/^https:\/\/music\.youtube\.com\/search\?q=([^#]+)/)?.[1];
  return search ? decodeURIComponent(search) : query;
}

function videoId(url: string | null): string | null {
  return url?.match(/[?&]v=([\w-]{11})/)?.[1] ?? null;
}

const state: State = { ...blank(), ...getValue<State>("state") };

function openSession(): void {
  state.sessionId = Number(db.prepare("INSERT INTO listening_session (started_at) VALUES (?)").run(Date.now()).lastInsertRowid);
}

if (state.active && !state.sessionId) openSession();
const watchers = new Set<(view: View) => void>();
let ticker: ReturnType<typeof setInterval> | undefined;
let cold = true;
let rejoinFailures = 0;

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

const playing = () => state.active && state.current >= 0 && state.current < state.tracks.length;

function livePosition(): number {
  return playing() && !state.loading && !state.stalled && !cold ? player.status().positionMs : state.positionMs;
}

function prepareAhead(): void {
  if (!playing() || state.loading) return;
  for (const track of state.tracks.slice(Math.max(0, state.current - 1), state.current + 1 + PREPARED_AHEAD)) player.prepare(track.query);
  const room = state.current + 1 + PREPARED_AHEAD - state.tracks.length;
  if (state.autoplay && room > 0) for (const pick of state.autoplayUpcoming.slice(0, room)) if (!pick.replacing) void verify(pick);
}

export function view(): View {
  return {
    channelId: state.channelId,
    tracks: state.tracks,
    current: state.current,
    paused: state.paused,
    loading: playing() && state.loading,
    stalled: playing() && !state.loading && state.stalled,
    volume: state.volume,
    loop: state.loop,
    autoplay: state.autoplay,
    autoplayMode: state.autoplayMode,
    autoplayEndsAt: state.autoplay ? state.lastHumanAt + AUTOPLAY_LIMIT_MS : null,
    autoplayUpcoming: state.autoplay ? state.autoplayUpcoming : [],
    positionMs: livePosition(),
    listeners: state.listeners,
    people: state.active ? player.listeners() : [],
    active: state.active,
    skipped: state.skipped,
  };
}

function restartAt(offsetMs: number): void {
  if (!state.paused) return startCurrent(offsetMs);
  player.halt();
  state.positionMs = offsetMs;
  state.loading = false;
  state.stalled = false;
  cold = true;
  save();
}

function startCurrent(offsetMs = 0): void {
  const track = state.tracks[state.current];
  if (!track) return;
  cold = false;
  state.generation += 1;
  state.positionMs = offsetMs;
  state.paused = false;
  state.loading = true;
  state.stalled = false;
  state.pausedSince = null;
  state.idleSince = null;
  save();
  player.play(track.query, offsetMs, state.volume, state.generation);
}

function radioSeeds(): Seed[] {
  const seeds: Seed[] = [];
  let humans = 0;
  let autoplays = 0;
  for (const track of [...state.tracks].reverse()) {
    const id = videoId(track.url) ?? videoId(track.query);
    if (!id || seeds.some((seed) => seed.videoId === id)) continue;
    if (track.requestedBy === "autoplay") {
      if (autoplays < AUTOPLAY_SEEDS) seeds.push({ videoId: id, weight: AUTOPLAY_SEED_WEIGHT / ++autoplays });
    } else if (humans < HUMAN_SEEDS) seeds.push({ videoId: id, weight: 1 / ++humans });
    if (humans === HUMAN_SEEDS && autoplays === AUTOPLAY_SEEDS) break;
  }
  return seeds;
}

function humanSeedIds(): string[] {
  const ids: string[] = [];
  for (const track of [...state.tracks].reverse()) {
    if (track.requestedBy === "autoplay") continue;
    const id = videoId(track.url) ?? videoId(track.query);
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length === HUMAN_SEEDS) break;
  }
  return ids;
}

function sample<T extends { plays: number }>(pool: T[], count: number): T[] {
  const left = [...pool];
  const chosen: T[] = [];
  while (chosen.length < count && left.length) {
    let roll = Math.random() * left.reduce((total, entry) => total + entry.plays, 0);
    const index = Math.max(0, left.findIndex((entry) => (roll -= entry.plays) < 0));
    chosen.push(...left.splice(index, 1));
  }
  return chosen;
}

function exploreSeeds(): Seed[] {
  const listeners = player.listenerIds().sort(() => Math.random() - 0.5);
  const each = Math.max(1, Math.min(EXPLORE_SEEDS_PER_LISTENER, Math.floor(EXPLORE_SEEDS / Math.max(1, listeners.length))));
  const asked = db.prepare("SELECT url, COUNT(*) AS plays FROM history WHERE requested_by = ? AND url IS NOT NULL GROUP BY url");
  const weights = new Map<string, number>();
  let tasted = 0;
  for (const listener of listeners) {
    if (weights.size >= EXPLORE_SEEDS) break;
    const songs = (asked.all(listener) as { url: string; plays: number }[]).flatMap((row) => {
      const id = videoId(row.url);
      return id ? [{ id, plays: row.plays }] : [];
    });
    const chosen = sample(songs, each);
    if (chosen.length) tasted += 1;
    for (const song of chosen) weights.set(song.id, (weights.get(song.id) ?? 0) + 1 / chosen.length);
  }
  console.log("explore seeds", JSON.stringify({ listeners: listeners.length, tasted, seeds: weights.size }));
  return [...weights].map(([id, weight]) => ({ videoId: id, weight }));
}

function playedIds(): Set<string> {
  const played = new Set<string>();
  for (const track of state.tracks) played.add(videoId(track.url) ?? videoId(track.query) ?? "");
  for (const row of db.prepare("SELECT url FROM history ORDER BY id DESC LIMIT 100").all() as { url: string | null }[]) played.add(videoId(row.url) ?? "");
  return played;
}

let suggested: { key: string; at: number; songs: Promise<Song[]> } | null = null;

export function suggestions(): Promise<Song[]> {
  const seeds = radioSeeds();
  if (!seeds.length) return Promise.resolve([]);
  const key = seeds.map((seed) => seed.videoId).join(",");
  if (suggested?.key === key && Date.now() - suggested.at < SUGGESTIONS_KEPT_MS) return filterSuggestions(suggested.songs);
  const songs = sessionRadio(seeds, new Set(), []);
  suggested = { key, at: Date.now(), songs };
  songs.catch(() => (suggested = null));
  return filterSuggestions(songs);
}

async function filterSuggestions(songs: Promise<Song[]>): Promise<Song[]> {
  const played = playedIds();
  const artists = new Set<string>();
  const picked: Song[] = [];
  for (const song of await songs) {
    const names = artistNames(song.artist);
    if (played.has(song.videoId) || names.some((name) => artists.has(name))) continue;
    names.forEach((name) => artists.add(name));
    picked.push(song);
    if (picked.length === SUGGESTIONS) break;
  }
  return picked;
}

const unplayable = new Set<string>();
const declined = new Set<string>();
let planToken = 0;
let planning: { token: number; done: Promise<void> } | null = null;
let refillAt: number | null = null;
const pickBasis = new Map<string, string[]>();

function refreshStalePicks(): void {
  if (!state.autoplay || state.loop !== "off") return;
  const seeds = humanSeedIds();
  const queued = Math.max(0, state.tracks.length - state.current - 1);
  const stale: Track[] = [];
  state.autoplayUpcoming.forEach((pick, index) => {
    if (pick.replacing || queued + index < PREPARED_AHEAD) return;
    const basis = pickBasis.get(pick.id);
    if (!basis) return void pickBasis.set(pick.id, seeds);
    if (seeds.filter((id) => !basis.includes(id)).length >= STALE_AFTER_NEW_SEEDS) stale.push(pick);
  });
  if (!stale.length) return;
  for (const pick of stale) pick.replacing = true;
  console.log("autoplay refresh", JSON.stringify({ stale: stale.length, queued }));
  save();
  restartPlan();
}

async function verify(pick: Track): Promise<void> {
  if (await player.playable(pick.query)) return;
  unplayable.add(videoId(pick.url) ?? pick.query);
  dropPick(pick.id);
}

function dropPick(id: string): void {
  const index = state.autoplayUpcoming.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  state.autoplayUpcoming.splice(index, 1);
  refillAt = Math.min(refillAt ?? index, index);
  save();
  restartPlan();
}

async function radioPicks(count: number, kept: Track[]): Promise<Track[]> {
  if (count <= 0) return [];
  const mode = state.autoplayMode;
  const explored = mode === "explore" ? exploreSeeds() : [];
  const pickedBy: AutoplayMode = explored.length ? "explore" : "session";
  const seeds = explored.length ? explored : radioSeeds();
  if (!seeds.length) return [];
  const exclude = playedIds();
  for (const seed of explored) exclude.add(seed.videoId);
  for (const id of unplayable) exclude.add(id);
  for (const id of declined) exclude.add(id);
  for (const track of kept) exclude.add(videoId(track.url) ?? "");
  const recent = [...state.tracks, ...kept].slice(-ARTIST_COOLDOWN).flatMap((track) => artistNames(track.artist));
  const ranked = await sessionRadio(seeds, exclude, recent);
  const picks: Track[] = [];
  const pool = [...ranked];
  while (picks.length < count && pool.length) {
    const window = new Set([...recent, ...picks.flatMap((track) => artistNames(track.artist))].slice(-ARTIST_COOLDOWN * 2));
    const index = Math.max(0, pool.findIndex((song) => !artistNames(song.artist).some((name) => window.has(name))));
    const [song] = pool.splice(index, 1);
    picks.push({ id: crypto.randomUUID(), query: song!.url, title: song!.title, artist: song!.artist || null, artists: song!.artists ?? [], album: song!.album, albumId: song!.albumId ?? null, artwork: song!.artwork, durationMs: song!.durationMs, url: song!.url, requestedBy: "autoplay", pickedBy });
  }
  return picks;
}

function planAutoplay(): Promise<void> {
  if (planning?.token === planToken) return planning.done;
  const token = planToken;
  const done = (async () => {
    if (!state.active || !state.autoplay || !state.tracks.length) return;
    const kept = state.autoplayUpcoming.filter((entry) => !entry.replacing);
    const picks = await radioPicks(AUTOPLAY_AHEAD - kept.length, kept).catch((error: Error) => (console.error("related", error.message), []));
    if (token !== planToken || !state.active || !state.autoplay) return;
    const played = playedIds();
    const usable = picks.filter((pick) => !played.has(videoId(pick.url) ?? "") && !state.autoplayUpcoming.some((entry) => !entry.replacing && entry.url === pick.url));
    if (!usable.length) {
      if (!state.autoplayUpcoming.some((entry) => entry.replacing)) return;
      state.autoplayUpcoming = state.autoplayUpcoming.filter((entry) => !entry.replacing);
      save();
      return;
    }
    const seeds = humanSeedIds();
    for (const pick of usable) pickBasis.set(pick.id, seeds);
    const next = state.autoplayUpcoming.flatMap((entry) => (entry.replacing ? (usable.length ? [usable.shift()!] : []) : [entry]));
    if (refillAt !== null && usable.length) next.splice(Math.min(refillAt, next.length), 0, usable.shift()!);
    refillAt = null;
    state.autoplayUpcoming = [...next, ...usable].slice(0, AUTOPLAY_AHEAD);
    for (const id of pickBasis.keys()) if (!state.autoplayUpcoming.some((pick) => pick.id === id)) pickBasis.delete(id);
    save();
    prepareAhead();
  })().finally(() => {
    if (planning?.token === token) planning = null;
  });
  planning = { token, done };
  return done;
}

function restartPlan(): void {
  planToken += 1;
  plan();
}

const plan = () => void planAutoplay();

async function advance(): Promise<void> {
  if (state.loop !== "track") state.current += 1;
  if (state.current >= state.tracks.length) {
    if (state.loop === "queue" && state.tracks.length) state.current = 0;
    else {
      state.autoplayUpcoming = state.autoplayUpcoming.filter((entry) => !entry.replacing);
      if (state.autoplay && !state.autoplayUpcoming.length) await planAutoplay();
      const next = state.autoplay ? (state.autoplayUpcoming.shift() ?? null) : null;
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
  if (state.sessionId) db.prepare("UPDATE listening_session SET ended_at = ? WHERE id = ?").run(Date.now(), state.sessionId);
  if (ticker) clearInterval(ticker);
  ticker = undefined;
  Object.assign(state, { ...blank(), volume: state.volume, loop: state.loop, autoplayMode: state.autoplayMode, generation: state.generation, lastHumanAt: state.lastHumanAt });
  save();
}

function startTicking(): void {
  if (!ticker) ticker = setInterval(() => void tick().catch((error: Error) => console.error("tick", error.message)), TICK_MS);
}

export async function expand(url: string): Promise<{ title: string; url: string }[]> {
  return player.expand(url);
}

const REF_ID = /^UC[\w-]{22}$/;
const ALBUM_ID = /^MPRE[\w-]+$/;

function albumAndArtists(item: QueueItem): Pick<Track, "artists" | "album" | "albumId"> {
  const artists = Array.isArray(item.artists) ? item.artists.filter((ref) => REF_ID.test(String(ref?.id)) && typeof ref.name === "string").slice(0, 8).map((ref) => ({ id: ref.id, name: ref.name.slice(0, 200) })) : [];
  return { artists, album: typeof item.album === "string" ? item.album.slice(0, 300) : null, albumId: typeof item.albumId === "string" && ALBUM_ID.test(item.albumId) ? item.albumId : null };
}

export async function enqueue(channelId: string, items: QueueItem[], requestedBy: string): Promise<EnqueueResult> {
  const who = await requester(requestedBy);
  const before = state.tracks.length;
  const position = before - Math.max(state.current, 0);
  const wasPlaying = state.active && state.current >= 0 && state.current < before;
  state.tracks.push(...items.map((item) => ({ id: crypto.randomUUID(), query: item.query, title: item.title ?? displayName(item.query), artist: item.artist ?? null, ...albumAndArtists(item), artwork: item.artwork ?? null, durationMs: item.durationMs ?? 0, url: null, requestedBy, requester: who })));
  state.lastHumanAt = Date.now();
  if (!state.active || state.channelId !== channelId) {
    await player.join(channelId);
    if (!state.active) openSession();
    state.channelId = channelId;
    state.active = true;
    startTicking();
  }
  if (wasPlaying) {
    save();
    prepareAhead();
  } else {
    state.current = before;
    startCurrent();
  }
  refreshStalePicks();
  plan();
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
    case "previous":
      if (livePosition() <= RESTART_WITHIN_MS && state.current > 0) state.current -= 1;
      startCurrent(0);
      prepareAhead();
      plan();
      return;
    case "pause":
      state.positionMs = livePosition();
      player.pause();
      state.paused = true;
      state.pausedSince = Date.now();
      break;
    case "resume":
      if (cold) {
        startCurrent(state.positionMs);
        break;
      }
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
      restartAt(livePosition());
      return;
    case "loop":
      state.loop = command.loop;
      break;
    case "autoplay":
      state.autoplay = command.on;
      state.autoplayUpcoming = [];
      refillAt = null;
      if (command.on) restartPlan();
      break;
    case "autoplayMode":
      if (command.mode !== "session" && command.mode !== "explore") return;
      state.autoplayMode = command.mode;
      restartPlan();
      break;
    case "swapPick": {
      const pick = state.autoplayUpcoming.find((entry) => entry.id === command.id);
      if (!pick) return;
      if (pick.replacing) return;
      declined.add(videoId(pick.url) ?? pick.query);
      pick.replacing = true;
      save();
      restartPlan();
      return;
    }
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
  prepareAhead();
  refreshStalePicks();
  plan();
}

let rejoining = false;

async function rejoin(): Promise<void> {
  if (rejoining || !state.active || !state.channelId) return;
  rejoining = true;
  try {
    const position = livePosition();
    await player.join(state.channelId);
    rejoinFailures = 0;
    if (playing()) restartAt(position);
  } catch (error) {
    rejoinFailures += 1;
    console.error("rejoin", rejoinFailures, "of", REJOIN_ATTEMPTS, (error as Error).message);
    if (rejoinFailures >= REJOIN_ATTEMPTS) {
      rejoinFailures = 0;
      end();
    }
  } finally {
    rejoining = false;
  }
}

player.onPlayerEvent((event) => {
  if (event.type === "disconnected") {
    void rejoin();
    return;
  }
  if (event.type === "moved") {
    if (!state.active) return;
    state.channelId = event.channelId;
    state.listeners = player.status().listeners;
    save();
    return;
  }
  if (event.type === "listeners") {
    if (!state.active) return;
    state.listeners = player.status().listeners;
    save();
    return;
  }
  if (!state.active || event.generation !== state.generation) return;
  if (event.type === "stalled") {
    if (state.loading || state.stalled) return;
    state.positionMs = player.status().positionMs;
    state.stalled = true;
    save();
    return;
  }
  if (event.type === "playing") {
    state.loading = false;
    state.stalled = false;
    state.skipped = null;
    save();
    prepareAhead();
    return;
  }
  if (event.type === "started") {
    const track = state.tracks[state.current];
    if (track) {
      const firstStart = track.url === null || track.requestedBy === "autoplay";
      const placeholder = !track.title || track.title === track.query || track.title === displayName(track.query);
      if (track.durationMs > 0 && event.durationMs > 0 && Math.abs(track.durationMs - event.durationMs) > LENGTH_MISMATCH_MS) console.log("resolved length differs", JSON.stringify({ query: track.query, title: track.title, resolved: event.title, queuedMs: track.durationMs, resolvedMs: event.durationMs }));
      Object.assign(track, { title: placeholder ? event.title : track.title, artist: track.artist ?? event.artist, album: track.album ?? event.album, artwork: track.artwork ?? event.artwork, durationMs: event.durationMs || track.durationMs, url: event.url });
      if (firstStart) {
        db.prepare("INSERT INTO history (query, title, url, requested_by, played_at, artist, artwork, duration_ms, requester_name, requester_avatar, session_id, picked_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(track.query, track.title, track.url, track.requestedBy, Date.now(), track.artist, track.artwork, track.durationMs, track.requester?.name ?? null, track.requester?.avatar ?? null, state.sessionId, track.pickedBy ?? null);
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
    const failed = state.tracks[state.current];
    if (failed) state.skipped = { id: crypto.randomUUID(), title: failed.title };
    console.error("track failed", failed?.query, event.error);
    if (state.failures >= MAX_FAILURES_IN_A_ROW) return end();
  }
  void advance();
});

async function tick(): Promise<void> {
  if (!state.active) return;
  const now = Date.now();
  const status = player.status();
  if (!status.connected && state.channelId) return rejoin();
  if (playing() && !state.loading && !state.stalled && !cold) state.positionMs = status.positionMs;
  state.listeners = status.listeners;
  state.emptySince = state.listeners === 0 ? (state.emptySince ?? now) : null;
  const autoplayOver = state.autoplay && (state.listeners === 0 || now - state.lastHumanAt >= AUTOPLAY_LIMIT_MS);
  const expired = autoplayOver || (state.emptySince !== null && now - state.emptySince >= EMPTY_LEAVE_MS) || (state.idleSince !== null && now - state.idleSince >= IDLE_LEAVE_MS) || (state.pausedSince !== null && now - state.pausedSince >= PAUSED_LEAVE_MS);
  if (expired) return end();
  save();
}

export function snapshot(): void {
  state.positionMs = livePosition();
  setValue("state", state);
}

export async function resumeAfterRestart(): Promise<void> {
  if (!state.active || !state.channelId) return;
  startTicking();
  await rejoin();
}

export function history(): HistoryEntry[] {
  return (db.prepare("SELECT * FROM history ORDER BY id DESC LIMIT 50").all() as { id: number; query: string; title: string; url: string | null; requested_by: string; played_at: number; artist: string | null; artwork: string | null; duration_ms: number; requester_name: string | null; requester_avatar: string | null }[]).map((row) => ({ id: row.id, query: row.query, title: row.title, url: row.url, requestedBy: row.requested_by, requester: row.requester_name ? { name: row.requester_name, avatar: row.requester_avatar } : null, playedAt: row.played_at, artist: row.artist, artwork: row.artwork, durationMs: row.duration_ms }));
}

type HistoryRow = { id: number; query: string; title: string; url: string | null; requested_by: string; played_at: number; artist: string | null; artwork: string | null; duration_ms: number; requester_name: string | null; requester_avatar: string | null; picked_by: string | null };

export type SessionTrack = HistoryEntry & { pickedBy: AutoplayMode | null };
export type SessionSummary = { id: number; startedAt: number; endedAt: number | null; live: boolean; songs: number; autoplay: number; requesters: { id: string; name: string; avatar: string | null; songs: number }[]; artworks: string[] };

export function sessionTracks(id: number): SessionTrack[] {
  const seen = new Set<string>();
  return (db.prepare("SELECT * FROM history WHERE session_id = ? ORDER BY played_at, id").all(id) as HistoryRow[]).flatMap((row) => {
    const key = row.url ?? row.query;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: row.id, query: row.query, title: row.title, url: row.url, requestedBy: row.requested_by, requester: row.requester_name ? { name: row.requester_name, avatar: row.requester_avatar } : null, playedAt: row.played_at, artist: row.artist, artwork: row.artwork, durationMs: row.duration_ms, pickedBy: row.picked_by === "explore" || row.picked_by === "session" ? row.picked_by : null }];
  });
}

export function sessions(limit = 30): SessionSummary[] {
  const rows = db.prepare("SELECT s.id, s.started_at, s.ended_at FROM listening_session s WHERE EXISTS (SELECT 1 FROM history h WHERE h.session_id = s.id) ORDER BY s.started_at DESC LIMIT ?").all(limit) as { id: number; started_at: number; ended_at: number | null }[];
  return rows.map((row) => {
    const tracks = sessionTracks(row.id);
    const requesters = new Map<string, { id: string; name: string; avatar: string | null; songs: number }>();
    for (const track of tracks) {
      if (track.requestedBy === "autoplay") continue;
      const entry = requesters.get(track.requestedBy) ?? { id: track.requestedBy, name: track.requester?.name ?? "", avatar: track.requester?.avatar ?? null, songs: 0 };
      entry.songs += 1;
      if (!entry.name && track.requester) Object.assign(entry, track.requester);
      requesters.set(track.requestedBy, entry);
    }
    const live = state.active && row.id === state.sessionId;
    return { id: row.id, startedAt: row.started_at, endedAt: live ? null : (row.ended_at ?? tracks.at(-1)?.playedAt ?? row.started_at), live, songs: tracks.length, autoplay: tracks.filter((track) => track.requestedBy === "autoplay").length, requesters: [...requesters.values()].sort((a, b) => b.songs - a.songs), artworks: tracks.flatMap((track) => (track.artwork ? [track.artwork] : [])).slice(0, 4) };
  });
}

const sessionItems = (id: number) => sessionTracks(id).map((track) => ({ query: track.url ?? track.query, title: [track.artist, track.title].filter(Boolean).join(" - ") }));

export function playlistFromSession(sessionId: number, name: string, ownerId: string, ownerName: string): { id: string; added: number } | null {
  const items = sessionItems(sessionId);
  if (!items.length) return null;
  const id = createPlaylist(name, ownerId, ownerName);
  addToPlaylist(id, ownerId, items);
  return { id, added: items.length };
}

export function mergeSession(playlistId: string, userId: string, sessionId: number): { added: number; skipped: number } | null {
  if (!owns(playlistId, userId)) return null;
  const have = new Set(playlistTracks(playlistId).map((track) => track.query));
  const items = sessionItems(sessionId);
  const fresh = items.filter((item) => !have.has(item.query));
  addToPlaylist(playlistId, userId, fresh);
  return { added: fresh.length, skipped: items.length - fresh.length };
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
