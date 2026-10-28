import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Dex } from "@pkmn/dex";

const CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
const SPANISH = "7";
const DIR = new URL("../src/i18n/es/", import.meta.url);
const NAMES = new URL("names.json", DIR);
const DESCS = new URL("descs.json", DIR);
const LOCK = new URL("descs.lock.json", DIR);
const EXTRA = new URL("names.extra.json", DIR);

const gen = Dex.forGen(9);

type Kind = "moves" | "abilities" | "items";
const KINDS: readonly Kind[] = ["moves", "abilities", "items"];
type Texts = Record<Kind, Record<string, string>>;

const toId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) rows.push([...row, cell]);
  return rows.slice(1);
}

async function csv(name: string): Promise<string[][]> {
  const response = await fetch(`${CSV}/${name}.csv`);
  if (!response.ok) throw new Error(`${name}.csv: ${response.status}`);
  return parseCsv(await response.text());
}

async function spanishNames(table: string, names: string, wanted: (id: string) => string | null): Promise<Record<string, string>> {
  const ids = new Map((await csv(table)).map(([pokeapiId, identifier]) => [pokeapiId, identifier]));
  const found: Record<string, string> = {};
  for (const [pokeapiId, language, name] of await csv(names)) {
    if (language !== SPANISH) continue;
    const identifier = ids.get(pokeapiId);
    const id = identifier && wanted(toId(identifier));
    if (id) found[id] = name;
  }
  return found;
}

function read<T>(url: URL, empty: T): T {
  try {
    return JSON.parse(readFileSync(url, "utf8")) as T;
  } catch {
    return empty;
  }
}

function write(url: URL, value: unknown) {
  writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`);
}

const sorted = (record: Record<string, string>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);

function english(kind: Kind): Map<string, string> {
  return new Map(
    gen[kind]
      .all()
      .filter((entry) => entry.isNonstandard !== "CAP")
      .map((entry) => [entry.id, entry.shortDesc || entry.desc] as const)
      .filter(([, text]) => text !== ""),
  );
}

async function names() {
  const known = (kind: Kind | "natures" | "types") => {
    const ids = new Set<string>((gen[kind].all() as readonly { id: string }[]).map((entry) => entry.id));
    return (id: string) => (ids.has(id) ? id : null);
  };
  const out: Record<string, Record<string, string>> = {};
  const report: string[] = [];
  for (const [kind, table, names] of [
    ["moves", "moves", "move_names"],
    ["abilities", "abilities", "ability_names"],
    ["items", "items", "item_names"],
    ["natures", "natures", "nature_names"],
  ] as const) {
    const found = await spanishNames(table, names, known(kind));
    out[kind] = sorted(found);
    const extra = read<Record<string, Record<string, string>>>(EXTRA, {})[kind] ?? {};
    const missing = (gen[kind].all() as readonly { id: string; isNonstandard?: string | null }[]).filter((entry) => entry.isNonstandard !== "CAP" && !(entry.id in found) && !(entry.id in extra));
    report.push(`${kind}: ${Object.keys(found).length} named, ${missing.length} left in English`);
  }
  const types = gen.types.all().map((type) => type.name);
  const byId = new Map(types.map((name) => [toId(name), name]));
  const found = await spanishNames("types", "type_names", (id) => byId.get(id) ?? null);
  out.types = found;
  report.push(`types: ${Object.keys(found).length} of ${types.length} named`);
  const extra = read<Record<string, Record<string, string>>>(EXTRA, {});
  for (const [kind, list] of Object.entries(extra)) out[kind] = sorted({ ...out[kind], ...list });
  write(NAMES, out);
  console.log(report.join("\n"));
}

function pending(path: string) {
  const descs = read<Texts>(DESCS, { moves: {}, abilities: {}, items: {} });
  const lock = read<Texts>(LOCK, { moves: {}, abilities: {}, items: {} });
  const out: Texts = { moves: {}, abilities: {}, items: {} };
  for (const kind of KINDS) {
    for (const [id, text] of english(kind)) {
      if (descs[kind][id] === undefined || lock[kind][id] !== hash(text)) out[kind][id] = text;
    }
  }
  write(new URL(path, `file://${process.cwd()}/`), out);
  console.log(KINDS.map((kind) => `${kind}: ${Object.keys(out[kind]).length} to translate`).join("\n"));
}

function apply(paths: string[]) {
  const descs = read<Texts>(DESCS, { moves: {}, abilities: {}, items: {} });
  const lock = read<Texts>(LOCK, { moves: {}, abilities: {}, items: {} });
  for (const path of paths) {
    const done = read<Partial<Texts>>(new URL(path, `file://${process.cwd()}/`), {});
    for (const kind of KINDS) {
      const source = english(kind);
      for (const [id, text] of Object.entries(done[kind] ?? {})) {
        const from = source.get(id);
        if (from === undefined) throw new Error(`${path}: ${kind}/${id} is not in the dex`);
        descs[kind][id] = text;
        lock[kind][id] = hash(from);
      }
    }
  }
  for (const kind of KINDS) {
    const source = english(kind);
    for (const id of Object.keys(descs[kind])) {
      if (!source.has(id)) {
        delete descs[kind][id];
        delete lock[kind][id];
      }
    }
    descs[kind] = sorted(descs[kind]);
    lock[kind] = sorted(lock[kind]);
  }
  write(DESCS, descs);
  write(LOCK, lock);
  console.log(KINDS.map((kind) => `${kind}: ${Object.keys(descs[kind]).length} translated`).join("\n"));
}

const [command, ...rest] = process.argv.slice(2);
if (command === "names") await names();
else if (command === "pending" && rest[0]) pending(rest[0]);
else if (command === "apply" && rest.length > 0) apply(rest);
else {
  console.error("usage: npm run dex-es -- names | pending <out.json> | apply <translated.json>...");
  process.exit(1);
}
