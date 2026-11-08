import { type ChildProcess, execFile, spawn } from "node:child_process";
import { AudioPlayerStatus, type AudioPlayer, type AudioResource, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, StreamType, type VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { client, guild } from "./client.ts";

type Resolved = { title: string; artist: string | null; artwork: string | null; durationMs: number; pageUrl: string; streamUrl: string; userAgent: string };

export type PlayerEvent = { type: "started"; generation: number; title: string; artist: string | null; artwork: string | null; durationMs: number; url: string } | { type: "playing" | "stalled" | "ended" | "failed" | "disconnected"; generation: number; error?: string } | { type: "moved"; generation: number; channelId: string };
export type Status = { connected: boolean; listeners: number; positionMs: number };

const RESOLVE_TTL_MS = 2 * 60 * 60 * 1000;
const PLUGINS = new URL("../yt-dlp-plugins", import.meta.url).pathname;
const MAX_WARMING = 2;
const MAX_RESOLVING = 2;
const MAX_BACKGROUND = 1;
const CUT_SHORT_MS = 5_000;
const STALL_MS = 1_000;
const STALL_LIMIT_MS = 10_000;
const WATCH_MS = 250;
const RECOVER_MS = 5_000;

const cache = new Map<string, Promise<Resolved>>();
const queued: { key: string; urgent: boolean; run: () => void }[] = [];
let resolving = 0;

function admit(): void {
  for (let index = 0; index < queued.length; index++) {
    const entry = queued[index]!;
    if (resolving >= (entry.urgent ? MAX_RESOLVING : MAX_BACKGROUND)) continue;
    queued.splice(index, 1);
    entry.run();
    return admit();
  }
}

function limited<T>(key: string, urgent: boolean, work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      resolving += 1;
      work().then(resolve, reject).finally(() => {
        resolving -= 1;
        admit();
      });
    };
    const entry = { key, urgent, run };
    const at = urgent ? queued.findIndex((other) => !other.urgent) : -1;
    queued.splice(at < 0 ? queued.length : at, 0, entry);
    admit();
  });
}

function hurry(key: string): void {
  const index = queued.findIndex((entry) => entry.key === key && !entry.urgent);
  if (index < 0) return;
  const [entry] = queued.splice(index, 1);
  entry!.urgent = true;
  const at = queued.findIndex((other) => !other.urgent);
  queued.splice(at < 0 ? queued.length : at, 0, entry!);
  admit();
}
let connection: VoiceConnection | undefined;
let player: AudioPlayer | undefined;
let resource: AudioResource | undefined;
let ffmpeg: ChildProcess | undefined;
let channelId = "";
let generation = 0;
let offsetMs = 0;
let listener: (event: PlayerEvent) => void = () => undefined;
let warming = 0;
let playing: { query: string; volume: number; durationMs: number; retried: boolean; error: string } | undefined;
let flowing = false;
let stalled = false;
let progress = { durationMs: -1, at: 0 };

setInterval(() => {
  const status = player?.state.status;
  const now = Date.now();
  if (!resource || !flowing || (status !== AudioPlayerStatus.Playing && status !== AudioPlayerStatus.AutoPaused)) {
    progress.at = now;
    return;
  }
  if (resource.playbackDuration !== progress.durationMs) {
    progress = { durationMs: resource.playbackDuration, at: now };
    if (stalled) {
      stalled = false;
      console.log("audio flowing again", playing?.query);
      emit({ type: "playing", generation });
    }
  } else if (!stalled && now - progress.at >= STALL_MS) {
    stalled = true;
    console.error("audio stalled", playing?.query, status);
    emit({ type: "stalled", generation });
  }
}, WATCH_MS).unref();

export function onPlayerEvent(callback: (event: PlayerEvent) => void): void {
  listener = callback;
}

client.on("voiceStateUpdate", (_before, after) => {
  if (after.id !== client.user?.id || !connection || !after.channelId || after.channelId === channelId) return;
  console.log("moved", channelId, "to", after.channelId);
  channelId = after.channelId;
  emit({ type: "moved", generation, channelId });
});

function emit(event: PlayerEvent): void {
  queueMicrotask(() => listener(event));
}

function resolveTrack(query: string, uncached = false, urgent = false): Promise<Resolved> {
  const cached = cache.get(query);
  if (cached && !uncached) {
    if (urgent) hurry(query);
    return cached;
  }
  const pending = limited(query, urgent, () => new Promise<Resolved>((resolve, reject) => {
    const started = Date.now();
    execFile(
      "yt-dlp",
      ["--plugin-dirs", PLUGINS, "--js-runtimes", "node", ...(uncached ? ["--no-cache-dir"] : []), "--no-playlist", "--playlist-items", "1", "--skip-download", "-f", "bestaudio", "--print", "%(.{title,track,artist,uploader,thumbnail,duration,webpage_url,url,http_headers})j", query],
      { timeout: 60000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error((stderr || error.message).trim().slice(-300)));
        const line = stdout.trim().split("\n").at(-1);
        if (!line) return reject(new Error("no result"));
        if (stderr.trim()) console.error("yt-dlp", query, uncached ? "uncached" : "cached", stderr.trim().slice(-400));
        const info = JSON.parse(line) as { title: string; track?: string; artist?: string; uploader?: string; thumbnail?: string; duration?: number; webpage_url: string; url: string; http_headers?: Record<string, string> };
        console.log("resolved", query, Date.now() - started, "ms", uncached ? "without cache" : "");
        resolve({ title: info.track ?? info.title, artist: info.artist ?? info.uploader?.replace(/ - Topic$/, "") ?? null, artwork: info.thumbnail ?? null, durationMs: (info.duration ?? 0) * 1000, pageUrl: info.webpage_url, streamUrl: info.url, userAgent: info.http_headers?.["User-Agent"] ?? "Mozilla/5.0" });
      },
    );
  }));
  cache.set(query, pending);
  pending.catch(() => cache.delete(query));
  setTimeout(() => cache.delete(query), RESOLVE_TTL_MS);
  return pending;
}

function flatList(url: string, limit: number): Promise<{ title: string; url: string }[]> {
  return limited(url, true, () => new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      ["--plugin-dirs", PLUGINS, "--js-runtimes", "node", "--flat-playlist", "--no-warnings", "--playlist-end", String(limit), "--print", "%(.{title,url,webpage_url})j", url],
      { timeout: 90000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error((stderr || error.message).trim().slice(-300)));
        resolve(
          stdout
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as { title: string; url?: string; webpage_url?: string })
            .map((entry) => ({ title: entry.title, url: entry.webpage_url ?? entry.url ?? "" }))
            .filter((entry) => entry.url),
        );
      },
    );
  }));
}

export const expand = (url: string) => flatList(url, 200);

export function prepare(query: string): void {
  resolveTrack(query).catch((error: Error) => console.error("prepare", error.message));
}

export function playable(query: string): Promise<boolean> {
  return resolveTrack(query).then(() => true, (error: Error) => (console.error("unplayable", query, error.message), false));
}

export function warm(query: string): void {
  if (cache.has(query) || warming >= MAX_WARMING) return;
  warming += 1;
  resolveTrack(query).catch(() => undefined).finally(() => (warming -= 1));
}

function killStream(): void {
  ffmpeg?.kill("SIGKILL");
  ffmpeg = undefined;
}

export function leave(): void {
  generation += 1;
  killStream();
  player?.stop(true);
  connection?.destroy();
  connection = undefined;
  player = undefined;
  resource = undefined;
  channelId = "";
}

export function listenerIds(): string[] {
  if (!channelId) return [];
  const server = client.guilds.cache.first();
  const states = server?.voiceStates.cache.filter((state) => state.channelId === channelId);
  return states ? [...states.values()].filter((state) => !state.member?.user.bot && state.id !== client.user?.id).map((state) => state.id) : [];
}

export async function join(nextChannel: string): Promise<void> {
  if (connection && channelId === nextChannel && connection.state.status === VoiceConnectionStatus.Ready) return;
  const server = await guild();
  connection?.destroy();
  channelId = nextChannel;
  connection = joinVoiceChannel({ guildId: server.id, channelId, adapterCreator: server.voiceAdapterCreator, selfDeaf: true });
  const joined = connection;
  joined.on("error", (error) => console.error("voice", error.message));
  joined.on(VoiceConnectionStatus.Disconnected, () => {
    Promise.race([entersState(joined, VoiceConnectionStatus.Signalling, RECOVER_MS), entersState(joined, VoiceConnectionStatus.Connecting, RECOVER_MS)]).catch(() => {
      if (connection !== joined) return;
      console.error("voice lost", channelId);
      emit({ type: "disconnected", generation });
    });
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 30000);
  player = createAudioPlayer({ behaviors: { maxMissedFrames: STALL_LIMIT_MS / 20 } });
  connection.subscribe(player);
  player.on("error", (error) => console.error("player", error.message));
  player.on(AudioPlayerStatus.Idle, () => {
    if (!resource?.ended || !ffmpeg) return;
    const finished = generation;
    const reached = offsetMs + resource.playbackDuration;
    const song = playing;
    killStream();
    const cut = song !== undefined && song.durationMs > 0 && reached < song.durationMs - CUT_SHORT_MS;
    if (!cut) return emit({ type: "ended", generation: finished });
    console.error("stream cut", song.query, reached, "of", song.durationMs, "ms", song.error);
    cache.delete(song.query);
    if (!song.retried) {
      emit({ type: "stalled", generation: finished });
      return play(song.query, reached, song.volume, finished, true);
    }
    emit({ type: "failed", generation: finished, error: song.error || "stream cut short" });
  });
}

async function start(query: string, startMs: number, volume: number, id: number, retried: boolean): Promise<void> {
  generation = id;
  killStream();
  player?.stop(true);
  resource = undefined;
  flowing = false;
  stalled = false;
  progress = { durationMs: -1, at: 0 };
  const started = Date.now();
  const track = await resolveTrack(query, retried, true);
  if (generation !== id || !player) return;
  const stream = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
    "-user_agent", track.userAgent,
    "-ss", String(startMs / 1000),
    "-i", track.streamUrl,
    "-vn", "-af", `volume=${volume}`, "-ac", "2", "-ar", "48000",
    "-c:a", "libopus", "-b:a", "128k", "-page_duration", "200000", "-f", "ogg", "pipe:1",
  ]);
  const song = { query, volume, durationMs: track.durationMs, retried, error: "" };
  playing = song;
  stream.stderr.on("data", (data: Buffer) => {
    song.error = String(data).replace(/https?:\/\/\S+/g, "<stream>").trim().slice(-300);
    console.error("ffmpeg", query, song.error);
  });
  ffmpeg = stream;
  offsetMs = startMs;
  resource = createAudioResource(stream.stdout, { inputType: StreamType.OggOpus });
  player.play(resource);
  player.once(AudioPlayerStatus.Playing, () => {
    console.log("first audio", query, Date.now() - started, "ms");
    if (generation !== id) return;
    flowing = true;
    emit({ type: "playing", generation: id });
  });
  emit({ type: "started", generation: id, title: track.title, artist: track.artist, artwork: track.artwork, durationMs: track.durationMs, url: track.pageUrl });
}

export function play(query: string, startMs: number, volume: number, id: number, retried = false): void {
  start(query, startMs, volume, id, retried).catch((error: Error) => {
    console.error("play", query, error.message);
    if (generation === id) emit({ type: "failed", generation: id, error: error.message.slice(0, 300) });
  });
}

export const pause = () => void player?.pause();
export const resume = () => void player?.unpause();

export function halt(): void {
  generation += 1;
  killStream();
  player?.stop(true);
  resource = undefined;
}

export function status(): Status {
  return {
    connected: connection?.state.status === VoiceConnectionStatus.Ready,
    listeners: listenerIds().length,
    positionMs: resource ? offsetMs + resource.playbackDuration : 0,
  };
}
