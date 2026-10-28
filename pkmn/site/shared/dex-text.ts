import { messages } from "./i18n.js";

export type DexKind = "moves" | "abilities" | "items" | "natures";

export type DexNames = Record<DexKind | "types", Record<string, string>>;

export type DexDescs = Record<Exclude<DexKind, "natures">, Record<string, string>>;

let names: DexNames | null = null;

let descs: DexDescs | null = null;

export function setDexText(nextNames: DexNames, nextDescs: DexDescs) {
  names = nextNames;
  descs = nextDescs;
}

export function dexName(kind: DexKind, id: string, english: string): string {
  return names?.[kind][id] ?? english;
}

export function dexDesc(kind: Exclude<DexKind, "natures">, id: string, english: string): string {
  return descs?.[kind][id] ?? english;
}

export function typeLabel(type: string): string {
  return names?.types[type] ?? type;
}

const CATEGORIES = messages<Record<string, string>>({
  en: { Physical: "Physical", Special: "Special", Status: "Status" },
  es: { Physical: "Físico", Special: "Especial", Status: "Estado" },
});

export function categoryLabel(category: string): string {
  return CATEGORIES[category] ?? category;
}
