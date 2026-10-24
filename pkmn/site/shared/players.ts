import * as z from "zod";

export const player = z.object({
  id: z.string(),
  name: z.string(),
  allowed: z.boolean(),
  invited: z.boolean(),
  joinedAt: z.string(),
});

export const playerList = z.array(player);

export const allowedChange = z.object({ allowed: z.boolean() });

export const invite = z.object({
  discordId: z.string().trim().regex(/^\d{17,20}$/),
  name: z.string().trim().min(1).max(32),
});

export const removed = z.object({ id: z.string() });

export type Player = z.infer<typeof player>;
export type Invite = z.infer<typeof invite>;
