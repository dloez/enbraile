import type { ChatInputCommandInteraction } from "discord.js";
import type { Locale, Module, Route, SlashCommand } from "../../../home/bot/src/sdk.ts";
import { channelOf, here, join, leaveFor, namesOf, speak, start } from "./call.ts";

const MAX_NAMES = 50;

const text = {
  en: {
    joined: (name: string, wake: string) => `${name} is in your channel. Say «${wake}» and your question.`,
    notInVoice: "Join a voice channel first.",
    noAccess: "I can't reach your voice channel. Give my role access to it.",
    full: "Your voice channel is full.",
  },
  es: {
    joined: (name: string, wake: string) => `${name} está en tu canal. Di «${wake}» y tu pregunta.`,
    notInVoice: "Entra primero en un canal de voz.",
    noAccess: "No puedo acceder a tu canal de voz. Dale acceso a mi rol.",
    full: "Tu canal de voz está lleno.",
  },
};

async function bringCoach(interaction: ChatInputCommandInteraction, locale: Locale): Promise<string> {
  const joined = await join(interaction.user.id);
  return "error" in joined ? text[locale][joined.error] : text[locale].joined(joined.coach.name, joined.coach.wake);
}

const command: SlashCommand = {
  data: { name: "coach", description: "Bring Coach into your voice channel", description_localizations: { "es-ES": "Trae a Coach a tu canal de voz", "es-419": "Trae a Coach a tu canal de voz" } },
  ephemeral: true,
  run: bringCoach,
};

const route: Route = async (method, path, _params, input, userId) => {
  if (path === "voice" && method === "GET") {
    if (!userId) return [{ error: "badRequest" }, 400];
    return [{ channel: await channelOf(userId), coach: here() }];
  }
  if (path === "join" && method === "POST") {
    if (!userId) return [{ error: "badRequest" }, 400];
    const joined = await join(userId, typeof input.voice === "string" ? input.voice : null);
    return "error" in joined ? [joined, 409] : [joined];
  }
  if (path === "names" && method === "POST") {
    const ids = Array.isArray(input.ids) ? [...new Set(input.ids.filter((id): id is string => typeof id === "string" && /^\d{1,20}$/.test(id)))] : [];
    if (!ids.length || ids.length > MAX_NAMES) return [{ error: "badRequest" }, 400];
    return [await namesOf(ids)];
  }
  if (path === "say" && method === "POST") {
    const said = typeof input.text === "string" ? input.text.trim() : "";
    const userIds = Array.isArray(input.userIds) ? input.userIds.filter((id): id is string => typeof id === "string") : [];
    if (!said || !userIds.length) return [{ error: "badRequest" }, 400];
    return speak(said, typeof input.voice === "string" ? input.voice : null, userIds) ? [{ ok: true }] : [{ error: "notInCall" }, 409];
  }
  if (path === "leave" && method === "POST") {
    const userIds = Array.isArray(input.userIds) ? input.userIds.filter((id): id is string => typeof id === "string") : [];
    if (!userIds.length) return [{ error: "badRequest" }, 400];
    return leaveFor(userIds) ? [{ ok: true }] : [{ error: "notInCall" }, 409];
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
