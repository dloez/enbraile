import * as z from "zod";
import { exportReport, snapshotSchema } from "./snapshot.js";

export const pcMilestone = z.object({ name: z.string(), taken: z.boolean() });

export const pcPage = z.object({
  player: z.object({ id: z.string(), name: z.string() }),
  series: z.object({ number: z.number().int(), name: z.string() }),
  milestones: z.array(pcMilestone),
  milestone: z.string().nullable(),
  snapshot: snapshotSchema.nullable(),
  missing: exportReport.nullable(),
});

export type PcPage = z.infer<typeof pcPage>;
