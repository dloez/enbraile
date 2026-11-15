import { z } from "zod";
import { languages, type Language, type PublishedMap, type Viewer } from "./bundle.js";

export type Member = { name: string; you: boolean };

export type OpenRun = { id: string; language: Language; startedBy: string; members: Member[]; you: boolean };

export type MapWithRuns = PublishedMap & { runs: OpenRun[] };

export type YourRun = { id: string; name: Record<Language, string>; language: Language; members: Member[] };

export type MapsPage = { viewer: Viewer; maps: MapWithRuns[]; yourRun: YourRun | null };

export type RunSheet = {
  viewer: Viewer;
  id: string;
  map: PublishedMap;
  language: Language;
  startedBy: string;
  members: Member[];
  you: boolean;
  yourRun: { id: string; name: Record<Language, string> } | null;
};

export const ratings = ["obvious", "right", "vague"] as const;

export type Rating = (typeof ratings)[number];

export type Message = {
  id: number;
  author: "member" | "cari";
  revision: { re: string | null } | null;
  name: string;
  you: boolean;
  text: string;
  at: string;
  card: number | null;
};

export type Card = { id: number; rungs: { id: number; text: string }[]; at: string; more: boolean; rating: Rating | null };

export type GapContext = {
  model: string;
  known: string[];
  open: { ladder: string; given: number }[];
  done: string[];
  recent: string[];
};

export type Transcript = { messages: Message[]; members: Member[]; cards: Card[] };

export type ReplyEvent = { type: "text"; text: string } | { type: "failed" } | { type: "done" };

export const startRunSchema = z.object({ game: z.string().min(1), map: z.string().min(1), language: z.enum(languages).default("es") });

export const messageSchema = z.object({ text: z.string().trim().min(1).max(2000), revision: z.boolean().default(false) });

export const ratingSchema = z.object({ rating: z.enum(ratings) });

const revisionMark = /^\s*revisi[oó]n\s*:\s*/i;

export function asRevision(text: string, flagged: boolean): string | null {
  const stripped = text.replace(revisionMark, "").trim();
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
