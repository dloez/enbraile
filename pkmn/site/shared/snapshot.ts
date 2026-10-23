import * as z from "zod";

const id = z.string().min(1);

const spread = z
  .object({ hp: z.int(), atk: z.int(), def: z.int(), spa: z.int(), spd: z.int(), spe: z.int() })
  .nullable();

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
  ivs: spread,
  evs: spread,
  stats: spread,
  moves: z
    .object({
      current: z.array(id).max(4),
      relearner: z.array(id),
      tms: z.array(id),
    })
    .optional(),
  personalId: z.int().nullable().optional(),
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

export const snapshotSchema = sheetSchema.extend({
  fainted: z.array(member),
  party: z.array(member.extend({ fainted: z.boolean() })),
  bag: z.array(pocketSchema),
  trainer: z.object({
    name: z.string().nullable(),
    id: z.int().nullable(),
    publicId: z.int().nullable(),
    money: z.int().nullable(),
    badges: z.array(z.boolean()),
  }),
  playTime: z.number().nullable(),
  pokedex: z.object({ seen: z.int(), owned: z.int() }),
  records: z.object({
    trainerBattlesWon: z.int().nullable(),
    trainerBattlesLost: z.int().nullable(),
    wildBattlesWon: z.int().nullable(),
    wildBattlesLost: z.int().nullable(),
    blackouts: z.int().nullable(),
  }),
  hallOfFame: z.int(),
  usedEncounters: z.array(z.int()),
  saveSlot: z.string().nullable(),
  randomlockeVersion: z.int().nullable(),
  notices: z.array(z.string()),
});

export type Sheet = z.infer<typeof sheetSchema>;
export type SheetPokemon = z.infer<typeof pokemonSchema>;
export type SheetItem = z.infer<typeof itemSchema>;
export type SheetTm = z.infer<typeof tmSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotMember = z.infer<typeof member>;
