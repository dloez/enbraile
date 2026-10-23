import * as z from "zod";

export const player = z.object({
  id: z.string(),
  name: z.string(),
  allowed: z.boolean(),
  joinedAt: z.string(),
});

export const playerList = z.array(player);

export const allowedChange = z.object({ allowed: z.boolean() });

export type Player = z.infer<typeof player>;
