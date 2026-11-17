import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import type { Bundle } from "../../shared/bundle.js";
import { db } from "./db.js";
import { laddersOf, withRequires } from "./ladders.js";
import { bundleVersions, maps, messages, runs, runSteps } from "./schema.js";

const lineLimit = 300;
const deadlineMs = 30 * 1000;

const prompt = `You read the chat of a group playing a Zombies easter egg. For each listed step, find the line in which a player first reported it finished, as its "Done when" describes, in any words. Plans, guesses, questions, attempts that failed and things merely seen do not count. Call dated once, with each step you found and the number of that line; leave out a step no line reports.`;

const tool: Anthropic.Tool = {
  name: "dated",
  description: "The line in which the players first reported each listed step finished.",
  input_schema: {
    type: "object",
    properties: {
      found: {
        type: "array",
        items: {
          type: "object",
          properties: { step: { type: "string", description: "A handle such as s4." }, line: { type: "integer", description: "The line's number." } },
          required: ["step", "line"],
          additionalProperties: false,
        },
      },
    },
    required: ["found"],
    additionalProperties: false,
  },
};

export async function dateEarlierSteps(api: Anthropic, model: string, runId: string): Promise<{ earlier: number; dated: number }> {
  const [row] = await db
    .select({ steps: bundleVersions.bundle })
    .from(runs)
    .innerJoin(maps, and(eq(maps.game, runs.game), eq(maps.map, runs.map)))
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .where(eq(runs.id, runId));
  if (!row) return { earlier: 0, dated: 0 };
  const steps: Bundle["steps"] = row.steps.steps;
  const progress = await db
    .select({ stepId: runSteps.stepId, doneAt: runSteps.doneAt })
    .from(runSteps)
    .where(and(eq(runSteps.runId, runId), eq(runSteps.partId, ""), isNotNull(runSteps.doneAt)));
  const doneAt = new Map(progress.map((entry) => [entry.stepId, entry.doneAt!]));
  const earlier = new Set(
    progress.flatMap((entry) => withRequires(steps, entry.stepId).filter((required) => required !== entry.stepId && doneAt.get(required)?.getTime() === entry.doneAt!.getTime())),
  );
  const handles = new Map(laddersOf(steps).filter((ladder) => ladder.partId === null).map((ladder) => [ladder.stepId, ladder.handle]));
  const asked = steps.filter((step) => earlier.has(step.id) && step.doneWhen && handles.has(step.id));
  if (!asked.length) {
    console.log("steps dated", runId, `0 of ${earlier.size} earlier, none with Done when`);
    return { earlier: earlier.size, dated: 0 };
  }
  const latest = new Date(Math.max(...asked.map((step) => doneAt.get(step.id)!.getTime())));
  const lines = (
    await db
      .select({ id: messages.id, name: messages.name, discordId: messages.discordId, text: messages.text, at: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.runId, runId), eq(messages.author, "member"), eq(messages.kind, "chat"), lt(messages.createdAt, latest)))
      .orderBy(desc(messages.id))
      .limit(lineLimit)
  ).reverse();
  if (!lines.length) return { earlier: earlier.size, dated: 0 };
  const listed = asked.map((step) => `- ${handles.get(step.id)}: "${step.doneWhen!.replace(/\s+/g, " ").trim()}"`).join("\n");
  const chat = lines.map((line) => `[${line.id}] ${line.name}: ${line.text.replace(/\s+/g, " ").trim()}`).join("\n");
  const response = await api.messages.create(
    {
      model,
      max_tokens: 400,
      system: prompt,
      tools: [tool],
      tool_choice: { type: "tool", name: "dated" },
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: `Steps:\n${listed}\n\nThe chat, oldest first, each line with its number:\n${chat}` }],
    },
    { signal: AbortSignal.timeout(deadlineMs) },
  );
  const call = response.content.find((block) => block.type === "tool_use");
  const found = Array.isArray((call?.input as { found?: unknown })?.found) ? ((call!.input as { found: { step?: unknown; line?: unknown }[] }).found) : [];
  const byHandle = new Map(asked.map((step) => [handles.get(step.id)!, step.id]));
  const byId = new Map(lines.map((line) => [line.id, line]));
  let dated = 0;
  for (const entry of found) {
    const stepId = typeof entry.step === "string" ? byHandle.get(entry.step) : undefined;
    const line = typeof entry.line === "number" ? byId.get(entry.line) : undefined;
    const was = stepId ? doneAt.get(stepId) : undefined;
    if (!stepId || !line || !was || line.at >= was) continue;
    const moved = await db
      .update(runSteps)
      .set({ doneAt: line.at, doneBy: line.discordId, doneByName: line.name })
      .where(and(eq(runSteps.runId, runId), eq(runSteps.stepId, stepId), eq(runSteps.partId, ""), eq(runSteps.doneAt, was)))
      .returning({ stepId: runSteps.stepId });
    dated += moved.length;
  }
  console.log("steps dated", runId, `${dated} of ${earlier.size} earlier`);
  return { earlier: earlier.size, dated };
}

