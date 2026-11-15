import { type AudioPlayer, entersState, joinVoiceChannel, type VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { client, guild } from "./discord.ts";

export type VoiceEvent = { type: "lost" | "rejoined" | "gone" | "members" } | { type: "moved"; channelId: string };
export type Member = { id: string; name: string; avatar: string | null };

const RECOVER_MS = 5_000;
const READY_MS = 30_000;
const CHECK_MS = 15_000;
const REJOIN_ATTEMPTS = 4;

const leases = new Set<string>();
const watchers = new Set<(event: VoiceEvent) => void>();
let connection: VoiceConnection | undefined;
let channelId = "";
let output: AudioPlayer | undefined;
let lost = false;
let rejoining = false;
let failures = 0;

function emit(event: VoiceEvent): void {
  for (const watcher of watchers) queueMicrotask(() => watcher(event));
}

export function watch(watcher: (event: VoiceEvent) => void): () => void {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

export const connected = () => connection?.state.status === VoiceConnectionStatus.Ready;
export const channel = () => channelId || null;

async function connect(): Promise<void> {
  const server = await guild();
  connection?.destroy();
  connection = joinVoiceChannel({ guildId: server.id, channelId, adapterCreator: server.voiceAdapterCreator, selfDeaf: true });
  const joined = connection;
  joined.on("error", (error) => console.error("voice", error.message));
  joined.on(VoiceConnectionStatus.Disconnected, () => {
    Promise.race([entersState(joined, VoiceConnectionStatus.Signalling, RECOVER_MS), entersState(joined, VoiceConnectionStatus.Connecting, RECOVER_MS)]).catch(() => {
      if (connection !== joined) return;
      console.error("voice lost", channelId);
      void rejoin();
    });
  });
  await entersState(joined, VoiceConnectionStatus.Ready, READY_MS);
  if (output) joined.subscribe(output);
}

async function rejoin(): Promise<void> {
  if (rejoining || !leases.size || !channelId) return;
  rejoining = true;
  if (!lost) {
    lost = true;
    emit({ type: "lost" });
  }
  try {
    await connect();
    failures = 0;
    lost = false;
    emit({ type: "rejoined" });
  } catch (error) {
    failures += 1;
    console.error("rejoin", failures, "of", REJOIN_ATTEMPTS, (error as Error).message);
    if (failures >= REJOIN_ATTEMPTS) {
      leases.clear();
      disconnect();
      emit({ type: "gone" });
    }
  } finally {
    rejoining = false;
  }
}

function disconnect(): void {
  connection?.destroy();
  connection = undefined;
  channelId = "";
  lost = false;
  failures = 0;
}

export async function hold(owner: string, nextChannel: string): Promise<void> {
  leases.add(owner);
  if (connection && channelId === nextChannel && connected()) return;
  channelId = nextChannel;
  try {
    await connect();
    lost = false;
    failures = 0;
  } catch (error) {
    lost = true;
    throw error;
  }
}

export function release(owner: string): void {
  leases.delete(owner);
  if (!leases.size) disconnect();
}

export function play(player: AudioPlayer): void {
  output = player;
  if (connection) connection.subscribe(player);
}

export function members(): Member[] {
  if (!channelId) return [];
  const server = client.guilds.cache.first();
  const states = server?.voiceStates.cache.filter((state) => state.channelId === channelId && state.id !== client.user?.id && !state.member?.user.bot);
  return states ? [...states.values()].map((state) => ({ id: state.id, name: state.member?.displayName ?? "?", avatar: state.member?.displayAvatarURL({ size: 64 }) ?? null })) : [];
}

client.on("voiceStateUpdate", (before, after) => {
  if (after.id !== client.user?.id && channelId && before.channelId !== after.channelId && (before.channelId === channelId || after.channelId === channelId)) emit({ type: "members" });
  if (after.id !== client.user?.id || !connection || !after.channelId || after.channelId === channelId) return;
  console.log("moved", channelId, "to", after.channelId);
  channelId = after.channelId;
  emit({ type: "moved", channelId });
});

setInterval(() => {
  if (leases.size && channelId && !connected()) void rejoin();
}, CHECK_MS).unref();
