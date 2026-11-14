import { ApplicationCommandOptionType, type AutocompleteInteraction, type ChatInputCommandInteraction, type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import type { Locale, SlashCommand } from "../../../home/bot/src/sdk.ts";
import { accessOf, enqueueInput, voiceChannel } from "./discord.ts";
import * as session from "./session.ts";

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

function parseTime(input: string): number | null {
  const parts = input.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0) || parts.length > 3) return null;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

async function handle(interaction: ChatInputCommandInteraction, locale: Locale): Promise<string> {
  const t = text[locale];
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

const es = (name: string, description: string) => ({ description, description_localizations: { "es-ES": name, "es-419": name } });
const { String: Text, Integer, Subcommand } = ApplicationCommandOptionType;

const definitions: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  { name: "play", ...es("Busca o reproduce un enlace", "Search or play a link"), options: [{ type: Text, name: "query", required: true, ...es("Nombre o enlace", "Name or link") }] },
  { name: "queue", ...es("Muestra la cola", "Show the queue") },
  { name: "skip", ...es("Salta el tema", "Skip the track") },
  { name: "pause", ...es("Pausa", "Pause") },
  { name: "resume", ...es("Continúa", "Resume") },
  { name: "stop", ...es("Para y sale del canal", "Stop and leave the channel") },
  { name: "shuffle", ...es("Mezcla la cola", "Shuffle the queue") },
  { name: "seek", ...es("Salta a un momento", "Jump to a time"), options: [{ type: Text, name: "time", required: true, ...es("Como 1:30", "Like 1:30") }] },
  { name: "volume", ...es("Cambia el volumen", "Change the volume"), options: [{ type: Integer, name: "percent", required: true, min_value: 0, max_value: 200, ...es("De 0 a 200", "From 0 to 200") }] },
  { name: "loop", ...es("Repite", "Loop"), options: [{ type: Text, name: "mode", required: true, ...es("Modo", "Mode"), choices: [{ name: "off", value: "off" }, { name: "track", value: "track" }, { name: "queue", value: "queue" }] }] },
  { name: "autoplay", ...es("Sigue con temas parecidos", "Keep going with related tracks"), options: [{ type: Text, name: "mode", required: true, ...es("Modo", "Mode"), choices: [{ name: "on", value: "on" }, { name: "off", value: "off" }] }] },
  { name: "playlist", ...es("Listas", "Playlists"), options: [{ type: Subcommand, name: "play", ...es("Pon una lista", "Play a playlist"), options: [{ type: Text, name: "name", required: true, autocomplete: true, ...es("Nombre de la lista", "Playlist name") }] }] },
];

export const commands: SlashCommand[] = definitions.map((data) => ({
  data,
  ephemeral: data.name === "queue",
  run: handle,
  ...(data.name === "playlist" ? { autocomplete } : {}),
}));
