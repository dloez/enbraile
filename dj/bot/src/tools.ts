import type { Tool } from "../../../home/bot/src/sdk.ts";
import { accessOf, enqueueInput, voiceChannel } from "./discord.ts";
import * as session from "./session.ts";

const DENIED = "No puede: esta persona no tiene el rol de DJ.";
const IDLE = "No está sonando nada.";

const empty = { type: "object" as const, properties: {}, additionalProperties: false };

function guarded(run: (input: Record<string, unknown>, userId: string) => Promise<string>): Tool["run"] {
  return async (input, userId) => ((await accessOf(userId)).canPlay ? run(input, userId) : DENIED);
}

function simple(name: string, description: string, action: "skip" | "pause" | "resume" | "stop" | "shuffle", done: string): Tool {
  return {
    definition: { name, description, input_schema: empty, strict: true },
    run: guarded(async () => {
      if (!session.view().active) return IDLE;
      await session.command({ action });
      return done;
    }),
  };
}

export const tools: Tool[] = [
  {
    definition: {
      name: "play_music",
      description: "Pone una canción, artista, álbum o enlace en el canal de voz de quien habla: suena ya si no hay nada, si no va a la cola.",
      input_schema: { type: "object", properties: { query: { type: "string", description: "Lo que hay que buscar, p. ej. «Bad Bunny Tití me preguntó», o un enlace" } }, required: ["query"], additionalProperties: false },
      strict: true,
    },
    run: guarded(async (input, userId) => {
      const voice = await voiceChannel(userId);
      if ("error" in voice) return voice.error === "notInVoice" ? "Quien habla no está en un canal de voz." : "No tengo acceso a ese canal de voz.";
      const outcome = await enqueueInput(String(input.query ?? ""), voice.channelId, userId);
      if (!outcome) return "No he encontrado nada con eso.";
      const first = outcome.items[0]!;
      const title = [first.title, first.artist].filter(Boolean).join(" de ");
      if (outcome.items.length > 1) return `Añadidas ${outcome.items.length} canciones a la cola.`;
      return outcome.result.position > 0 ? `Añadida a la cola en el puesto ${outcome.result.position}: ${title}.` : `Sonando: ${title}.`;
    }),
  },
  simple("skip_song", "Salta la canción que suena.", "skip", "Saltada."),
  simple("pause_music", "Pausa la música.", "pause", "Pausada."),
  simple("resume_music", "Reanuda la música pausada.", "resume", "Reanudada."),
  simple("stop_music", "Para la música, vacía la cola y saca la música del canal.", "stop", "Música parada."),
  simple("shuffle_queue", "Mezcla la cola.", "shuffle", "Cola mezclada."),
  {
    definition: {
      name: "set_volume",
      description: "Cambia el volumen de la música, en porcentaje (100 es el normal).",
      input_schema: { type: "object", properties: { percent: { type: "integer", description: "De 0 a 200" } }, required: ["percent"], additionalProperties: false },
      strict: true,
    },
    run: guarded(async (input) => {
      if (!session.view().active) return IDLE;
      const percent = Math.max(0, Math.min(200, Math.round(Number(input.percent))));
      await session.command({ action: "volume", volume: percent / 100 });
      return `Volumen al ${percent} %.`;
    }),
  },
  {
    definition: { name: "now_playing", description: "Dice qué canción suena y qué viene después.", input_schema: empty, strict: true },
    run: async () => {
      const view = session.view();
      const now = view.tracks[view.current];
      if (!view.active || !now) return IDLE;
      const next = view.tracks.slice(view.current + 1, view.current + 4).map((track) => [track.title, track.artist].filter(Boolean).join(" de "));
      return [`Suena ${[now.title, now.artist].filter(Boolean).join(" de ")}${view.paused ? " (en pausa)" : ""}.`, next.length ? `Después: ${next.join("; ")}.` : "No hay nada más en la cola."].join(" ");
    },
  },
];
