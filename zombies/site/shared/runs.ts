import { z } from "zod";
import { languages, type Language, type PublishedMap, type Viewer, type Zone } from "./bundle.js";
import { defaultVoice, voices, type Voice } from "./voices.js";

export type Person = { name: string; who: string | null; live: boolean; avatar: string | null };

export type Member = Person & { you: boolean };

export type RunLink = { id: string; name: Record<Language, string> };

export type MapSummary = PublishedMap & { attempts: number; beaten: number; you: boolean };

export type MapsPage = { viewer: Viewer; maps: MapSummary[]; yourRun: RunLink | null };

export type Attempt = { id: string; language: Language; voice: Voice; startedBy: Person; members: Member[]; playing: boolean; you: boolean; beaten: boolean; lastPlayed: string };

export type MapPage = { viewer: Viewer; map: PublishedMap; attempts: Attempt[]; yourRun: RunLink | null };

export type RunSheet = {
  viewer: Viewer;
  id: string;
  map: PublishedMap;
  language: Language;
  voice: Voice;
  startedBy: Person;
  members: Member[];
  you: boolean;
  yourRun: RunLink | null;
};

export const ratings = ["obvious", "right", "vague"] as const;

export type Rating = (typeof ratings)[number];

export type Message = {
  id: number;
  author: "member" | "coach";
  revision: { re: string | null } | null;
  name: string;
  who: string | null;
  live: boolean;
  avatar: string | null;
  you: boolean;
  text: string;
  at: string;
  card: number | null;
};

export type Survey = { digest: string; width: number; height: number };

export type ShownZone = Zone & { survey: Survey | null };

export type Card = { id: number; rungs: { id: number; text: string; zone: ShownZone | null }[]; at: string; more: boolean; thread: number; done: boolean; rating: Rating | null };

export type GapContext = {
  model: string;
  known: string[];
  open: { ladder: string; given: number }[];
  done: string[];
  recent: string[];
};

export type Transcript = { history: Message[]; messages: Message[]; members: Member[]; cards: Card[]; voice: Voice };

export type RunEvent = { id: number; at: string } & (
  | { kind: "line" | "coach"; name: string; text: string; cards: number[]; by: "claude" | null }
  | { kind: "call"; name: string; text: string; discordId: string }
  | { kind: "audit"; message: number | null; findings: string[] }
  | { kind: "hint"; card: number; step: string; part: string | null; rung: number; alt: number | null; level: number; text: string; version: number; askedBy: string | null }
  | { kind: "revision"; name: string; text: string; message: number | null; refersTo: number | null; card: number | null; delivery: number | null }
  | { kind: "rating"; name: string; rating: Rating; card: number; delivery: number | null }
  | { kind: "gap"; asked: string; about: string; said: string; version: number; askedBy: string | null }
  | { kind: "answered"; gap: number; delivery: number | null }
  | { kind: "joined" | "left"; name: string }
  | { kind: "progress"; status: "started" | "done" | "blocked"; step: string; part: string | null }
  | { kind: "published"; version: number }
);

export type RunEvents = { run: { id: string; game: string; map: string }; events: RunEvent[]; next: string };

export type VoiceChannel = { id: string; name: string; canJoin: boolean; reason: "noAccess" | "full" | null };

export type CallState = { reachable: boolean; channel: VoiceChannel | null; coach: string | null };

export type JoinRefusal = "notInVoice" | "noAccess" | "full" | "botOffline";

export const voiceSchema = z.object({ userId: z.string().min(1), text: z.string().trim().min(1).max(2000), word: z.string().trim().toLowerCase().min(1) });

export const coachVoiceSchema = z.object({ userId: z.string().min(1) });

export const callLineSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(4000),
  at: z.iso.datetime(),
  ms: z.number().int().nonnegative().nullable(),
  broughtBy: z.string().min(1).nullable(),
});

export type CallLine = z.infer<typeof callLineSchema>;

export type ReplyEvent = { type: "text"; text: string } | { type: "hint"; text: string } | { type: "failed" } | { type: "done" };

export type VoiceEvent = { type: "voice"; voice: Voice } | { type: "say"; text: string } | { type: "done" };

export const startRunSchema = z.object({ game: z.string().min(1), map: z.string().min(1), language: z.enum(languages).default("es"), voice: z.enum(voices).default(defaultVoice) });

export const runVoiceSchema = z.object({ voice: z.enum(voices) });

export const messageSchema = z.object({ text: z.string().trim().min(1).max(2000), revision: z.boolean().default(false) });

export const ratingSchema = z.object({ rating: z.enum(ratings) });

const revisionMark = /^\s*revisi[oó]n\s*:\s*/i;

const spokenRevisionMark = /^\s*revisi[oó]n\b[\s:,.;-]*/i;

export function asRevision(text: string, flagged: boolean, spoken = false): string | null {
  const stripped = text.replace(spoken ? spokenRevisionMark : revisionMark, "").trim();
  if (stripped !== text.trim()) return stripped;
  return flagged ? text.trim() : null;
}

const handle = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const runImportSchema = z.object({
  game: handle,
  map: handle,
  language: z.enum(languages).default("es"),
  members: z.array(z.object({ discordId: z.string().min(1), name: z.string().trim().min(1) })).min(1),
  known: z.array(handle).default([]),
  deliveries: z
    .array(z.object({ step: handle, part: handle.nullable().default(null), rung: z.number().int().min(0), alt: z.number().int().min(0).nullable().default(null), askedBy: z.string().min(1).nullable().default(null) }))
    .default([]),
  steps: z.array(z.object({ step: handle, part: handle.nullable().default(null), started: z.boolean().default(false), done: z.boolean().default(false), blockedTold: z.boolean().default(false) })).default([]),
  headsUps: z.array(z.object({ step: handle, position: z.number().int().min(0) })).default([]),
});

export type RunImport = z.infer<typeof runImportSchema>;

export const historyImportSchema = z.object({
  lines: z
    .array(z.object({ author: z.enum(["member", "coach"]), text: z.string().trim().min(1).max(20000), at: z.iso.datetime({ offset: true }) }))
    .min(1)
    .max(5000),
});

export type HistoryImport = z.infer<typeof historyImportSchema>;

export const stepInSchema = z
  .object({
    text: z.string().max(1000).default(""),
    hint: z.object({ step: handle, part: handle.nullable().default(null), alt: z.number().int().min(0).nullable().default(null) }).nullable().default(null),
    gap: z.number().int().positive().nullable().default(null),
    progress: z.array(z.object({ step: handle, part: handle.nullable().default(null), status: z.enum(["started", "done"]) })).default([]),
  })
  .refine((value) => value.text.trim() !== "" || value.hint !== null || value.progress.length > 0, { message: "text, hint or progress is required" });

export type StepIn = z.infer<typeof stepInSchema>;
