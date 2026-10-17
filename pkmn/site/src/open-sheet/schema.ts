import { z } from "zod";

const id = z.string().min(1);

export const pokemonSchema = z.object({
  species: id,
  nickname: z.string().nullable(),
  gender: z.enum(["M", "F", "N"]).nullable(),
  shiny: z.boolean(),
  level: z.int().nullable(),
  nature: id.nullable(),
  ability: id.nullable(),
  abilities: z
    .object({
      base: z.array(id),
      hidden: z.array(id),
    })
    .nullable(),
  types: z.array(id).min(1).max(2),
  moves: z
    .object({
      current: z.array(id).max(4),
      relearner: z.array(id),
      tms: z.array(id),
      unchecked: z.array(id),
    })
    .optional(),
});

export const itemSchema = z.object({
  item: id,
  quantity: z.int().positive(),
});

export const tmSchema = z.object({
  item: id,
  move: id,
});

export const sheetSchema = z.object({
  pokemon: z.array(pokemonSchema),
  items: z.array(itemSchema),
  tms: z.array(tmSchema),
});

export type Sheet = z.infer<typeof sheetSchema>;
export type SheetPokemon = z.infer<typeof pokemonSchema>;
export type SheetItem = z.infer<typeof itemSchema>;
export type SheetTm = z.infer<typeof tmSchema>;

export type Checked = { ok: true; sheet: Sheet } | { ok: false; reason: string };

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) => (typeof key === "number" ? `[${key}]` : index === 0 ? String(key) : `.${String(key)}`))
    .join("");
}

function hasKey(data: unknown, path: readonly PropertyKey[]): boolean {
  let node: unknown = data;
  for (const key of path) {
    if (node === null || typeof node !== "object" || !(key in node)) return false;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return true;
}

function describe(issue: z.core.$ZodIssue, data: unknown): string {
  const path = `\`${formatPath(issue.path)}\``;
  if (issue.path.length === 0) return "is not an export";
  if (!hasKey(data, issue.path)) {
    return issue.code === "invalid_type" && issue.expected === "array" ? `has no ${path} list` : `has no ${path}`;
  }
  if (issue.code === "invalid_type") return `has ${path} that is not ${article(issue.expected)}`;
  return `has an invalid ${path}`;
}

function article(expected: string): string {
  return /^[aeiou]/.test(expected) ? `an ${expected}` : `a ${expected}`;
}

export function checkSheet(data: unknown): Checked {
  const result = sheetSchema.safeParse(data);
  if (result.success) return { ok: true, sheet: result.data };
  return { ok: false, reason: describe(result.error.issues[0], data) };
}

export function readSheet(text: string): Checked {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "is not JSON" };
  }
  return checkSheet(data);
}

export function tabName(fileName: string): string {
  const stem = fileName.replace(/\.json$/i, "").replace(/-open-sheet$/i, "");
  return stem === "" ? fileName : stem;
}
