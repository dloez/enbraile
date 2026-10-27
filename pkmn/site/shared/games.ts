import * as z from "zod";

export const gameName = z.string().trim().min(1).max(100);

export const newGame = z.object({ name: gameName });

export const DEFAULT_ABILITY_SETAS = 1;

export const DEFAULT_MINT_PRICE = 30000;

export const MAX_COST = 9999999;

export const gameCosts = z.object({
  abilitySetas: z.number().int().min(0).max(99),
  mintPrice: z.number().int().min(0).max(MAX_COST),
});

export const DEFAULT_COSTS: GameCosts = { abilitySetas: DEFAULT_ABILITY_SETAS, mintPrice: DEFAULT_MINT_PRICE };

export const zipName = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((name) => name.toLowerCase().endsWith(".zip"), "Not a zip");

export const uploadRequest = z.object({ fileName: zipName, size: z.number().int().positive() });

export const uploadTicket = z.object({ key: z.string(), uploadId: z.string(), partSize: z.number().int().positive() });

const openUpload = z.object({ key: z.string().min(1), uploadId: z.string().min(1) });

export const partRequest = openUpload.extend({ size: z.number().int().positive(), part: z.number().int().positive() });

export const partTicket = z.object({ url: z.string() });

export const uploadDone = openUpload.extend({
  fileName: zipName,
  parts: z.array(z.object({ part: z.number().int().positive(), etag: z.string().min(1) })).min(1),
});

export const uploadAbort = openUpload;

export const uploadAborted = z.object({});

export const game = z.object({
  id: z.string(),
  name: z.string(),
  fileName: z.string().nullable(),
  fileSize: z.number().nullable(),
  uploadedAt: z.string().nullable(),
  itemIcons: z.int().nullable(),
  costs: gameCosts,
});

export const gameList = z.array(game);

export const downloadLink = z.object({ url: z.string() });

export type Game = z.infer<typeof game>;

export type GameCosts = z.infer<typeof gameCosts>;

export type UploadTicket = z.infer<typeof uploadTicket>;
