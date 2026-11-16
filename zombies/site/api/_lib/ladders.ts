import type { Bundle, Language } from "../../shared/bundle.js";

export type Step = Bundle["steps"][number];
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
  return next !== undefined;
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
  return knowledge
    .filter((entry) => [...Object.values(entry.name), ...Object.values(entry.aliases).flat()].some((name) => haystack.includes(` ${core(name)} `)))
    .map((entry) => entry.id);
}

export const isReady = (step: Step, done: Set<string>) => step.requires.every((id) => done.has(id));

export function withRequires(steps: Step[], stepId: string): string[] {
  const found = new Set<string>();
  const visit = (id: string) => {
    if (found.has(id)) return;
    found.add(id);
    for (const required of steps.find((step) => step.id === id)?.requires ?? []) visit(required);
  };
  visit(stepId);
  return [...found];
}

export function blockerOf(steps: Step[], stepId: string, done: Set<string>): Step | null {
  const seen = new Set<string>();
  let current = steps.find((step) => step.id === stepId);
  while (current && !isReady(current, done)) {
    if (seen.has(current.id)) return null;
    seen.add(current.id);
    const missing = current.requires.find((id) => !done.has(id));
    current = steps.find((step) => step.id === missing);
  }
  return current && current.id !== stepId ? current : null;
}
