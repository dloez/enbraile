import { PermissionFlagsBits } from "discord.js";
import { guild, hearing, voice } from "../../../home/bot/src/sdk.ts";

export type Channel = { id: string; name: string; canJoin: boolean; reason: "noAccess" | "full" | null };
export type Joined = { channelId: string } | { error: "notInVoice" | "noAccess" | "full" };

const OWNER = "zombies";
const SITE_TIMEOUT_MS = 25_000;

const siteUrl = (process.env.ZOMBIES_URL ?? "https://zombies.enbraile.vip").replace(/\/$/, "");
const secret = process.env.INTERNAL_SECRET ?? "";

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
  return { channelId: channel.id };
}

export function leave(): void {
  if (voice.holding(OWNER)) voice.release(OWNER);
}

export const here = () => (voice.holding(OWNER) ? voice.channel() : null);

async function ask(userId: string, text: string): Promise<string | null> {
  const response = await fetch(`${siteUrl}/api/voice`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ userId, text }),
    signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`site answered ${response.status}`);
  const { reply } = (await response.json()) as { reply?: unknown };
  return typeof reply === "string" && reply.trim() ? reply : null;
}

async function heard(userId: string, text: string): Promise<void> {
  if (!voice.holding(OWNER) || !text.trim()) return;
  const reply = await ask(userId, text);
  if (reply) await hearing.say(reply);
}

export function start(): () => void {
  const unhear = hearing.onTrigger("cari", ({ userId, text }) => {
    heard(userId, text).catch((error: Error) => console.error("zombies voice", userId, error.message));
  });
  const unwatch = voice.watch((event) => {
    if (event.type === "members" && voice.holding(OWNER) && voice.members().length === 0) leave();
  });
  return () => {
    unhear();
    unwatch();
  };
}
