import * as z from "zod";

const id = z.string().min(1);

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const json: z.ZodType<Json> = z.lazy(() => z.union([z.null(), z.boolean(), z.number(), z.string(), z.array(json), z.record(z.string(), json)]));

const spread = z
  .object({ hp: z.int(), atk: z.int(), def: z.int(), spa: z.int(), spd: z.int(), spe: z.int() })
  .nullable();

const pokemonFields = {
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
  ivs: spread,
  evs: spread,
  stats: spread,
  moves: z.object({
    current: z.array(id).max(4),
    relearner: z.array(id),
    tms: z.array(id),
    levels: z.record(id, z.int()).optional(),
  }),
};

const intOrNull = z.int().nullable();

const pokemonDetails = z.object({
  gameSpecies: id,
  form: intOrNull,
  heldItem: z.object({ item: id, showdown: id.nullable() }).nullable(),
  exp: intOrNull,
  happiness: intOrNull,
  ball: z.string().nullable(),
  mintedFrom: id.nullable(),
  abilityIndex: intOrNull,
  moveSlots: z.array(z.object({ move: id, showdown: id.nullable(), pp: intOrNull, ppUp: intOrNull })),
  firstMoves: z.array(id),
  owner: z.object({ name: z.string().nullable(), id: intOrNull, gender: intOrNull }).nullable(),
  obtained: z.object({ method: intOrNull, map: intOrNull, level: intOrNull, text: z.string().nullable(), at: intOrNull, hatchedMap: intOrNull, hatchedAt: intOrNull }),
  pokerus: intOrNull,
  markings: z.array(z.int()),
  ribbons: z.array(z.string()),
  contest: z.object({ cool: intOrNull, beauty: intOrNull, cute: intOrNull, smart: intOrNull, tough: intOrNull, sheen: intOrNull }),
  superShiny: z.boolean(),
  rest: z.record(z.string(), json).optional(),
});

export const pokemonSchema = z.object({
  species: id,
  nickname: pokemonFields.nickname.catch(null),
  gender: pokemonFields.gender.catch(null),
  shiny: pokemonFields.shiny.catch(false),
  level: pokemonFields.level.catch(null),
  nature: pokemonFields.nature.catch(null),
  ability: pokemonFields.ability.catch(null),
  abilities: pokemonFields.abilities.catch(null),
  types: pokemonFields.types.catch([]),
  ivs: pokemonFields.ivs.catch(null),
  evs: pokemonFields.evs.catch(null),
  stats: pokemonFields.stats.catch(null),
  moves: pokemonFields.moves.optional().catch(undefined),
  personalId: z.int().nullable().optional().catch(null),
  details: pokemonDetails.optional().catch(undefined),
});

export const itemSchema = z.object({
  item: id,
  showdown: id.nullable(),
  pocket: z.int().nullable(),
  quantity: z.int().positive(),
});

export const legacyItemSchema = z.object({
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

const member = z.object({
  species: id.nullable(),
  gameSpecies: id,
  nickname: z.string().nullable(),
  level: z.int().nullable(),
  personalId: z.int().nullable(),
});

export const pocketSchema = z.object({
  pocket: z.int().min(1).max(8),
  items: z.array(z.object({ item: id, showdown: id.nullable(), quantity: z.int() })),
});

export const faintedSchema = pokemonSchema.extend({
  species: id.nullable(),
  gameSpecies: id,
  personalId: z.int().nullable().catch(null),
});

const saveDetails = z.object({
  trainer: z.object({ gender: intOrNull, trainerType: z.string().nullable(), coins: intOrNull, battlePoints: intOrNull, soot: intOrNull }),
  boxes: z.array(z.object({ name: z.string().nullable(), size: z.int() })),
  position: z.object({ map: intOrNull, x: intOrNull, y: intOrNull, direction: intOrNull }),
  startedAt: z.string().nullable(),
  savedAt: z.string().nullable(),
  steps: intOrNull,
  saveCount: intOrNull,
  gameVersion: z.string().nullable(),
  pokedex: z.object({
    seen: z.array(id),
    owned: z.array(id),
    seenForms: z.record(z.string(), json).optional(),
    lastSeenForms: z.record(z.string(), json).optional(),
    seenEggs: z.array(id).optional(),
    caughtCounts: z.record(z.string(), z.int()).optional(),
    defeatedCounts: z.record(z.string(), z.int()).optional(),
    ownedShadow: z.array(id).optional(),
    unlockedDexes: z.array(z.boolean()).optional(),
    accessibleDexes: z.array(z.int()).optional(),
  }),
  gameStats: z.record(z.string(), z.number()),
  challenge: z.object({ rules: z.array(z.string()), outcomes: z.array(z.string()) }),
  vial: z.object({ charges: intOrNull, max: intOrNull }).nullable(),
  hallOfFame: z.array(z.array(member)),
  itemsFound: z.array(z.string()),
});

export const snapshotSchema = sheetSchema.extend({
  fainted: z.array(faintedSchema),
  bag: z.array(pocketSchema),
  trainer: z.object({
    name: z.string().nullable(),
    id: z.int().nullable(),
    publicId: z.int().nullable(),
    money: z.int().nullable(),
    badges: z.array(z.boolean()),
  }),
  playTime: z.number().nullable(),
  pokedex: z.object({ seen: z.int().nullable(), owned: z.int().nullable() }),
  records: z.object({
    trainerBattlesWon: z.int().nullable(),
    trainerBattlesLost: z.int().nullable(),
    wildBattlesWon: z.int().nullable(),
    wildBattlesLost: z.int().nullable(),
    blackouts: z.int().nullable(),
  }),
  hallOfFame: z.int().nullable(),
  usedEncounters: z.array(z.int()),
  saveSlot: z.string().nullable(),
  randomlockeVersion: z.int().nullable(),
  notices: z.array(z.string()),
  details: saveDetails.optional().catch(undefined),
});

export const EXPORT_GAPS = [
  "ivs",
  "evs",
  "stats",
  "moves",
  "tmRolls",
  "level",
  "nature",
  "ability",
  "abilities",
  "types",
  "gender",
  "nickname",
  "shiny",
  "items",
  "tms",
] as const;

export type ExportGap = (typeof EXPORT_GAPS)[number];

export const exportReport = z.object({
  missing: z.array(z.enum(EXPORT_GAPS)),
  skipped: z.int(),
});

export type ExportReport = z.infer<typeof exportReport>;

const POKEMON_GAPS = ["ivs", "evs", "stats", "moves", "level", "nature", "ability", "abilities", "types", "gender", "nickname", "shiny"] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entries<T extends z.ZodType>(list: unknown, schema: T): { read: z.infer<T>[]; raw: unknown[]; skipped: number; absent: boolean } {
  if (!Array.isArray(list)) return { read: [], raw: [], skipped: 0, absent: true };
  const read: z.infer<T>[] = [];
  const raw: unknown[] = [];
  for (const entry of list) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      read.push(parsed.data);
      raw.push(entry);
    }
  }
  return { read, raw, skipped: list.length - read.length, absent: false };
}

export function readExport(
  data: unknown,
  item: (showdown: string, quantity: number) => SheetItem,
): { sheet: Sheet; report: ExportReport } | { refused: string } {
  if (!record(data)) return { refused: "This file is not an export" };
  const pokemon = entries(data.pokemon, pokemonSchema);
  const items = entries(data.items, legacyItemSchema);
  const tms = entries(data.tms, tmSchema);
  if (pokemon.read.length + items.read.length + tms.read.length === 0) return { refused: "Nothing in this export can be read" };
  const gaps = new Set<ExportGap>();
  for (const entry of pokemon.raw) {
    if (!record(entry)) continue;
    for (const key of POKEMON_GAPS) if (!(key in entry) || !pokemonFields[key].safeParse(entry[key]).success) gaps.add(key);
    if (record(entry.moves) && "unchecked" in entry.moves) gaps.add("tmRolls");
  }
  if (items.absent) gaps.add("items");
  if (tms.absent) gaps.add("tms");
  return {
    sheet: { pokemon: pokemon.read, items: items.read.map((entry) => item(entry.item, entry.quantity)), tms: tms.read },
    report: { missing: EXPORT_GAPS.filter((gap) => gaps.has(gap)), skipped: pokemon.skipped + items.skipped + tms.skipped },
  };
}

const GAP_LABEL: Record<ExportGap, string> = {
  ivs: "IVs",
  evs: "EVs",
  stats: "stats",
  moves: "moves",
  tmRolls: "TM rolls",
  level: "levels",
  nature: "natures",
  ability: "abilities",
  abilities: "possible abilities",
  types: "types",
  gender: "genders",
  nickname: "nicknames",
  shiny: "shiny marks",
  items: "items",
  tms: "TMs",
};

function gapGroups(report: ExportReport): string[][] {
  const spread = (["ivs", "evs", "stats"] as const).filter((gap) => report.missing.includes(gap));
  const rest = report.missing.filter((gap) => gap !== "ivs" && gap !== "evs" && gap !== "stats");
  return [spread, ...rest.map((gap) => [gap])].filter((group) => group.length > 0).map((group) => group.map((gap) => GAP_LABEL[gap as ExportGap]));
}

export function missingList(report: ExportReport): string {
  return gapGroups(report)
    .map((labels) => labels.join(", "))
    .join(" · ");
}

export type Sheet = z.infer<typeof sheetSchema>;
export type SheetPokemon = z.infer<typeof pokemonSchema>;
export type SheetItem = z.infer<typeof itemSchema>;
export type SheetTm = z.infer<typeof tmSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotMember = z.infer<typeof member>;
export type FaintedPokemon = z.infer<typeof faintedSchema>;
export type PokemonDetails = z.infer<typeof pokemonDetails>;
export type SaveDetails = z.infer<typeof saveDetails>;
