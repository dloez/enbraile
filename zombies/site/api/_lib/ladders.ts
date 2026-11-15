import type { Bundle, Language } from "../../shared/bundle.js";

type Step = Bundle["steps"][number];
export type Rung = Step["ladder"][number];
export type Line = { text: Record<Language, string>; mentions: string[]; reveals: string[] };

export type Ladder = {
  handle: string;
  stepId: string;
  partId: string | null;
  partOf: string | null;
  optional: boolean;
  rungs: Rung[];
};

export const ladderKey = (stepId: string, partId: string | null) => (partId ? `${stepId}/${partId}` : stepId);

export function laddersOf(steps: Step[]): Ladder[] {
  return steps.flatMap((step, index) => {
    const handle = `s${index + 1}`;
    return [
      { handle, stepId: step.id, partId: null, partOf: null, optional: step.optional, rungs: step.ladder },
      ...step.parts.map((part, partIndex) => ({
        handle: `${handle}p${partIndex + 1}`,
        stepId: step.id,
        partId: part.id,
        partOf: handle,
        optional: step.optional,
        rungs: part.ladder,
      })),
    ];
  });
}

export const speakable = (line: Line, known: Set<string>) => line.mentions.every((id) => known.has(id));

export function lineAt(rung: Rung, alt: number | null): Line | null {
  if (alt === null) return rung;
  return rung.alts[alt] ?? null;
}

export function hasMore(ladder: Ladder, given: number): boolean {
  const next = ladder.rungs[given];
  return next !== undefined && next.level < 4;
}

function strip(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const articles = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "the", "a", "an", "lo"]);

function core(name: string): string {
  const words = strip(name).split(" ");
  while (words.length > 1 && articles.has(words[0]!)) words.shift();
  return words.join(" ");
}

export function namedIn(text: string, knowledge: Bundle["knowledge"]): string[] {
  const haystack = ` ${strip(text)} `;
  return knowledge.filter((entry) => Object.values(entry.name).some((name) => haystack.includes(` ${core(name)} `))).map((entry) => entry.id);
}
