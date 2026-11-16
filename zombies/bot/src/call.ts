import { PermissionFlagsBits } from "discord.js";
import { guild, hearing, transcripts, voice, type TranscriptLine } from "../../../home/bot/src/sdk.ts";

export type Channel = { id: string; name: string; canJoin: boolean; reason: "noAccess" | "full" | null };
export type Joined = { channelId: string } | { error: "notInVoice" | "noAccess" | "full" };

const OWNER = "zombies";
const SITE_TIMEOUT_MS = 25_000;

const siteUrl = (process.env.ZOMBIES_URL ?? "https://zombies.enbraile.vip").replace(/\/$/, "");
const secret = process.env.INTERNAL_SECRET ?? "";

let broughtBy: string | null = null;

function keepTranscripts(): void {
  const held = voice.holding(OWNER);
  if (!held) broughtBy = null;
  transcripts.keep(OWNER, held);
}

export async function channelOf(userId: string): Promise<Channel | null> {
  const server = await guild();
  const channelId = server.voiceStates.cache.get(userId)?.channelId;
  const channel = channelId ? server.channels.cache.get(channelId) : undefined;
  if (!channel || !channel.isVoiceBased()) return null;
  const me = server.members.me;
  const allowed = Boolean(me && channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]));
  const present = Boolean(me && channel.members.has(me.id));
  const full = !present && channel.userLimit > 0 && channel.members.size >= channel.userLimit && !(me && channel.permissionsFor(me).has(PermissionFlagsBits.MoveMembers));
  const reason = !allowed ? "noAccess" : full ? "full" : null;
  return { id: channel.id, name: channel.name, canJoin: !reason, reason };
}

export async function join(userId: string): Promise<Joined> {
  const channel = await channelOf(userId);
  if (!channel) return { error: "notInVoice" };
  if (channel.reason) return { error: channel.reason };
  await voice.hold(OWNER, channel.id, { listen: true });
  broughtBy = userId;
  keepTranscripts();
  return { channelId: channel.id };
}

export function leave(): void {
  if (voice.holding(OWNER)) voice.release(OWNER);
  keepTranscripts();
}

export async function namesOf(ids: string[]): Promise<Record<string, string>> {
  const server = await guild();
  const found = await Promise.all(ids.map((id) => server.members.fetch({ user: id, force: true }).then((member) => [id, member.displayName] as const, () => null)));
  return Object.fromEntries(found.filter((entry) => entry !== null));
}

export const here = () => (voice.holding(OWNER) ? voice.channel() : null);

function site(path: string, body: unknown): Promise<Response> {
  return fetch(`${siteUrl}/api/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
  });
}

async function ask(userId: string, text: string): Promise<string | null> {
  const response = await site("voice", { userId, text });
  if (!response.ok) throw new Error(`site answered ${response.status}`);
  const { reply } = (await response.json()) as { reply?: unknown };
  return typeof reply === "string" && reply.trim() ? reply : null;
}

async function heard(userId: string, text: string): Promise<void> {
  if (!voice.holding(OWNER) || !text.trim()) return;
  const reply = await ask(userId, text);
  if (reply) await hearing.say(reply);
}

async function said(line: TranscriptLine): Promise<void> {
  if (!voice.holding(OWNER) || !line.text.trim()) return;
  const response = await site("voice/transcript", { userId: line.userId, name: line.name, text: line.text, at: line.at, ms: line.ms, broughtBy });
  if (!response.ok) throw new Error(`site answered ${response.status}`);
}

export function start(): () => void {
  const unhear = hearing.onTrigger("cari", ({ userId, text }) => {
    heard(userId, text).catch((error: Error) => console.error("zombies voice", userId, error.message));
  });
  const unlisten = hearing.onTranscript((line) => {
    said(line).catch((error: Error) => console.error("zombies transcript", line.userId, error.message));
  });
  const unwatch = voice.watch((event) => {
    if (event.type === "members" && voice.holding(OWNER) && voice.members().length === 0) leave();
    else keepTranscripts();
  });
  return () => {
    unhear();
    unlisten();
    unwatch();
    transcripts.keep(OWNER, false);
  };
}
