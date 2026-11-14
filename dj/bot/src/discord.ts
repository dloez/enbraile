import { PermissionFlagsBits } from "discord.js";
import { client, guild } from "../../../home/bot/src/sdk.ts";
import { resolveInput } from "./input.ts";
import * as session from "./session.ts";

export type Access = { member: boolean; canManage: boolean; canPlay: boolean };
export type VoiceLookup = { channelId: string } | { error: "notInVoice" | "noAccess" };

const ACCESS_FRESH_MS = 30_000;
const checked = new Map<string, number>();

export async function accessOf(userId: string): Promise<Access> {
  const server = await guild();
  const stale = Date.now() - (checked.get(userId) ?? 0) > ACCESS_FRESH_MS;
  const member = await server.members.fetch({ user: userId, force: stale }).catch(() => null);
  if (stale && member) checked.set(userId, Date.now());
  if (!member) return { member: false, canManage: false, canPlay: false };
  const canManage = member.permissions.has(PermissionFlagsBits.ManageGuild);
  const { djRoleId } = session.settings();
  return { member: true, canManage, canPlay: canManage || (djRoleId !== null && member.roles.cache.has(djRoleId)) };
}

export async function voiceChannel(userId: string): Promise<VoiceLookup> {
  const server = await guild();
  const channelId = server.voiceStates.cache.get(userId)?.channelId;
  if (!channelId) return { error: "notInVoice" };
  const channel = server.channels.cache.get(channelId);
  const me = server.members.me;
  if (!channel || !me || !channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) return { error: "noAccess" };
  return { channelId };
}

export type Voice = { id: string; name: string; canJoin: boolean; reason: "noAccess" | "full" | null } | null;

export async function voiceOf(userId: string): Promise<Voice> {
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

const voiceWatchers = new Set<{ userId: string; callback: (voice: Voice) => void }>();

client.on("voiceStateUpdate", (before, after) => {
  if (before.channelId === after.channelId) return;
  for (const watcher of voiceWatchers) if (watcher.userId === after.id) void voiceOf(after.id).then(watcher.callback, () => undefined);
});

export function watchVoice(userId: string, callback: (voice: Voice) => void): () => void {
  const watcher = { userId, callback };
  voiceWatchers.add(watcher);
  return () => {
    voiceWatchers.delete(watcher);
  };
}

export async function enqueueInput(input: string, channelId: string, userId: string) {
  const items = await resolveInput(input, session.expand);
  if (!items.length) return null;
  return { items, result: await session.enqueue(channelId, items, userId) };
}
