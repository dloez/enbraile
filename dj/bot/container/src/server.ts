import { type ChildProcess, execFile, spawn } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import { AudioPlayerStatus, type AudioPlayer, type AudioResource, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, StreamType, type VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";

type Resolved = { title: string; durationMs: number; pageUrl: string; streamUrl: string; userAgent: string; at: number };

const RESOLVE_TTL_MS = 30 * 60 * 1000;
const token = process.env.DISCORD_BOT_TOKEN ?? "";
const workerUrl = process.env.WORKER_URL ?? "";
const internalSecret = process.env.INTERNAL_SECRET ?? "";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const ready = new Promise<void>((resolve) => client.once("clientReady", () => resolve()));
client.on("error", (error) => console.error("gateway", error.message));
void client.login(token);

const cache = new Map<string, Promise<Resolved>>();
let connection: VoiceConnection | undefined;
let player: AudioPlayer | undefined;
let resource: AudioResource | undefined;
let ffmpeg: ChildProcess | undefined;
let guildId = "";
let channelId = "";
let generation = 0;
let offsetMs = 0;
let current: Resolved | undefined;

function send(event: Record<string, unknown>): void {
  void fetch(`${workerUrl}/internal/event`, {
    method: "POST",
    headers: { authorization: `Bearer ${internalSecret}`, "content-type": "application/json" },
    body: JSON.stringify(event),
  }).catch((error: Error) => console.error("event", error.message));
}

function resolveTrack(query: string): Promise<Resolved> {
  const cached = cache.get(query);
  if (cached) return cached;
  const started = Date.now();
  const pending = new Promise<Resolved>((resolve, reject) => {
    execFile(
      "yt-dlp",
      ["--js-runtimes", "node", "--no-playlist", "--no-warnings", "--skip-download", "-f", "bestaudio", "--print", "%(.{title,duration,webpage_url,url,http_headers})j", query],
      { timeout: 60000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error((stderr || error.message).trim().slice(-300)));
        const line = stdout.trim().split("\n").at(-1);
        if (!line) return reject(new Error("no result"));
        const info = JSON.parse(line) as { title: string; duration?: number; webpage_url: string; url: string; http_headers?: Record<string, string> };
        console.log("resolved", query, Date.now() - started, "ms");
        resolve({ title: info.title, durationMs: (info.duration ?? 0) * 1000, pageUrl: info.webpage_url, streamUrl: info.url, userAgent: info.http_headers?.["User-Agent"] ?? "Mozilla/5.0", at: Date.now() });
      },
    );
  });
  cache.set(query, pending);
  pending.catch(() => cache.delete(query));
  setTimeout(() => cache.delete(query), RESOLVE_TTL_MS);
  return pending;
}

function flatList(url: string, limit: number): Promise<{ title: string; url: string }[]> {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      ["--js-runtimes", "node", "--flat-playlist", "--no-warnings", "--playlist-end", String(limit), "--print", "%(.{title,url,webpage_url})j", url],
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
  });
}

function killStream(): void {
  ffmpeg?.kill("SIGKILL");
  ffmpeg = undefined;
}

function leave(): void {
  generation += 1;
  killStream();
  player?.stop(true);
  connection?.destroy();
  connection = undefined;
  player = undefined;
  resource = undefined;
  current = undefined;
  channelId = "";
}

function listeners(): number {
  if (!guildId || !channelId) return 0;
  const channel = client.guilds.cache.get(guildId)?.voiceStates.cache.filter((state) => state.channelId === channelId);
  return channel ? [...channel.values()].filter((state) => !state.member?.user.bot && state.id !== client.user?.id).length : 0;
}

async function join(nextGuild: string, nextChannel: string): Promise<void> {
  await ready;
  if (connection && channelId === nextChannel && connection.state.status === VoiceConnectionStatus.Ready) return;
  const guild = await client.guilds.fetch(nextGuild);
  await guild.members.fetchMe();
  connection?.destroy();
  guildId = nextGuild;
  channelId = nextChannel;
  connection = joinVoiceChannel({ guildId, channelId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true });
  connection.on("error", (error) => console.error("voice", error.message));
  await entersState(connection, VoiceConnectionStatus.Ready, 30000);
  player = createAudioPlayer();
  connection.subscribe(player);
  player.on("error", (error) => console.error("player", error.message));
  player.on(AudioPlayerStatus.Idle, () => {
    if (resource?.ended && ffmpeg) {
      const finished = generation;
      killStream();
      send({ type: "ended", generation: finished });
    }
  });
}

async function play(query: string, startMs: number, volume: number, id: number): Promise<void> {
  generation = id;
  killStream();
  const started = Date.now();
  const track = await resolveTrack(query);
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
  stream.stderr.on("data", (data: Buffer) => console.error("ffmpeg", String(data).slice(0, 200)));
  ffmpeg = stream;
  offsetMs = startMs;
  current = track;
  resource = createAudioResource(stream.stdout, { inputType: StreamType.OggOpus });
  player.play(resource);
  player.once(AudioPlayerStatus.Playing, () => console.log("first audio", query, Date.now() - started, "ms"));
  send({ type: "started", generation: id, title: track.title, durationMs: track.durationMs, url: track.pageUrl });
}

function status(): Record<string, unknown> {
  return {
    connected: connection?.state.status === VoiceConnectionStatus.Ready,
    channelId,
    listeners: listeners(),
    player: player?.state.status ?? null,
    positionMs: resource ? offsetMs + resource.playbackDuration : 0,
    title: current?.title ?? null,
  };
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>) : {};
}

createServer(async (request, response) => {
  const reply = (value: unknown, code = 200) => {
    response.writeHead(code, { "content-type": "application/json" });
    response.end(JSON.stringify(value));
  };
  try {
    const path = new URL(request.url ?? "/", "http://container").pathname;
    const input = await body(request);
    if (path === "/join") {
      await join(String(input.guildId), String(input.channelId));
      return reply(status());
    }
    if (path === "/play") {
      const id = Number(input.generation);
      const query = String(input.query);
      play(query, Number(input.offsetMs ?? 0), Number(input.volume ?? 1), id).catch((error: Error) => {
        console.error("play", query, error.message);
        if (generation === id) send({ type: "failed", generation: id, error: error.message.slice(0, 300) });
      });
      return reply({ accepted: true });
    }
    if (path === "/prepare") {
      resolveTrack(String(input.query)).catch((error: Error) => console.error("prepare", error.message));
      return reply({ accepted: true });
    }
    if (path === "/expand") {
      return reply({ tracks: await flatList(String(input.url), 200) });
    }
    if (path === "/related") {
      const id = String(input.videoId);
      return reply({ tracks: await flatList(`https://www.youtube.com/watch?v=${id}&list=RD${id}`, 25) });
    }
    if (path === "/pause") {
      player?.pause();
      return reply(status());
    }
    if (path === "/resume") {
      player?.unpause();
      return reply(status());
    }
    if (path === "/halt") {
      generation += 1;
      killStream();
      player?.stop(true);
      resource = undefined;
      current = undefined;
      return reply(status());
    }
    if (path === "/leave") {
      leave();
      return reply({ left: true });
    }
    reply(status());
  } catch (error) {
    reply({ error: (error as Error).message }, 500);
  }
}).listen(8080);

process.on("SIGTERM", () => {
  send({ type: "stopping", positionMs: resource ? offsetMs + resource.playbackDuration : 0 });
  setTimeout(() => process.exit(0), 1000);
});
