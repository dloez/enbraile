import * as z from "zod";

export const gameName = z.string().trim().min(1).max(100);

export const newGame = z.object({ name: gameName });

export const zipName = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((name) => name.toLowerCase().endsWith(".zip"), "Not a zip");

export const uploadRequest = z.object({ fileName: zipName, size: z.number().int().positive() });

export const uploadTicket = z.object({ key: z.string(), url: z.string() });

export const uploadDone = z.object({ key: z.string().min(1), fileName: zipName });

export const game = z.object({
  id: z.string(),
  name: z.string(),
  fileName: z.string().nullable(),
  fileSize: z.number().nullable(),
  uploadedAt: z.string().nullable(),
});

export const gameList = z.array(game);

export const downloadLink = z.object({ url: z.string() });

export type Game = z.infer<typeof game>;
