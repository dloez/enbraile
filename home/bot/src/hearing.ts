import { Readable } from "node:stream";
import { createAudioResource, StreamType } from "@discordjs/voice";
import type { WebSocket } from "ws";
import { listen } from "./listen.ts";
import type { Module } from "./module.ts";
import * as transcripts from "./transcripts.ts";
import * as voice from "./voice.ts";

export type Trigger = { word: string; userId: string; text: string };
export type TriggerOptions = { ack?: boolean };
export type SayOptions = { voice?: string };
export type Voices = { voices: string[]; loaded: string[]; default: string | null };
type Registration = { word: string; ack: boolean; handler: (trigger: Trigger) => void };
export type TranscriptLine = transcripts.Line;

const BEAT_MS = 10_000;
const SAY_TIMEOUT_MS = 60_000;

const registrations = new Set<Registration>();
const holds = new Map<string, Set<string>>();
const listeners = new Set<(line: TranscriptLine) => void>();
const waiting = new Map<number, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let worker: WebSocket | null = null;
let said = 0;
let offered: Voices = { voices: [], loaded: [], default: null };

const plain = (word: string) => word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export const available = () => worker !== null;

export const voices = (): Voices => ({ voices: [...offered.voices], loaded: [...offered.loaded], default: offered.default });

const wanted = () => [...holds].filter(([, owners]) => owners.size > 0).map(([name]) => name);

function sendWanted(): void {
  worker?.send(JSON.stringify({ type: "want", voices: wanted() }));
}

export function hold(owner: string, name: string): void {
  if (offered.voices.length && !offered.voices.includes(name)) throw new Error(`the voice worker may not load "${name}"`);
  const owners = holds.get(name) ?? new Set<string>();
  const added = !owners.size;
  owners.add(owner);
  holds.set(name, owners);
  if (added) sendWanted();
}

export const holding = (owner: string, name: string) => holds.get(name)?.has(owner) ?? false;

export function release(owner: string, name?: string): void {
  let changed = false;
  for (const [voiceName, owners] of holds) {
    if (name !== undefined && voiceName !== name) continue;
    if (owners.delete(owner) && !owners.size) changed = true;
    if (!owners.size) holds.delete(voiceName);
  }
  if (changed) sendWanted();
}

function sendTriggers(): void {
  const words = new Map<string, boolean>();
  for (const registration of registrations) words.set(registration.word, (words.get(registration.word) ?? false) || registration.ack);
  worker?.send(JSON.stringify({ type: "triggers", words: [...words].map(([word, ack]) => ({ word, ack })) }));
}

export function onTrigger(word: string, handler: (trigger: Trigger) => void, { ack = true }: TriggerOptions = {}): () => void {
  const registration = { word: plain(word), ack, handler };
  if (!registration.word) throw new Error(`trigger word "${word}" has no letters`);
  registrations.add(registration);
  sendTriggers();
  return () => {
    registrations.delete(registration);
    sendTriggers();
  };
}

export function onTranscript(handler: (line: TranscriptLine) => void): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

async function heard(userId: string, text: string, at: number, ms: number | null): Promise<void> {
  const line = await transcripts.record(userId, text, at, ms);
  if (!line) return;
  for (const listener of listeners) {
    try {
      listener(line);
    } catch (error) {
      console.error("transcript handler", (error as Error).message);
    }
  }
}

export function say(text: string, { voice }: SayOptions = {}): Promise<void> {
  if (!worker) return Promise.reject(new Error("the voice worker is not connected"));
  if (voice !== undefined && !offered.voices.includes(voice)) return Promise.reject(new Error(`the voice worker may not load "${voice}"`));
  const id = ++said;
  worker.send(JSON.stringify({ type: "say", id, text, ...(voice === undefined ? {} : { voice }) }));
  transcripts.recordBot(text);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error("the voice worker did not answer"));
    }, SAY_TIMEOUT_MS);
    waiting.set(id, { resolve, reject, timer });
  });
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

function play(audio: Buffer): void {
  voice.speak(createAudioResource(Readable.from([audio]), { inputType: StreamType.OggOpus }));
}

function received(data: Buffer, binary: boolean): void {
  if (binary) {
    const { header, body } = unframe(data);
    if (header.type !== "audio") return;
    play(body);
    const entry = typeof header.id === "number" ? waiting.get(header.id) : undefined;
    if (!entry) return;
    clearTimeout(entry.timer);
    waiting.delete(header.id as number);
    entry.resolve();
    return;
  }
  const message = JSON.parse(String(data)) as { type: string; id?: number; error?: string; word?: string; user?: string; text?: string; at?: number; ms?: number; voices?: string[]; loaded?: string[]; default?: string };
  if (message.type === "voices" && Array.isArray(message.voices)) {
    offered = { voices: message.voices, loaded: message.loaded ?? [], default: message.default ?? null };
    console.log("voices", offered.voices.join(", "), "loaded", offered.loaded.join(", ") || "none", "default", offered.default);
    return;
  }
  if (message.type === "failed" && typeof message.id === "number") {
    const entry = waiting.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    waiting.delete(message.id);
    entry.reject(new Error(message.error ?? "the voice worker could not speak"));
    return;
  }
  if (message.type === "transcript" && message.user && message.text) {
    heard(message.user, message.text, message.at ?? Date.now(), message.ms ?? null).catch((error: Error) => console.error("transcript", error.message));
    return;
  }
  if (message.type !== "trigger" || !message.word || !message.user) return;
  const trigger = { word: message.word, userId: message.user, text: message.text ?? "" };
  console.log("trigger", JSON.stringify(trigger));
  for (const registration of registrations) {
    if (registration.word !== message.word) continue;
    try {
      registration.handler(trigger);
    } catch (error) {
      console.error("trigger handler", message.word, (error as Error).message);
    }
  }
}

function accept(socket: WebSocket): void {
  worker?.close();
  worker = socket;
  console.log("voice worker connected");
  sendTriggers();
  sendWanted();
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
    offered = { voices: [], loaded: [], default: null };
    for (const [id, entry] of waiting) {
      clearTimeout(entry.timer);
      entry.reject(new Error("the voice worker disconnected"));
      waiting.delete(id);
    }
    console.log("voice worker disconnected");
  };
  socket.on("close", gone);
  socket.on("error", gone);
  socket.on("message", (data, binary) => {
    try {
      received(data as Buffer, binary);
    } catch (error) {
      console.error("voice worker", (error as Error).message);
    }
  });
}

export const hearing: Module = {
  name: "voice",
  connect: accept,
  start: async () =>
    listen(
      (userId, clip, startedAt) => worker?.send(frame({ type: "clip", user: userId, at: startedAt }, clip)),
      () => worker !== null && voice.listening() && (registrations.size > 0 || transcripts.active() || (transcripts.kept() && listeners.size > 0)),
    ),
  stop: () => transcripts.flush(),
};
