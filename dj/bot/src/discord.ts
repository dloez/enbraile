import { type AutocompleteInteraction, type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { client, guild } from "./client.ts";
import { resolveInput } from "./input.ts";
import * as session from "./session.ts";

export type Access = { member: boolean; canManage: boolean; canPlay: boolean };
export type VoiceLookup = { channelId: string } | { error: "notInVoice" | "noAccess" };

const text = {
  en: {
    denied: "You need the DJ role to use the bot.",
    notInVoice: "Join a voice channel first.",
    noAccess: "I can't reach your voice channel. Give my role access to it.",
    nothing: "Nothing is playing.",
    added: (name: string, position: number) => (position > 0 ? `Queued **${name}** at position ${position}.` : `Playing **${name}**.`),
    addedMany: (count: number) => `Queued ${count} tracks.`,
    done: "Done.",
    now: "Now playing",
    upNext: "Up next",
    more: (count: number) => `…and ${count} more`,
    bad: "That didn't work.",
    noResults: "I couldn't read any tracks from that.",
    noPlaylist: "I can't find that playlist.",
  },
  es: {
    denied: "Necesitas el rol de DJ para usar el bot.",
    notInVoice: "Entra primero en un canal de voz.",
    noAccess: "No puedo acceder a tu canal de voz. Dale acceso a mi rol.",
    nothing: "No suena nada.",
    added: (name: string, position: number) => (position > 0 ? `**${name}** en la cola, posición ${position}.` : `Sonando **${name}**.`),
    addedMany: (count: number) => `${count} temas en la cola.`,
    done: "Hecho.",
    now: "Sonando",
    upNext: "A continuación",
    more: (count: number) => `…y ${count} más`,
    bad: "No ha funcionado.",
    noResults: "No he podido leer ningún tema de ahí.",
    noPlaylist: "No encuentro esa lista.",
  },
};

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

function parseTime(input: string): number | null {
  const parts = input.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0) || parts.length > 3) return null;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

async function handle(interaction: ChatInputCommandInteraction, t: (typeof text)["en"]): Promise<string> {
  const userId = interaction.user.id;
  if (!(await accessOf(userId)).canPlay) return t.denied;
  const name = interaction.commandName;
  if (name === "play" || name === "playlist") {
    const voice = await voiceChannel(userId);
    if ("error" in voice) return t[voice.error];
    if (name === "playlist") {
      const id = interaction.options.getString("name", true);
      const tracks = session.playlistTracks(id, userId);
      if (!tracks?.length) return t.noPlaylist;
      const name = session.playlists(userId).find((list) => list.id === id)?.name ?? "";
      await session.enqueue(voice.channelId, tracks.map((track) => ({ ...track, playlist: { id, name } })), userId);
      return t.addedMany(tracks.length);
    }
    const outcome = await enqueueInput(interaction.options.getString("query", true), voice.channelId, userId);
    if (!outcome) return t.noResults;
    return outcome.items.length > 1 ? t.addedMany(outcome.items.length) : t.added(outcome.items[0]!.title ?? "", outcome.result.position);
  }
  if (name === "queue") {
    const view = session.view();
    const now = view.tracks[view.current];
    if (!view.active || !now) return t.nothing;
    const upcoming = view.tracks.slice(view.current + 1);
    const lines = upcoming.slice(0, 10).map((track, index) => `${index + 1}. ${track.title}`);
    if (upcoming.length > 10) lines.push(t.more(upcoming.length - 10));
    return [`**${t.now}:** ${now.title}`, ...(lines.length ? [`**${t.upNext}:**`, ...lines] : [])].join("\n");
  }
  const command = ((): session.Command | null => {
    if (name === "skip" || name === "pause" || name === "resume" || name === "stop" || name === "shuffle") return { action: name };
    if (name === "loop") return { action: "loop", loop: interaction.options.getString("mode", true) as session.Loop };
    if (name === "autoplay") return { action: "autoplay", on: interaction.options.getString("mode", true) === "on" };
    if (name === "volume") return { action: "volume", volume: interaction.options.getInteger("percent", true) / 100 };
    if (name === "seek") {
      const positionMs = parseTime(interaction.options.getString("time", true));
      return positionMs === null ? null : { action: "seek", positionMs };
    }
    return null;
  })();
  if (!command) return t.bad;
  await session.command(command);
  return t.done;
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const typed = interaction.options.getFocused().toLowerCase();
  const choices = session.playlists(interaction.user.id).filter((list) => list.name.toLowerCase().includes(typed)).slice(0, 25).map((list) => ({ name: `${list.name} (${list.ownerName})`.slice(0, 100), value: list.id }));
  await interaction.respond(choices);
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await autocomplete(interaction);
    if (!interaction.isChatInputCommand()) return;
    const t = interaction.locale.startsWith("es") ? text.es : text.en;
    await interaction.deferReply(interaction.commandName === "queue" ? { flags: MessageFlags.Ephemeral } : {});
    const content = await handle(interaction, t).catch((error: Error) => {
      console.error("command", interaction.commandName, error.message);
      return t.bad;
    });
    await interaction.editReply({ content, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("interaction", (error as Error).message);
  }
});
