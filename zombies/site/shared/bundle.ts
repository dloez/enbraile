import { z } from "zod";
import { imageTypes } from "./image.js";

export const languages = ["es", "en"] as const;
export type Language = (typeof languages)[number];

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const worded = z.object({ es: z.string().min(1), en: z.string().min(1) });

const line = z.object({
  text: worded,
  mentions: z.array(id).default([]),
  reveals: z.array(id).default([]),
});

const fraction = z.number().min(0).max(1);

export const zoneSchema = z.object({ x: fraction, y: fraction, rx: fraction.positive(), ry: fraction.positive() });

export type Zone = z.infer<typeof zoneSchema>;

export const zoneLevel = 3;

const alt = line.extend({ when: z.string().min(1), zone: zoneSchema.optional() });

const rung = line.extend({
  level: z.number().int().min(1).max(4),
  zone: zoneSchema.optional(),
  alts: z.array(alt).default([]),
});

const ladder = z.array(rung).min(1);

const part = z.object({
  id,
  title: z.string().min(1),
  ladder,
});

const headsUp = z.object({
  when: z.string().min(1),
  text: worded,
  mentions: z.array(id).default([]),
});

export const stepKinds = ["discovery", "puzzle", "arbitrary", "execution"] as const;

const step = z.object({
  id,
  title: z.string().min(1),
  doneWhen: z.string().min(1).optional(),
  kind: z.enum(stepKinds).optional(),
  requires: z.array(id).default([]),
  conditions: z.array(z.string().min(1)).default([]),
  optional: z.boolean().default(false),
  onSuccess: line,
  milestone: line.optional(),
  ladder,
  parts: z.array(part).default([]),
  headsUps: z.array(headsUp).default([]),
});

const knowledge = z.object({
  id,
  name: worded,
  aliases: z.object({ es: z.array(z.string().min(1)).default([]), en: z.array(z.string().min(1)).default([]) }).default({ es: [], en: [] }),
  mark: z.enum(["known", "unknown"]),
});

const source = z.object({
  title: z.string().min(1),
  url: z.url().optional(),
  text: z.string().optional(),
});

const image = z.object({
  file: z.string().min(1),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  type: z.enum(imageTypes),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const unique = (ids: string[]) => ids.filter((value, index) => ids.indexOf(value) !== index);

export const bundleSchema = z
  .object({
    game: id,
    map: id,
    name: worded,
    test: z.boolean().default(false),
    art: z.enum(["teal", "rust", "furnace"]),
    image: image.optional(),
    survey: image.optional(),
    knowledge: z.array(knowledge),
    steps: z.array(step).min(1),
    calibration: z.array(z.string().min(1)).default([]),
    dossier: z.string().min(1),
    sources: z.array(source).default([]),
  })
  .superRefine((bundle, ctx) => {
    const known = new Set(bundle.knowledge.map((entry) => entry.id));
    const steps = new Set(bundle.steps.map((entry) => entry.id));
    for (const repeated of unique(bundle.knowledge.map((entry) => entry.id))) ctx.addIssue({ code: "custom", message: `knowledge entry ${repeated} is listed twice`, path: ["knowledge"] });
    for (const repeated of unique(bundle.steps.map((entry) => entry.id))) ctx.addIssue({ code: "custom", message: `step ${repeated} is listed twice`, path: ["steps"] });
    if (bundle.steps.every((entry) => entry.optional)) ctx.addIssue({ code: "custom", message: "no step is required", path: ["steps"] });
    const named = (ids: string[], path: (string | number)[]) => {
      for (const entry of ids) if (!known.has(entry)) ctx.addIssue({ code: "custom", message: `${entry} names no knowledge entry`, path });
    };
    const checkLine = (value: z.infer<typeof line>, path: (string | number)[]) => {
      named(value.mentions, [...path, "mentions"]);
      named(value.reveals, [...path, "reveals"]);
    };
    const checkLadder = (rungs: z.infer<typeof ladder>, path: (string | number)[]) =>
      rungs.forEach((value, index) => {
        checkLine(value, [...path, index]);
        value.alts.forEach((entry, altIndex) => checkLine(entry, [...path, index, "alts", altIndex]));
        const low = value.level < zoneLevel;
        if (low && value.zone) ctx.addIssue({ code: "custom", message: `a level ${value.level} rung carries a zone`, path: [...path, index, "zone"] });
        value.alts.forEach((entry, altIndex) => {
          if (low && entry.zone) ctx.addIssue({ code: "custom", message: `an Alt for a level ${value.level} rung carries a zone`, path: [...path, index, "alts", altIndex, "zone"] });
        });
      });
    bundle.steps.forEach((value, index) => {
      const path = ["steps", index];
      for (const required of value.requires) if (!steps.has(required) || required === value.id) ctx.addIssue({ code: "custom", message: `${required} names no other step`, path: [...path, "requires"] });
      checkLine(value.onSuccess, [...path, "onSuccess"]);
      if (value.milestone) checkLine(value.milestone, [...path, "milestone"]);
      checkLadder(value.ladder, [...path, "ladder"]);
      for (const repeated of unique(value.parts.map((entry) => entry.id))) ctx.addIssue({ code: "custom", message: `part ${repeated} is listed twice`, path: [...path, "parts"] });
      value.parts.forEach((entry, partIndex) => checkLadder(entry.ladder, [...path, "parts", partIndex, "ladder"]));
      value.headsUps.forEach((entry, headsUpIndex) => named(entry.mentions, [...path, "headsUps", headsUpIndex, "mentions"]));
    });
  });

export type Bundle = z.infer<typeof bundleSchema>;

export type PublishedMap = {
  game: string;
  map: string;
  name: Record<Language, string>;
  test: boolean;
  art: Bundle["art"];
  image: { digest: string; width: number; height: number } | null;
  version: number;
};

export type Viewer = { name: string; image: string | null; discordId: string };
