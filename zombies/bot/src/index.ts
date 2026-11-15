import type { ChatInputCommandInteraction } from "discord.js";
import type { Locale, Module, Route, SlashCommand } from "../../../home/bot/src/sdk.ts";
import { channelOf, here, join, leave, start } from "./call.ts";

const text = {
  en: {
    joined: "Cari is in your channel. Say «cari» and your question.",
    notInVoice: "Join a voice channel first.",
    noAccess: "I can't reach your voice channel. Give my role access to it.",
    full: "Your voice channel is full.",
  },
  es: {
    joined: "Cari está en tu canal. Di «cari» y tu pregunta.",
    notInVoice: "Entra primero en un canal de voz.",
    noAccess: "No puedo acceder a tu canal de voz. Dale acceso a mi rol.",
    full: "Tu canal de voz está lleno.",
  },
};

async function cari(interaction: ChatInputCommandInteraction, locale: Locale): Promise<string> {
  const joined = await join(interaction.user.id);
  return "error" in joined ? text[locale][joined.error] : text[locale].joined;
}

const command: SlashCommand = {
  data: { name: "cari", description: "Bring Cari into your voice channel", description_localizations: { "es-ES": "Trae a Cari a tu canal de voz", "es-419": "Trae a Cari a tu canal de voz" } },
  ephemeral: true,
  run: cari,
};

const route: Route = async (method, path, _params, _input, userId) => {
  if (path === "voice" && method === "GET") {
    if (!userId) return [{ error: "badRequest" }, 400];
    return [{ channel: await channelOf(userId), cari: here() }];
  }
  if (path === "join" && method === "POST") {
    if (!userId) return [{ error: "badRequest" }, 400];
    const joined = await join(userId);
    return "error" in joined ? [joined, 409] : [joined];
  }
  if (path === "leave" && method === "POST") {
    leave();
    return [{ ok: true }];
  }
  return [{ error: "notFound" }, 404];
};

let stopHearing = () => undefined as void;

export const zombies: Module = {
  name: "zombies",
  commands: [command],
  route,
  start: async () => {
    stopHearing = start();
  },
  stop: () => stopHearing(),
};
