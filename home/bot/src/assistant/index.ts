import { Readable } from "node:stream";
import { createAudioResource, StreamType } from "@discordjs/voice";
import { ApplicationCommandType } from "discord.js";
import type { WebSocket } from "ws";
import { guild } from "../discord.ts";
import type { Module, SlashCommand, Tool } from "../module.ts";
import * as voice from "../voice.ts";
import { ready, respond } from "./brain.ts";
import { listen } from "./listen.ts";

const BEAT_MS = 10_000;
const ALONE_MS = 60_000;
const CHECK_MS = 15_000;

let worker: WebSocket | null = null;
let tools: Tool[] = [];
let queue = Promise.resolve();
let said = 0;
let aloneSince: number | null = null;
let listening = true;

export function useTools(all: Tool[]): void {
  tools = all;
}

function frame(header: Record<string, unknown>, body: Buffer): Buffer {
  const head = Buffer.from(JSON.stringify(header));
  const size = Buffer.alloc(4);
  size.writeUInt32BE(head.length);
  return Buffer.concat([size, head, body]);
}

function unframe(data: Buffer): { header: Record<string, unknown>; body: Buffer } {
  const size = data.readUInt32BE(0);
  return { header: JSON.parse(data.subarray(4, 4 + size).toString()) as Record<string, unknown>, body: data.subarray(4 + size) };
}

async function nameOf(userId: string): Promise<string> {
  const member = await (await guild()).members.fetch(userId).catch(() => null);
  return member?.displayName ?? "Alguien";
}

async function answer(userId: string, text: string): Promise<void> {
  const name = await nameOf(userId);
  const started = Date.now();
  const reply = await respond(name, userId, text, tools).catch((error: Error) => {
    console.error("assistant", error.message);
    return "Se me ha ido la cabeza, prueba otra vez.";
  });
  console.log("assistant", JSON.stringify({ name, text, reply, ms: Date.now() - started }));
  if (reply && worker) worker.send(JSON.stringify({ type: "say", id: ++said, text: reply }));
}

function accept(socket: WebSocket): void {
  worker?.close();
  worker = socket;
  console.log("voice worker connected");
  let alive = true;
  socket.on("pong", () => (alive = true));
  const beat = setInterval(() => {
    if (!alive) return socket.terminate();
    alive = false;
    socket.ping();
  }, BEAT_MS);
  const gone = () => {
    clearInterval(beat);
    if (worker !== socket) return;
    worker = null;
    console.log("voice worker disconnected");
  };
  socket.on("close", gone);
  socket.on("error", gone);
  socket.on("message", (data, binary) => {
    try {
      if (binary) {
        const { header, body } = unframe(data as Buffer);
        if (header.type === "audio") voice.speak(createAudioResource(Readable.from([body]), { inputType: StreamType.OggOpus }));
        return;
      }
      const message = JSON.parse(String(data)) as { type: string; user?: string; text?: string };
      if (message.type === "wake" && message.user && message.text) {
        const { user, text } = message;
        queue = queue.then(() => answer(user, text));
      }
    } catch (error) {
      console.error("voice worker", (error as Error).message);
    }
  });
}

const leave: Tool = {
  definition: {
    name: "leave_call",
    description: "Deja de escuchar y sal del canal de voz cuando te lo pidan. Si está sonando música, la música sigue sin que escuches.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  run: async () => {
    listening = false;
    voice.release("assistant");
    return "Hecho: ya no escucho hasta que alguien use /bebe. Si había música, sigue sonando.";
  },
};

const text = {
  en: { notInVoice: "Join a voice channel first.", deaf: "My ears are off: the voice worker isn't connected.", listening: "Listening. Start with «bebé»." },
  es: { notInVoice: "Entra primero en un canal de voz.", deaf: "Tengo los oídos apagados: el servicio de voz no está conectado.", listening: "Te escucho. Empieza la frase con «bebé»." },
};

const bebe: SlashCommand = {
  data: { name: "bebe", type: ApplicationCommandType.ChatInput, description: "Join your voice channel to listen", description_localizations: { "es-ES": "Entra en tu canal de voz a escuchar", "es-419": "Entra en tu canal de voz a escuchar" } },
  run: async (interaction, locale) => {
    const t = text[locale];
    const channelId = (await guild()).voiceStates.cache.get(interaction.user.id)?.channelId;
    if (!channelId) return t.notInVoice;
    if (!worker) return t.deaf;
    await voice.hold("assistant", channelId);
    listening = true;
    aloneSince = null;
    return t.listening;
  },
};

setInterval(() => {
  if (!voice.holding("assistant")) return void (aloneSince = null);
  const now = Date.now();
  aloneSince = voice.members().length ? null : (aloneSince ?? now);
  if (aloneSince !== null && now - aloneSince >= ALONE_MS) {
    aloneSince = null;
    voice.release("assistant");
  }
}, CHECK_MS).unref();

export const assistant: Module = {
  name: "assistant",
  commands: [bebe],
  tools: [leave],
  connect: accept,
  start: async () => {
    if (!ready()) console.error("assistant", "ANTHROPIC_API_KEY is not set; requests get a canned reply");
    listen(
      (userId, clip) => worker?.send(frame({ type: "clip", user: userId }, clip)),
      () => worker !== null && listening,
    );
  },
};
