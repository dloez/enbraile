import type { Json } from "../../../shared/snapshot.js";
import { RubyObject, RubySymbol, text } from "./marshal.js";

export function rubyTime(value: unknown): string | null {
  const dumped = value instanceof RubyObject ? value.ivars.get("_dump") : undefined;
  if (!(dumped instanceof Uint8Array) || dumped.length < 8) return null;
  const view = new DataView(dumped.buffer, dumped.byteOffset, dumped.byteLength);
  const high = view.getUint32(0, true);
  const low = view.getUint32(4, true);
  if ((high & 0x80000000) === 0) return null;
  const at = Date.UTC(((high >>> 14) & 0xffff) + 1900, (high >>> 10) & 0xf, (high >>> 5) & 0x1f, high & 0x1f, (low >>> 26) & 0x3f, (low >>> 20) & 0x3f, Math.floor((low & 0xfffff) / 1000));
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

export type Shaper = (object: RubyObject) => Json | undefined;

function ivarName(key: string): string {
  return key.replace(/^@/, "");
}

export function plain(value: unknown, shape?: Shaper, path: Set<unknown> = new Set()): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (value instanceof RubySymbol) return value.name;
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (path.has(value)) return "[cycle]";
  path.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => plain(entry, shape, path));
    if (value instanceof Map) return Object.fromEntries([...value].map(([key, entry]) => [text(key), plain(entry, shape, path)]));
    if (value instanceof RubyObject) {
      const shaped = shape?.(value);
      if (shaped !== undefined) return shaped;
      if (value.cls === "Time") return rubyTime(value);
      if (value.cls.startsWith("GameData::") && value.ivars.has("@id")) return text(value.get("id"));
      if (value.cls === "Set") return value.get("hash") instanceof Map ? [...(value.get("hash") as Map<unknown, unknown>).keys()].map(text) : [];
      return { _class: value.cls, ...Object.fromEntries([...value.ivars].map(([key, entry]) => [ivarName(key), plain(entry, shape, path)])) };
    }
    return String(value);
  } finally {
    path.delete(value);
  }
}

export function plainIvars(object: RubyObject | undefined, skip: ReadonlySet<string>, shape?: Shaper): { [key: string]: Json } {
  if (!object) return {};
  return Object.fromEntries(
    [...object.ivars].filter(([key]) => !skip.has(ivarName(key))).map(([key, entry]) => [ivarName(key), plain(entry, shape)]),
  );
}
