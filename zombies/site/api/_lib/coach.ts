import Anthropic from "@anthropic-ai/sdk";
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, max, or, sql } from "drizzle-orm";
import type { Bundle, Language } from "../../shared/bundle.js";
import type { ReplyEvent, StepIn } from "../../shared/runs.js";
import { anyOf, characterOf, wakeWords, type Character } from "../../shared/voices.js";
import { db } from "./db.js";
import { blockerOf, hasMore, isReady, ladderKey, laddersOf, lineAt, namedIn, speakable, withRequires, type Ladder, type Line } from "./ladders.js";
import { audits, bundleVersions, coachCalls, coachQueue, deliveries, gaps, headsUpsGiven, hintCards, maps, messages, runKnowledge, runMembers, runs, runSteps } from "./schema.js";
import { inBackground } from "./bot.js";
import { speakInCall } from "./voice.js";

const defaultModel = "claude-haiku-5-5";
const maxTokens = 1024;
const maxSteps = 4;
const historyLength = 24;
const roundGapMs = 10 * 60 * 1000;
const leaseMs = 60 * 1000;
const leaseWaitMs = 30 * 1000;
const requestTimeoutMs = 10 * 1000;
const requestRetries = 1;
const callDeadlineMs = 20 * 1000;
const turnDeadlineMs = 45 * 1000;
const leasePollMs = 300;
const silence = "(silence)";

const languageNames: Record<Language, string> = { es: "Spanish", en: "English" };

const recentLines = 8;
const maxMissing = 2;
const maxMilestoneMissing = 3;
const maxOwnSentences = 2;

const systemPrompt = (character: Character) => `You are ${character.name}, ${character.role}. You have beaten it before; they want to solve it themselves, with your prepared hints when they ask. ${character.manner}${character.examples.length ? ` Examples: ${character.examples.map((line) => `«${line}»`).join(" ")}` : ""}

How you speak
- They are mid-round on voice chat: one or two short sentences, in the run's language only; code drops any sentence of your own past the second. Lines marked spoken came through speech recognition; read them by what they most likely said.
- Everything you write is spoken aloud: never write your reasoning, anything from the lists below, square brackets, or step or hint numbers.

Hints
- When they ask for help or a hint, or say they are stuck, hand over the next hint with give_hint at once: on the thread of the most recent hint unless they are clearly asking about something else. Never ask questions first and never refuse. The full solution is a hint like any other: give it when it is next. Never announce a hint in your own words before or instead of give_hint; when give_hint says there is nothing more, tell them plainly there is no further hint on that.
- When what they report matches an Alt's "when", give that Alt.
- A theory or guess put to you ("I think we need…") about an open thread is asking too: give that thread's next hint, or the Alt whose "when" fits what they said, with give_hint at once. Never confirm, deny or comment on the theory in your own words; the hint does that.
- To say a hint again, call repeat_hint. When they ask what a hint already given means, or how to do what it says, explain that hint plainly in your own words, adding nothing it does not say; if it does not answer their question, call hold. Never answer by giving an earlier, vaguer hint again, and never tell them you have already told them everything.
- Anything about the solution comes only from hints. In your own words never say where to go, what to do, what comes next, or whether something they found matters, and never bring up something they have finished with; never name anything not under "What the players know" or in a hint already given; never use your own knowledge of this map.
- If they ask about this map's easter egg and no hint covers it, call hold. When a hint now answers a question under "Held earlier", give it with gap set.

Progress
- Code checks every line for finished steps itself, records them, says the prepared line and hands over what comes next; a note tells you when it did. Never tell them in your own words that they did it or are on track. Call record_progress done only for a part of a step (such as s2p1) they report found, and started when they start something listed. Never offer an optional step.
- When they name something themselves, a theory included, call mark_known with their whole line as they said it.
- Give a heads-up with heads_up only at the moment its "when" describes. Now and then call ask_round, never right after a hint.

Anything else (hearing checks, greetings, jokes, general Zombies questions such as how a perk, a power-up or a mechanic works across the series): answer briefly in your own words, never reusing a sentence you said earlier. Reply with exactly ${silence} only when they are talking among themselves.`;

const tools: Anthropic.Tool[] = [
  {
    name: "give_hint",
    description: "Hand the players the next prepared hint of one ladder, or one of that hint's Alts. It appears on a card under your reply.",
    input_schema: {
      type: "object",
      properties: {
        ladder: { type: "string", description: "The ladder's handle, such as s1 or s2p1." },
        alt: { type: "integer", minimum: 1, description: "The Alt's number, to give that Alt instead of the hint itself." },
        gap: { type: "integer", minimum: 1, description: "When this hint answers a question listed under Held earlier, that question's number." },
      },
      required: ["ladder"],
      additionalProperties: false,
    },
  },
  {
    name: "repeat_hint",
    description: "Say again, word for word, the last hint already handed over on one ladder, when the players ask to hear it again or did not catch it. Code says it in your reply.",
    input_schema: {
      type: "object",
      properties: { ladder: { type: "string", description: "The ladder's handle, such as s1 or s2p1." } },
      required: ["ladder"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_known",
    description: "Record something the players named or described themselves, in their own words, so hints that mention it become available.",
    input_schema: {
      type: "object",
      properties: { said: { type: "string", description: "The players' words naming or describing it." } },
      required: ["said"],
      additionalProperties: false,
    },
  },
  {
    name: "record_progress",
    description: "Record that the players started or finished something, by its ladder's handle. On done, code says the prepared line about it and hands over the first hint of something else they can do.",
    input_schema: {
      type: "object",
      properties: {
        ladder: { type: "string", description: "The ladder's handle, such as s1 or s2p1." },
        status: { type: "string", enum: ["started", "done"] },
        next: { type: "string", description: "On done: the handle of the ready ladder whose first hint to hand over, when what they said points at one." },
        quiet: { type: "boolean", description: "On done: true only when they made clear they already know what they are doing next." },
      },
      required: ["ladder", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "heads_up",
    description: "Say one listed heads-up, at the moment its when describes. Code adds it to your reply.",
    input_schema: {
      type: "object",
      properties: {
        ladder: { type: "string", description: "The handle of the step it belongs to, such as s2." },
        number: { type: "integer", minimum: 1, description: "The heads-up's number in the list." },
      },
      required: ["ladder", "number"],
      additionalProperties: false,
    },
  },
  {
    name: "hold",
    description: "When the players ask about something no listed hint covers. Code says a prepared holding line in your voice and records what they asked so the missing hint can be written. Your reply is then complete.",
    input_schema: {
      type: "object",
      properties: { about: { type: "string", description: "What they asked about, in a few words, for whoever writes the missing hint." } },
      required: ["about"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_round",
    description: "Ask the players which round they are on. The question is added to your reply.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

let client: Anthropic | null = null;

export function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: requestTimeoutMs, maxRetries: requestRetries });
  return client;
}

export const model = () => process.env.COACH_MODEL || defaultModel;

type State = {
  runId: string;
  language: Language;
  character: Character;
  roundAskedAt: Date | null;
  bundle: Bundle;
  version: number;
  ladders: Ladder[];
  known: Set<string>;
  given: Map<string, number>;
  givenLines: Map<string, string[]>;
  latest: string | null;
  recent: string[];
  done: Set<string>;
  started: Set<string>;
  headsUps: Set<string>;
  held: Held[];
  reporter: { discordId: string; name: string } | null;
};

type Held = { id: number; number: number; asked: string };

async function loadState(runId: string): Promise<State | null> {
  const [row] = await db
    .select({ language: runs.language, voice: runs.voice, roundAskedAt: runs.roundAskedAt, bundle: bundleVersions.bundle, version: bundleVersions.version })
    .from(runs)
    .innerJoin(maps, and(eq(maps.game, runs.game), eq(maps.map, runs.map)))
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .where(and(eq(runs.id, runId), isNull(runs.closedAt)));
  if (!row) return null;
  const known = await db.select({ id: runKnowledge.knowledgeId }).from(runKnowledge).where(eq(runKnowledge.runId, runId));
  const rows = await db
    .select({ stepId: deliveries.stepId, partId: deliveries.partId, rung: deliveries.rung, text: deliveries.text, createdAt: deliveries.createdAt })
    .from(deliveries)
    .where(eq(deliveries.runId, runId))
    .orderBy(deliveries.id);
  const progress = await db.select().from(runSteps).where(eq(runSteps.runId, runId));
  const said = await db.select({ stepId: headsUpsGiven.stepId, position: headsUpsGiven.position }).from(headsUpsGiven).where(eq(headsUpsGiven.runId, runId));
  const open = await db
    .select({ id: gaps.id, asked: gaps.asked })
    .from(gaps)
    .where(and(eq(gaps.runId, runId), isNull(gaps.answeredAt), sql`coalesce(${gaps.triedVersion}, ${gaps.bundleVersion}) < ${row.version}`))
    .orderBy(gaps.id);
  const last = rows.at(-1);
  const given = new Map<string, number>();
  const givenLines = new Map<string, string[]>();
  for (const entry of rows) {
    const key = ladderKey(entry.stepId, entry.partId);
    given.set(key, Math.max(given.get(key) ?? 0, entry.rung + 1));
    givenLines.set(key, [...(givenLines.get(key) ?? []), entry.text]);
  }
  return {
    runId,
    language: row.language,
    character: characterOf(row.voice),
    roundAskedAt: row.roundAskedAt,
    bundle: row.bundle,
    version: row.version,
    ladders: laddersOf(row.bundle.steps),
    known: new Set(known.map((entry) => entry.id)),
    given,
    givenLines,
    latest: last ? ladderKey(last.stepId, last.partId) : null,
    recent: [...new Set(rows.map((entry) => ladderKey(entry.stepId, entry.partId)).reverse())],
    done: new Set(progress.filter((entry) => entry.doneAt).map((entry) => ladderKey(entry.stepId, entry.partId || null))),
    started: new Set(progress.filter((entry) => entry.startedAt).map((entry) => ladderKey(entry.stepId, entry.partId || null))),
    headsUps: new Set(said.map((entry) => headsUpKey(entry.stepId, entry.position))),
    held: open.map((entry, index) => ({ id: entry.id, number: index + 1, asked: entry.asked })),
    reporter: null,
  };
}

const headsUpKey = (stepId: string, position: number) => `${stepId}#${position}`;

const keyOf = (ladder: Ladder) => ladderKey(ladder.stepId, ladder.partId);

const stepOf = (state: State, ladder: Ladder) => state.bundle.steps.find((step) => step.id === ladder.stepId)!;

const unknownEntries = (state: State) => state.bundle.knowledge.filter((entry) => !state.known.has(entry.id));

const isDone = (state: State, ladder: Ladder) => state.done.has(ladder.stepId) || state.done.has(keyOf(ladder));

const isOpen = (state: State, ladder: Ladder) => !isDone(state, ladder) && ((state.given.get(keyOf(ladder)) ?? 0) > 0 || state.started.has(keyOf(ladder)));

const stepOpen = (state: State, stepId: string) => !state.done.has(stepId) && state.ladders.some((ladder) => ladder.stepId === stepId && isOpen(state, ladder));

function titleOf(state: State, ladder: Ladder): string | null {
  const step = stepOf(state, ladder);
  const title = ladder.partId ? (step.parts.find((part) => part.id === ladder.partId)?.title ?? "") : step.title;
  return title && !namedIn(title, unknownEntries(state)).length ? title : null;
}

function isFresh(state: State, ladder: Ladder): boolean {
  const first = ladder.rungs[0];
  return !ladder.optional && !isDone(state, ladder) && !isOpen(state, ladder) && isReady(stepOf(state, ladder), state.done) && first !== undefined && speakable(first, state.known);
}

function reportable(state: State, ladder: Ladder): boolean {
  const doneWhen = stepOf(state, ladder).doneWhen;
  return ladder.partId === null && !isDone(state, ladder) && (!ladder.optional || isOpen(state, ladder)) && !!doneWhen && !namedIn(doneWhen, unknownEntries(state)).length;
}

const detectorPrompt = `You read the chat of a group playing a Zombies easter egg and decide which listed steps their newest line reports as finished. A step is finished when they report the outcome its "Done when" describes, about the same thing it names, in any words. A line about a different item finishes nothing. The players speak Spanish or English, often through speech recognition, and call things by their own words: match what they mean, not the wording of "Done when". Plans, guesses, questions, attempts that failed and things merely seen are not finished. Execution steps are finished only on their outcome. A question never reports a step finished. When prepared answers are listed and the newest line asks something one of them is for (its "for when" describes what they ask, in any words), give that answer's handle as answer; otherwise leave it out. Call report once.`;

const reportTool: Anthropic.Tool = {
  name: "report",
  description: "The steps the newest line reports as finished.",
  input_schema: {
    type: "object",
    properties: {
      done: { type: "array", items: { type: "string" }, description: "Handles such as s4, or empty." },
      answer: { type: "string", description: "The handle of the prepared answer the newest line asks for, such as a2, or empty." },
    },
    required: ["done"],
    additionalProperties: false,
  },
};

const doneOnly: Anthropic.Tool = {
  ...reportTool,
  input_schema: { type: "object", properties: { done: { type: "array", items: { type: "string" }, description: "Handles such as s4, or empty." } }, required: ["done"], additionalProperties: false },
};

const milestoneOf = (state: State, ladder: Ladder) => {
  const milestone = stepOf(state, ladder).milestone;
  return milestone && milestone.mentions.every((id) => state.known.has(id)) ? milestone.text[state.language] : null;
};

function described(state: State, ladder: Ladder): string {
  const step = stepOf(state, ladder);
  const names = namedIn(step.doneWhen!, state.bundle.knowledge)
    .map((id) => state.bundle.knowledge.find((entry) => entry.id === id)!)
    .map((entry) => [entry.name.es, entry.name.en, ...entry.aliases.es, ...entry.aliases.en].join(" / "));
  const milestone = milestoneOf(state, ladder);
  return `- ${ladder.handle} (${step.kind ?? "step"}): ${quote(step.doneWhen!)}${milestone ? `; reaching it is ${quote(milestone)}` : ""}${names.length ? `; names they may use: ${names.join("; ")}` : ""}`;
}

const asksQuestion = (line: string) => /[?¿]/.test(line) || /\b(?:como|que|por que|para que|cuando|donde|cual|se puede|podemos|how|what|why|when|where|which|can we|is there)\b/.test(flat(line.replace(/^[^:]*: /, "")));

type OfferedHeadsUp = { stepId: string; position: number; when: string; text: string };

function offeredHeadsUps(state: State): OfferedHeadsUp[] {
  const unknown = unknownEntries(state);
  return state.bundle.steps.flatMap((step) =>
    stepOpen(state, step.id)
      ? step.headsUps.flatMap((headsUp, position) =>
          state.headsUps.has(headsUpKey(step.id, position)) || !headsUp.mentions.every((id) => state.known.has(id)) || namedIn(headsUp.when, unknown).length
            ? []
            : [{ stepId: step.id, position, when: headsUp.when, text: headsUp.text[state.language] }],
        )
      : [],
  );
}

const handlesOf = (call: Anthropic.ContentBlock | undefined, key: string): Set<string> => {
  const value = call?.type === "tool_use" ? (call.input as Record<string, unknown>)[key] : undefined;
  return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : typeof value === "string" && value ? [value] : []);
};

type Detected = { ladders: Ladder[]; headsUp: OfferedHeadsUp | null; logs: CallLog[] };

async function detectProgress(api: Anthropic, state: State, recent: string[], signal: AbortSignal): Promise<Detected> {
  const candidates = state.ladders.filter(
    (ladder) => reportable(state, ladder) && withRequires(state.bundle.steps, ladder.stepId).filter((stepId) => stepId !== ladder.stepId && !state.done.has(stepId)).length <= (milestoneOf(state, ladder) === null ? maxMissing : maxMilestoneMissing),
  );
  const log: CallLog = { stopReason: null, refused: false, refusalCategory: null, violations: [], error: null, latencyMs: 0, usage: null };
  const answers = asksQuestion(recent.at(-1) ?? "") ? offeredHeadsUps(state) : [];
  if (!candidates.length && !answers.length) return { ladders: [], headsUp: null, logs: [log] };
  const started = Date.now();
  const listed = candidates.map((ladder) => described(state, ladder)).join("\n") || "- none";
  const answerList = answers.length ? `\n\nPrepared answers:\n${answers.map((answer, index) => `- a${index + 1}: for when ${quote(answer.when)}`).join("\n")}` : "";
  try {
    const response = await api.messages.create({
      model: model(),
      max_tokens: 200,
      system: detectorPrompt,
      tools: [answers.length ? reportTool : doneOnly],
      tool_choice: { type: "tool", name: "report" },
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: `Steps not recorded as finished:\n${listed}${answerList}\n\nThe chat, oldest first; the last line is the newest:\n${recent.join("\n")}` }],
    }, { signal: AbortSignal.any([signal, AbortSignal.timeout(callDeadlineMs)]) });
    log.latencyMs = Date.now() - started;
    log.usage = response.usage;
    log.stopReason = response.stop_reason;
    const call = response.content.find((block) => block.type === "tool_use");
    const handles = handlesOf(call, "done");
    const picked = [...handlesOf(call, "answer")][0];
    const headsUp = picked && /^a\d+$/.test(picked) ? (answers[Number(picked.slice(1)) - 1] ?? null) : null;
    return { ladders: candidates.filter((ladder) => handles.has(ladder.handle)), headsUp, logs: [log] };
  } catch (error) {
    log.latencyMs = Date.now() - started;
    log.error = error instanceof Error ? error.message : String(error);
    return { ladders: [], headsUp: null, logs: [log] };
  }
}

const isShown = (state: State, ladder: Ladder) => isOpen(state, ladder) || isFresh(state, ladder) || titleOf(state, ladder) !== null;

const firstHints = (state: State) => state.ladders.filter((ladder) => ladder.partId === null && isFresh(state, ladder));

const quote = (text: string) => `"${text.replace(/\s+/g, " ").trim()}"`;

function offers(state: State): string {
  const lang = state.language;
  const unknown = unknownEntries(state);
  const opened: string[] = [];
  const fresh: string[] = [];
  const done: string[] = [];
  const optional: string[] = [];
  const blocked: string[] = [];
  for (const ladder of state.ladders) {
    const key = keyOf(ladder);
    const step = stepOf(state, ladder);
    const title = titleOf(state, ladder) !== null;
    const label = `${ladder.partOf ? `${ladder.handle} (a part of ${ladder.partOf})` : ladder.handle}`;
    const count = state.given.get(key) ?? 0;
    const next = ladder.rungs[count];
    if (isDone(state, ladder)) {
      if (title || count > 0) done.push(`- ${label}`);
    } else if (!isReady(step, state.done)) {
      if (ladder.partId === null && (isOpen(state, ladder) || (title && !ladder.optional))) blocked.push(`- ${label}`);
    } else if (isOpen(state, ladder)) {
      const lines = [`- ${label}. ${count > 0 ? `Given so far: ${(state.givenLines.get(key) ?? []).map(quote).join(" then ")}.` : "Started by the players, no hint given yet."}`];
      if (!next) lines.push("  Nothing more on this ladder.");
      else {
        if (speakable(next, state.known)) lines.push(`  Next hint: ${quote(next.text[lang])}.`);
        next.alts.forEach((alt, index) => {
          if (speakable(alt, state.known) && !namedIn(alt.when, unknown).length) lines.push(`  If ${alt.when}: give_hint ${ladder.handle} with alt ${index + 1}, ${quote(alt.text[lang])}.`);
        });
      }
      opened.push(lines.join("\n"));
    } else if (isFresh(state, ladder)) {
      fresh.push(`- ${label}: ${quote(next!.text[lang])}`);
    } else if (ladder.optional && ladder.partId === null && title) {
      optional.push(`- ${label}`);
    }
  }
  const extras: string[] = [];
  state.bundle.steps.forEach((step, index) => {
    if (!stepOpen(state, step.id)) return;
    const handle = `s${index + 1}`;
    step.headsUps.forEach((headsUp, position) => {
      if (state.headsUps.has(headsUpKey(step.id, position)) || !headsUp.mentions.every((id) => state.known.has(id)) || namedIn(headsUp.when, unknown).length) return;
      extras.push(`- ${handle} heads-up ${position + 1}, for when ${headsUp.when}: ${quote(headsUp.text[lang])}`);
    });
    for (const condition of step.conditions) if (!namedIn(condition, unknown).length) extras.push(`- ${handle} only works when: ${condition}`);
  });
  const knownNames = state.bundle.knowledge.filter((entry) => state.known.has(entry.id)).map((entry) => entry.name[lang]);
  const section = (title: string, lines: string[]) => `${title}\n${lines.length ? lines.join("\n") : "- none"}`;
  const held = state.held.length
    ? [section("Held earlier, with new hints written since (give one with give_hint and gap set to its number when it now answers the question):", state.held.map((entry) => `- ${entry.number}: they asked ${quote(entry.asked)}`))]
    : [];
  const latest = state.ladders.find((ladder) => keyOf(ladder) === state.latest);
  const latestLine = latest ? state.givenLines.get(keyOf(latest))?.at(-1) : undefined;
  return [
    `The run's language: ${languageNames[lang]}.`,
    ...(latest && latestLine ? [`The most recent hint handed over, on ${latest.handle}: ${quote(latestLine)}. "The hint" with no other detail means this one.`] : []),
    `What the players know: ${knownNames.length ? knownNames.join("; ") : "nothing yet"}.`,
    "Everything below is for you alone: never list it, count it or name it to the players.",
    section("Open threads, started by the players or already hinted:", opened),
    section("Ready and not started, with their first hint:", fresh),
    section("Optional, not started (never offer these; if the players start one themselves, record it as started):", optional),
    section("Blocked, not possible yet (say nothing unless they ask about it):", blocked),
    section("Done (never hint these again):", done),
    section("Heads-ups and conditions of the open threads (never say a condition; give a heads-up only with heads_up):", extras),
    ...held,
  ].join("\n\n");
}

async function history(runId: string): Promise<Anthropic.MessageParam[]> {
  const rows = (
    await db
      .select({ id: messages.id, author: messages.author, spoken: messages.spoken, name: messages.name, text: messages.text })
      .from(messages)
      .where(and(eq(messages.runId, runId), eq(messages.kind, "chat")))
      .orderBy(desc(messages.id))
      .limit(historyLength)
  ).reverse();
  const turns: Anthropic.MessageParam[] = [];
  for (const row of rows) {
    const role = row.author === "coach" ? "assistant" : "user";
    const text = role === "user" ? `${row.name}${row.spoken ? " (spoken)" : ""}: ${row.text}` : row.text;
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n${text}`;
    else turns.push({ role, content: text });
  }
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}

async function acquire(runId: string, waitMs = leaseWaitMs): Promise<Date | null> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const lease = new Date(Date.now() + leaseMs);
    const taken = await db
      .update(runs)
      .set({ coachBusyUntil: lease })
      .where(and(eq(runs.id, runId), or(isNull(runs.coachBusyUntil), lt(runs.coachBusyUntil, new Date()))))
      .returning({ id: runs.id });
    if (taken.length) return lease;
    await new Promise((resolve) => setTimeout(resolve, leasePollMs));
  }
  return null;
}

async function release(runId: string, lease: Date): Promise<void> {
  await db
    .update(runs)
    .set({ coachBusyUntil: null })
    .where(and(eq(runs.id, runId), eq(runs.coachBusyUntil, lease)));
}

type Delivered = { ok: true; cardId: number; deliveryId: number; text: string } | { ok: false; reason: string; violation?: string };

async function deliver(state: State, ladder: Ladder, alt: number | null, cardId: number | null, askedBy: string | null): Promise<Delivered> {
  const key = ladderKey(ladder.stepId, ladder.partId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`coach/${state.runId}`}))`);
    const [position] = await tx
      .select({ next: sql<number>`coalesce(max(${deliveries.rung}) + 1, 0)::int` })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.runId, state.runId),
          eq(deliveries.stepId, ladder.stepId),
          ladder.partId ? eq(deliveries.partId, ladder.partId) : isNull(deliveries.partId),
        ),
      );
    const index = position?.next ?? 0;
    const rung = ladder.rungs[index];
    if (!rung) return { ok: false, reason: "There is nothing more on that ladder." };
    const line = lineAt(rung, alt);
    if (!line) return { ok: false, reason: "That hint has no such Alt.", violation: "no-such-alt" };
    const known = new Set(
      (await tx.select({ id: runKnowledge.knowledgeId }).from(runKnowledge).where(eq(runKnowledge.runId, state.runId))).map((entry) => entry.id),
    );
    if (!speakable(line, known)) return { ok: false, reason: "That hint is not one you may give now.", violation: "unknown-mention" };
    let card = cardId;
    if (card === null) {
      const [created] = await tx.insert(hintCards).values({ runId: state.runId, stepId: ladder.stepId, partId: ladder.partId }).returning({ id: hintCards.id });
      card = created!.id;
    }
    const text = line.text[state.language];
    const [delivered] = await tx.insert(deliveries).values({
      runId: state.runId,
      cardId: card,
      stepId: ladder.stepId,
      partId: ladder.partId,
      rung: index,
      alt,
      level: rung.level,
      text,
      mentions: line.mentions,
      reveals: line.reveals,
      bundleVersion: state.version,
      askedBy,
    }).returning({ id: deliveries.id });
    const learned = [...new Set([...line.mentions, ...line.reveals])];
    if (learned.length)
      await tx
        .insert(runKnowledge)
        .values(learned.map((knowledgeId) => ({ runId: state.runId, knowledgeId })))
        .onConflictDoNothing();
    for (const id of learned) state.known.add(id);
    state.given.set(key, index + 1);
    state.givenLines.set(key, [...(state.givenLines.get(key) ?? []), text]);
    state.latest = key;
    return { ok: true, cardId: card, deliveryId: delivered!.id, text };
  });
}

async function learn(state: State, line: Line): Promise<void> {
  const learned = [...new Set([...line.mentions, ...line.reveals])].filter((id) => !state.known.has(id));
  if (!learned.length) return;
  await db
    .insert(runKnowledge)
    .values(learned.map((knowledgeId) => ({ runId: state.runId, knowledgeId })))
    .onConflictDoNothing();
  for (const id of learned) state.known.add(id);
}

async function markSteps(state: State, ladder: Ladder, status: "started" | "done"): Promise<void> {
  const now = new Date();
  const keys = status === "done" && ladder.partId === null ? withRequires(state.bundle.steps, ladder.stepId).map((stepId) => ({ stepId, partId: "" })) : [{ stepId: ladder.stepId, partId: ladder.partId ?? "" }];
  const reported = (key: { stepId: string; partId: string }) =>
    status === "done" && state.reporter && key.stepId === ladder.stepId && key.partId === (ladder.partId ?? "") ? { doneBy: state.reporter.discordId, doneByName: state.reporter.name } : {};
  const set = status === "done" ? { doneAt: now } : { startedAt: now };
  const doneBefore =
    status === "done" && keys.length > 1
      ? new Set(
          (
            await db
              .select({ stepId: runSteps.stepId })
              .from(runSteps)
              .where(and(eq(runSteps.runId, state.runId), eq(runSteps.partId, ""), inArray(runSteps.stepId, keys.map((key) => key.stepId)), sql`${runSteps.doneAt} is not null`))
          ).map((row) => row.stepId),
        )
      : null;
  await db
    .insert(runSteps)
    .values(keys.map((key) => ({ runId: state.runId, ...key, ...set, ...reported(key) })))
    .onConflictDoUpdate({
      target: [runSteps.runId, runSteps.stepId, runSteps.partId],
      set:
        status === "done"
          ? {
              doneAt: sql`coalesce(${runSteps.doneAt}, excluded.done_at)`,
              doneBy: sql`case when ${runSteps.doneAt} is null then excluded.done_by else ${runSteps.doneBy} end`,
              doneByName: sql`case when ${runSteps.doneAt} is null then excluded.done_by_name else ${runSteps.doneByName} end`,
            }
          : { startedAt: sql`coalesce(${runSteps.startedAt}, excluded.started_at)` },
    });
  const implied = doneBefore !== null && keys.some((key) => key.stepId !== ladder.stepId && !doneBefore.has(key.stepId));
  for (const key of keys) (status === "done" ? state.done : state.started).add(ladderKey(key.stepId, key.partId || null));
  const api = anthropic();
  if (implied && api) {
    const { dateEarlierSteps } = await import("./dating.js");
    inBackground(dateEarlierSteps(api, model(), state.runId).catch((error: Error) => console.error("steps dated", state.runId, error.message)));
  }
}

type CallLog = {
  dropped?: Dropped[];
  stopReason: string | null;
  refused: boolean;
  refusalCategory: string | null;
  violations: string[];
  error: string | null;
  latencyMs: number;
  usage: Anthropic.Usage | null;
};

async function logCall(runId: string, log: CallLog): Promise<void> {
  await db.insert(coachCalls).values({
    runId,
    model: model(),
    inputTokens: log.usage?.input_tokens ?? 0,
    outputTokens: log.usage?.output_tokens ?? 0,
    cacheReadTokens: log.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: log.usage?.cache_creation_input_tokens ?? 0,
    latencyMs: log.latencyMs,
    stopReason: log.stopReason,
    refused: log.refused,
    refusalCategory: log.refusalCategory,
    violations: log.violations,
    dropped: log.dropped ?? [],
    error: log.error,
  });
}

const sentenceEnd = /[.!?…:;]["»”')]*\s+|\n+/g;

const named = "pasos?|pistas?|tarjetas?|steps?|hints?|rungs?|cards?";
const graded = "pistas?|tarjetas?|hints?|rungs?|cards?";
const amount = "\\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|two|three|four|five|six|seven|eight|nine|ten";
const ordinal = "primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last";
const numbered = new RegExp(`\\b(?:(?:${named})\\s+(?:no?\\s*)?(?:${amount})|(?:${amount}|${ordinal})\\s+(?:${graded})|\\d+\\s*/\\s*\\d+)\\b`);

const meta = /\bs\d+(?:p\d+)?\b|\b(?:alts?|ladders?|threads?|cards?|tarjetas?|escaleras?|the players|los jugadores|give_hint|repeat_hint|record_progress)\b/;

const english = new Set(["the", "they", "they're", "is", "are", "and", "this", "that", "which", "what", "with", "their", "doesn't", "should", "would", "hint", "players", "next", "match", "matches", "i", "in", "you", "we", "to", "of", "for", "it", "be", "have", "has", "does", "need", "about", "player", "asked", "asking", "respond", "reply", "answer", "i'm", "i'll", "let's", "just", "only", "nothing"]);

const spanish = new Set(["de", "la", "el", "los", "las", "un", "una", "y", "que", "en", "es", "por", "con", "se", "lo", "me", "te", "os", "al", "del", "para", "mi", "tu", "su", "ya", "muy", "mas", "pero", "como", "si", "esto", "eso", "esta", "este", "aqui", "hay", "vale", "bien", "vosotros", "estais", "habeis", "teneis"]);

const readsEnglish = (text: string, plain: string) => {
  const words = plain.split(/[^a-z']+/).filter(Boolean);
  const found = words.filter((word) => english.has(word)).length;
  return found >= 2 || (found >= 1 && words.length >= 3 && !/[áéíóúñ¿¡]/i.test(text) && !words.some((word) => spanish.has(word)));
};

const runLength = 5;

const wordRuns = (line: string) => {
  const words = line.split(" ").filter(Boolean);
  return words.length < runLength ? [] : words.slice(0, words.length - runLength + 1).map((_, index) => words.slice(index, index + runLength).join(" "));
};

const judging =
  /\b(?:(?:es|son|eso es|esa es|ese es|esto es|esta es|este es)\s+(?:justo\s+)?(?:lo|la|el|los|las)\s+que\s+(?:buscais|buscabais|os toca|teneis que|necesitais|hay que|(?:os|te) (?:he|habia) (?:dado|dicho))|(?:bien visto|buen trabajo|bien pillado|vais bien|vais por buen camino|buen ojo)|ya os (?:la|lo|las|los) he (?:dicho|dado|repetido)|(?:ya )?os (?:lo )?he (?:dado|dicho|contado) todo|(?:ya )?no (?:hay|tengo) (?:nada )?mas que (?:deciros|daros|contaros)|i(?:'ve| have)? (?:already )?(?:given|told) you everything|lo que importa (?:ahora )?es|eso no os (?:va a )?(?:servir|funcionar)|(?:that's|that is|it's|this is)\s+(?:exactly\s+)?(?:what|the one)\s+(?:you(?:'re| are)?\s+(?:looking for|need|after)|i (?:gave|told) you)|well spotted|good job|nice find|you're on the right track|i've already told you|what matters (?:now )?is|that won't work for you)\b/;

const hintRequest = /\b(?:dame|danos|dime|dinos|quiero|queremos|necesito|necesitamos|otra|siguiente|mas|nueva|give|another|next|more|need|want)\b.*\b(?:pista|pistas|hint|hints|ayuda|clue)\b|\b(?:pista|pistas|hint|hints|ayuda|clue)\b.*\b(?:mas facil|siguiente|otra|nueva|next|another|more|easier)\b|\b(?:ayudanos|ayudame|help us|help me)\b/;

const hintRepeat = /\b(?:repite|repitela|repetir|otra vez|de nuevo|explica|explicame|explicanos|again|repeat|explain)\b/;

const asksHint = (asked: string) => {
  const line = (asked.split("\n").at(-1)?.replace(/^[^:]*: /, "") ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return hintRequest.test(line) && !hintRepeat.test(line);
};

const progressReport = /\b(?:hemos|tenemos|encontrado|encontramos|conseguido|conseguimos|hecho|le dimos|le hemos dado|done|found|got|we have|did it)\b/;

const reportsProgress = (asked: string) => progressReport.test((asked.split("\n").at(-1)?.replace(/^[^:]*: /, "") ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());

const asksRound = /\b(?:que|cual|what|which)\s+(?:ronda|round)\b/;

const showsNumber = (text: string) => numbered.test(text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[º°#.]/g, " "));

const flat = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

type Dropped = { tag: string; text: string };

class Speech {
  readonly spoken: string[] = [];
  readonly headsUps: OfferedHeadsUp[] = [];
  private readonly prepared: string[] = [];
  private buffer = "";
  private unhanded: Set<string> | null = null;
  private muted = false;
  private own = 0;
  private lead: string | null = null;
  confirming = false;

  constructor(
    private readonly state: State,
    private readonly emit: (event: ReplyEvent) => void,
    private readonly violations: string[],
    private readonly dropped: Dropped[],
    private readonly earlier: Set<string> = new Set(),
    private readonly heard: Set<string> = new Set(),
  ) {}

  push(delta: string): void {
    this.buffer += delta;
    let cut = -1;
    for (const match of this.buffer.matchAll(sentenceEnd)) cut = match.index + match[0].length;
    if (cut < 0) return;
    this.say(this.buffer.slice(0, cut));
    this.buffer = this.buffer.slice(cut);
  }

  flush(): void {
    this.say(this.buffer);
    this.buffer = "";
  }

  handing(): void {
    if (this.lead === null) return;
    const lead = this.lead;
    this.lead = null;
    this.own += 1;
    this.add(lead);
  }

  add(text: string): void {
    this.handing();
    this.prepared.push(flat(text));
    this.spoken.push(text);
    this.emit({ type: "text", text: `${this.spoken.length > 1 ? " " : ""}${text}` });
  }

  private say(raw: string): void {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || text.replace(/[\s.…]/g, "") === "" || text.includes(silence) || /^\([^()]{0,40}\)$/.test(text)) return;
    if (text.includes("[") || text.includes("]")) {
      this.drop("brackets", text);
      return;
    }
    const repeated = flat(text);
    if (repeated.split(" ").length >= 3) {
      const contains = (line: string) => ` ${flat(line)} `.includes(` ${repeated} `);
      if (this.prepared.some((line) => ` ${line} `.includes(` ${repeated} `))) {
        this.drop("repeated", text);
        return;
      }
      if ([...this.state.givenLines.values()].flat().some(contains)) {
        this.drop("repeated", text);
        return;
      }
      if (this.earlier.has(repeated)) {
        this.drop("repeated-own", text);
        return;
      }
    }
    if (this.muted) return;
    const plain = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const caught =
      meta.test(plain) || (this.state.language === "es" && readsEnglish(text, plain))
        ? "meta"
        : judging.test(plain)
          ? "judging"
          : wordRuns(repeated).some((run) => this.unhandedRuns().has(run))
            ? "echoes-unhanded"
            : null;
    if (caught === "echoes-unhanded" && !this.headsUps.length) {
      const offered = this.offeredHeadsUp(new Set(wordRuns(repeated)));
      if (offered) {
        this.sayHeadsUp(offered);
        return;
      }
    }
    if (caught && !(caught === "judging" && this.confirming)) {
      this.drop(caught, text);
      if (caught !== "judging") this.muted = true;
      return;
    }
    if (asksRound.test(plain)) {
      this.drop("round-asked", text);
      return;
    }
    const unknown = this.state.bundle.knowledge.filter((entry) => !this.state.known.has(entry.id));
    if (namedIn(text, unknown).length) {
      this.drop("named-unknown", text);
      return;
    }
    if (showsNumber(text)) {
      this.drop("number-shown", text);
      return;
    }
    if (namedIn(text, this.state.bundle.knowledge).some((id) => this.ahead().has(id))) {
      this.drop("points-ahead", text);
      return;
    }
    if (this.own + (this.lead === null ? 0 : 1) >= maxOwnSentences) {
      this.drop("too-long", text);
      return;
    }
    if (/:["»”')]*$/.test(text)) {
      this.lead = text;
      return;
    }
    this.handing();
    this.own += 1;
    this.add(text);
  }

  private drop(tag: string, text: string): void {
    this.violations.push(tag);
    this.dropped.push({ tag, text });
  }

  private ahead(): Set<string> {
    const ids = (ladders: Ladder[]) => new Set(ladders.flatMap((ladder) => ladder.rungs.flatMap((rung) => [rung, ...rung.alts].flatMap((line) => [...line.mentions, ...line.reveals]))));
    const reached = this.state.ladders.filter((ladder) => isOpen(this.state, ladder) || isDone(this.state, ladder));
    const seen = ids(reached);
    for (const step of this.state.bundle.steps.filter((entry) => this.state.done.has(entry.id))) for (const id of [...step.onSuccess.mentions, ...step.onSuccess.reveals]) seen.add(id);
    const later = ids(this.state.ladders.filter((ladder) => !reached.includes(ladder)));
    return new Set([...later].filter((id) => !seen.has(id) && !this.heard.has(id)));
  }

  private offeredHeadsUp(runs: Set<string>): OfferedHeadsUp | null {
    return offeredHeadsUps(this.state).find((offered) => wordRuns(flat(offered.text)).some((run) => runs.has(run))) ?? null;
  }

  sayHeadsUp(offered: OfferedHeadsUp): void {
    this.state.headsUps.add(headsUpKey(offered.stepId, offered.position));
    this.headsUps.push(offered);
    this.add(offered.text);
  }

  private unhandedRuns(): Set<string> {
    if (this.unhanded) return this.unhanded;
    const lang = this.state.language;
    const handed = new Set([...this.state.givenLines.values()].flat().map(flat));
    const lines = [
      ...this.state.ladders.filter((ladder) => !isDone(this.state, ladder)).flatMap((ladder) => ladder.rungs.flatMap((rung) => [rung.text[lang], ...rung.alts.map((alt) => alt.text[lang])])),
      ...this.state.bundle.steps.filter((step) => !this.state.done.has(step.id)).flatMap((step) => [step.onSuccess.text[lang], ...step.headsUps.map((headsUp) => headsUp.text[lang]), ...(step.doneWhen ? [step.doneWhen] : [])]),
    ];
    this.unhanded = new Set(lines.map(flat).filter((line) => !handed.has(line)).flatMap(wordRuns));
    return this.unhanded;
  }
}

const addressing = new RegExp(`[?¿]|\\b(?:${wakeWords.join("|")})\\b`, "i");

const isAddressed = (line: string) => addressing.test(line);

export type Ask = { kind: "message"; spoken: boolean } | { kind: "more"; cardId: number } | { kind: "gap"; gapId: number };

async function hold(state: State, askedBy: string, asked: string, about: string, recent: string[]): Promise<string> {
  const [held] = await db.select({ n: count() }).from(gaps).where(eq(gaps.runId, state.runId));
  const lines = state.character.lines[state.language].hold;
  const said = lines[(held?.n ?? 0) % lines.length]!;
  await db.insert(gaps).values({
    runId: state.runId,
    askedBy,
    asked,
    about,
    said,
    bundleVersion: state.version,
    context: {
      model: model(),
      known: [...state.known],
      open: state.ladders.filter((ladder) => isOpen(state, ladder)).map((ladder) => ({ ladder: keyOf(ladder), given: state.given.get(keyOf(ladder)) ?? 0 })),
      done: [...state.done],
      recent,
    },
  });
  return said;
}

async function answer(gapId: number, deliveryId: number): Promise<void> {
  await db
    .update(gaps)
    .set({ answeredAt: new Date(), answerDeliveryId: deliveryId })
    .where(and(eq(gaps.id, gapId), isNull(gaps.answeredAt)));
}

async function noteTried(state: State): Promise<void> {
  if (!state.held.length) return;
  await db
    .update(gaps)
    .set({ triedVersion: state.version })
    .where(inArray(gaps.id, state.held.map((entry) => entry.id)));
}

async function finish(state: State, text: string, cards: number[], postedBy: "claude" | null = null): Promise<number | null> {
  if (!text && !cards.length) return null;
  return db.transaction(async (tx) => {
    const [message] = await tx.insert(messages).values({ runId: state.runId, author: "coach", name: state.character.name, text, postedBy }).returning({ id: messages.id });
    if (cards.length) await tx.update(hintCards).set({ messageId: message!.id }).where(inArray(hintCards.id, cards));
    return message!.id;
  });
}

type Handed = { ladder: Ladder; deliveryId: number };

async function skippedRungs(runId: string, handed: Handed[]): Promise<boolean> {
  if (!handed.length) return false;
  const ids = new Set(handed.map((entry) => entry.deliveryId));
  const rows = await db
    .select({ id: deliveries.id, stepId: deliveries.stepId, partId: deliveries.partId, rung: deliveries.rung })
    .from(deliveries)
    .where(eq(deliveries.runId, runId))
    .orderBy(deliveries.id);
  const shown = new Map<string, Set<number>>();
  let skipped = false;
  for (const row of rows) {
    const key = ladderKey(row.stepId, row.partId);
    const before = shown.get(key) ?? new Set<number>();
    if (ids.has(row.id) && [...Array(row.rung).keys()].some((rung) => !before.has(rung))) skipped = true;
    before.add(row.rung);
    shown.set(key, before);
  }
  return skipped;
}

async function audit(state: State, text: string, handed: Handed[], openBefore: Set<string>, caught: string[]): Promise<string[]> {
  const findings = caught.filter((finding) => finding !== "too-long" && finding !== "points-ahead");
  if (namedIn(text, unknownEntries(state)).length) findings.push("unknown-in-reply");
  if (await skippedRungs(state.runId, handed)) findings.push("rung-skipped");
  if (handed.some((entry) => entry.ladder.optional && !openBefore.has(keyOf(entry.ladder)))) findings.push("optional-offered");
  return [...new Set(findings)];
}

async function moreTarget(runId: string, cardId: number, state: State): Promise<{ ladder: Ladder; latest: boolean } | null> {
  const [card] = await db
    .select()
    .from(hintCards)
    .where(and(eq(hintCards.id, cardId), eq(hintCards.runId, runId)));
  if (!card) return null;
  const ladder = state.ladders.find((entry) => entry.stepId === card.stepId && entry.partId === card.partId);
  if (!ladder) return null;
  const [latest] = await db
    .select({ id: hintCards.id })
    .from(hintCards)
    .where(and(eq(hintCards.runId, runId), eq(hintCards.stepId, card.stepId), card.partId ? eq(hintCards.partId, card.partId) : isNull(hintCards.partId)))
    .orderBy(desc(hintCards.id))
    .limit(1);
  return { ladder, latest: latest?.id === cardId };
}

export async function coachTurn(
  runId: string,
  askedBy: { discordId: string; name: string },
  ask: Ask,
  emit: (event: ReplyEvent) => void,
  options: { waitMs?: number; before?: () => Promise<void>; asking?: { text: string | null; spoken: boolean } } = {},
): Promise<"ok" | "busy" | "notFound" | "notLatest"> {
  const [queued] = options.asking
    ? await db.insert(coachQueue).values({ runId, discordId: askedBy.discordId || null, name: askedBy.name, spoken: options.asking.spoken, text: options.asking.text }).returning({ id: coachQueue.id })
    : [];
  const dequeue = () => (queued ? db.delete(coachQueue).where(eq(coachQueue.id, queued.id)) : Promise.resolve());
  const lease = await acquire(runId, options.waitMs);
  if (!lease) {
    await dequeue();
    return "busy";
  }
  if (queued) await db.update(coachQueue).set({ startedAt: new Date() }).where(eq(coachQueue.id, queued.id));
  const turnDeadline = AbortSignal.timeout(turnDeadlineMs);
  try {
    await options.before?.();
    const state = await loadState(runId);
    if (!state) return "notFound";
    if (askedBy.discordId) state.reporter = askedBy;
    const retried = ask.kind === "gap" ? state.held.find((entry) => entry.id === ask.gapId) : undefined;
    if (ask.kind === "gap" && !retried) return "notFound";
    let target: { cardId: number; ladder: Ladder } | null = null;
    if (ask.kind === "more") {
      const found = await moreTarget(runId, ask.cardId, state);
      if (!found) return "notFound";
      if (!found.latest || isDone(state, found.ladder) || !hasMore(found.ladder, state.given.get(ladderKey(found.ladder.stepId, found.ladder.partId)) ?? 0)) return "notLatest";
      const direct = await deliver(state, found.ladder, null, ask.cardId, askedBy.discordId || null);
      if (direct.ok) return "ok";
      target = { cardId: ask.cardId, ladder: found.ladder };
    }
    const api = anthropic();
    if (!api) return "ok";
    const conversation = await history(runId);
    const playersSaid = conversation
      .flatMap((turn) => (turn.role === "user" && typeof turn.content === "string" ? turn.content.split("\n") : []))
      .map((line) => line.replace(/^[^:]*: /, ""))
      .join("\n");
    const heard = new Set(namedIn(playersSaid, state.bundle.knowledge));
    if (target)
      conversation.push({
        role: "user",
        content: `${askedBy.name} pressed More on the card of ladder ${target.ladder.handle}; its next hint cannot be given as it stands.`,
      });
    if (retried)
      conversation.push({
        role: "user",
        content: `(Not a player: new hints were written since you held on question ${retried.number} under Held earlier. If one of the hints you may give now answers it, give it with give_hint and gap: ${retried.number}, with at most a few words that you have it now. Otherwise reply with exactly ${silence})`,
      });
    const lastTurn = conversation[conversation.length - 1];
    if (lastTurn?.role !== "user") return "ok";
    const asked = typeof lastTurn.content === "string" ? lastTurn.content : "";
    const addressed = ask.kind === "message" && (ask.spoken || isAddressed(asked.split("\n").at(-1)?.replace(/^[^:]*: /, "") ?? ""));
    if (ask.kind === "message" && asksHint(asked) && !reportsProgress(asked)) {
      const opened = state.recent
        .map((key) => state.ladders.find((ladder) => keyOf(ladder) === key))
        .filter((ladder): ladder is Ladder => !!ladder && !isDone(state, ladder) && isReady(stepOf(state, ladder), state.done) && !!ladder.rungs[state.given.get(keyOf(ladder)) ?? 0]);
      const latest = state.ladders.find((ladder) => keyOf(ladder) === state.latest);
      for (const aimed of latest && !isDone(state, latest) ? [latest] : [...opened, ...firstHints(state)]) {
        const given = await deliver(state, aimed, null, null, askedBy.discordId || null);
        if (!given.ok) continue;
        emit({ type: "hint", text: given.text });
        await finish(state, "", [given.cardId]);
        return "ok";
      }
    }
    const recent = conversation.flatMap((turn) => (typeof turn.content === "string" ? turn.content.split("\n") : [])).slice(-recentLines);
    const violations: string[] = [];
    const dropped: Dropped[] = [];
    const caught: string[] = [];
    const handed: Handed[] = [];
    const openBefore = new Set(state.ladders.filter((ladder) => isOpen(state, ladder)).map(keyOf));
    const earlier = new Set(
      [...conversation.flatMap((turn) => (turn.role === "assistant" && typeof turn.content === "string" ? turn.content.split(sentenceEnd) : [])), ...state.character.examples.flatMap((line) => line.split(sentenceEnd))]
        .map(flat)
        .filter((sentence) => sentence.split(" ").length >= 3),
    );
    const chatLines = conversation.flatMap((turn) => (typeof turn.content === "string" ? turn.content.split("\n").map((line) => (turn.role === "assistant" ? `${state.character.name}: ${line}` : line)) : []));
    let pending = ask.kind === "message" ? detectProgress(api, state, chatLines.slice(-recentLines), turnDeadline) : null;
    let held: ReplyEvent[] | null = pending ? [] : null;
    const out = (event: ReplyEvent) => (held ? held.push(event) : emit(event));
    void pending?.then((found) => {
      if (found.ladders.length || found.headsUp || !held) return;
      const queued = held;
      held = null;
      for (const event of queued) emit(event);
    });
    let speech = new Speech(state, out, violations, dropped, earlier, heard);
    const cards: number[] = [];
    let hinted = false;
    let repeated = false;
    let headsUpSaid = false;
    let round = false;
    let failed = false;
    let onward = null as { next: string | null; quiet: boolean; result: number } | null;
    const askedBefore = state.roundAskedAt;
    const record = async (detected: Ladder[], answer: OfferedHeadsUp | null) => {
      const notes: string[] = [];
      let unsaid = false;
      if (answer) {
        speech.sayHeadsUp(answer);
        headsUpSaid = true;
      }
      if (!detected.length) {
        const playerTurn = conversation[conversation.length - 1]!;
        playerTurn.content = `${playerTurn.content as string}\n(Not a player: code said for you the prepared answer to their question. Add nothing, reply with exactly ${silence})`;
        return;
      }
      for (const ladder of detected) {
        if (isDone(state, ladder)) continue;
        await markSteps(state, ladder, "done");
        const onSuccess = stepOf(state, ladder).onSuccess;
        await learn(state, { ...onSuccess, mentions: onSuccess.mentions.filter((id) => heard.has(id)), reveals: [] });
        if (speakable(onSuccess, state.known)) {
          await learn(state, onSuccess);
          speech.add(onSuccess.text[state.language]);
        } else unsaid = true;
      }
      const chosen = firstHints(state)[0];
      if (chosen) {
        const result = await deliver(state, chosen, null, null, askedBy.discordId || null);
        if (result.ok) {
          hinted = true;
          speech.handing();
          emit({ type: "hint", text: result.text });
          handed.push({ ladder: chosen, deliveryId: result.deliveryId });
          cards.push(result.cardId);
          notes.push(`handed over the first hint of ${chosen.handle} on a card`);
        }
      }
      if (unsaid) speech.confirming = true;
      const said = speech.spoken.length ? "said its prepared line for you" : "";
      const playerTurn = conversation[conversation.length - 1]!;
      playerTurn.content = `${playerTurn.content as string}\n(Not a player: code recorded as finished from their line: ${detected.map((ladder) => ladder.handle).join(", ")}, with what each requires${said ? `, ${said}` : ""}${notes.length ? `, and ${notes.join(", ")}` : ""}. Never record these again or give another hint now. ${unsaid ? "Confirm to them in a few words of your own that it worked, naming nothing new." : "Add at most a few words, or reply with exactly " + silence + "."} If their line also asked something else, answer that briefly.)`;
    };
    const settle = async (): Promise<boolean> => {
      if (!pending) return false;
      const found = await pending;
      pending = null;
      for (const log of found.logs) if (log.latencyMs) await logCall(runId, log);
      if (found.ladders.length || found.headsUp) {
        held = null;
        violations.splice(0);
        dropped.splice(0);
        speech = new Speech(state, out, violations, dropped, earlier, heard);
        await record(found.ladders, found.headsUp);
        return true;
      }
      const queued = held ?? [];
      held = null;
      for (const event of queued) emit(event);
      return false;
    };
    for (let step = 0; step < maxSteps; step++) {
      const started = Date.now();
      const log: CallLog = { stopReason: null, refused: false, refusalCategory: null, violations: [], error: null, latencyMs: 0, usage: null };
      let response: Anthropic.Message;
      try {
        const stream = api.messages.stream({
          model: model(),
          max_tokens: maxTokens,
          system: [
            { type: "text", text: systemPrompt(state.character), cache_control: { type: "ephemeral" } },
            { type: "text", text: offers(state) },
          ],
          tools: retried ? tools.filter((tool) => tool.name === "give_hint") : tools,
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
          cache_control: { type: "ephemeral" },
          messages: conversation,
        }, { signal: AbortSignal.any([turnDeadline, AbortSignal.timeout(callDeadlineMs)]) });
        for await (const event of stream) if (event.type === "content_block_delta" && event.delta.type === "text_delta") speech.push(event.delta.text);
        response = await stream.finalMessage();
        speech.flush();
      } catch (error) {
        log.error = error instanceof Error ? error.message : String(error);
        log.latencyMs = Date.now() - started;
        if (await settle()) {
          await logCall(runId, log);
          continue;
        }
        log.violations = violations.splice(0);
        log.dropped = dropped.splice(0);
        caught.push(...log.violations);
        await logCall(runId, log);
        failed = true;
        break;
      }
      log.latencyMs = Date.now() - started;
      log.usage = response.usage;
      log.stopReason = response.stop_reason;
      if (await settle()) {
        await logCall(runId, log);
        continue;
      }
      if (response.stop_reason === "refusal") {
        log.refused = true;
        log.violations = violations.splice(0);
        log.dropped = dropped.splice(0);
        caught.push(...log.violations);
        log.refusalCategory = response.stop_details?.category ?? null;
        await logCall(runId, log);
        break;
      }
      conversation.push({ role: "assistant", content: response.content });
      if (response.stop_reason !== "tool_use") {
        log.violations = violations.splice(0);
        log.dropped = dropped.splice(0);
        caught.push(...log.violations);
        await logCall(runId, log);
        break;
      }
      const results: Anthropic.ToolResultBlockParam[] = [];
      let complete = true;
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        let ended = false;
        const input = (block.input ?? {}) as { ladder?: unknown; alt?: unknown; answer?: unknown; gap?: unknown; said?: unknown; status?: unknown; next?: unknown; quiet?: unknown; number?: unknown; about?: unknown };
        let content: string;
        if (block.name === "give_hint") {
          const ladder = state.ladders.find((entry) => entry.handle === input.ladder);
          const step = ladder && stepOf(state, ladder);
          if (hinted) {
            violations.push("second-hint");
            content = "Only one hint per reply. Say nothing more about hints.";
          } else if (!ladder || !step || !isShown(state, ladder) || (ladder.optional && !isOpen(state, ladder) && isReady(step, state.done))) {
            violations.push("unknown-ladder");
            content = "There is no such ladder you may use.";
          } else if (isDone(state, ladder)) {
            violations.push("done-ladder");
            content = "That is already done. Never hint it again.";
          } else {
            const blocker = isReady(step, state.done) ? null : blockerOf(state.bundle.steps, step.id, state.done);
            const aimed = isReady(step, state.done) ? ladder : blocker ? state.ladders.find((entry) => entry.stepId === blocker.id && entry.partId === null) : undefined;
            if (!aimed) {
              content = "There is nothing you may give about that now. Ask what they see.";
            } else {
              const alt = !blocker && typeof input.alt === "number" && Number.isInteger(input.alt) ? input.alt - 1 : null;
              const sameLadder = target && target.ladder.handle === aimed.handle ? target.cardId : null;
              const result = await deliver(state, aimed, alt, sameLadder, askedBy.discordId || null);
              if (result.ok) {
                hinted = true;
                speech.handing();
                emit({ type: "hint", text: result.text });
                handed.push({ ladder: aimed, deliveryId: result.deliveryId });
                if (sameLadder === null) cards.push(result.cardId);
                const answered = state.held.find((entry) => entry.number === input.gap);
                if (answered) await answer(answered.id, result.deliveryId);
                ended = true;
                content = "Handed over on the card. Add at most a few words of your own, and never repeat, explain or extend the hint.";
              } else {
                if (result.violation) violations.push(result.violation);
                content = result.reason;
              }
            }
          }
        } else if (block.name === "repeat_hint") {
          const ladder = state.ladders.find((entry) => entry.handle === input.ladder);
          const last = ladder ? state.givenLines.get(keyOf(ladder))?.at(-1) : undefined;
          if (!last) content = "Nothing has been handed over on that ladder yet.";
          else if (repeated) content = "Already said again in this reply.";
          else {
            repeated = true;
            speech.add(last);
            ended = true;
            content = "Said again for you, word for word. Add nothing.";
          }
        } else if (block.name === "record_progress") {
          const ladder = state.ladders.find((entry) => entry.handle === input.ladder);
          const status = input.status === "done" ? "done" : input.status === "started" ? "started" : null;
          if (!ladder || !status || !isShown(state, ladder)) {
            violations.push("unknown-ladder");
            content = "There is no such ladder you may record.";
          } else if (isDone(state, ladder)) {
            content = "That is already recorded as done.";
          } else if (status === "started") {
            await markSteps(state, ladder, "started");
            content = `Noted. What you may use now:\n\n${offers(state)}`;
          } else if (ladder.partId !== null) {
            await markSteps(state, ladder, "done");
            content = `Noted. Follow the part still missing, from its first hint. What you may use now:\n\n${offers(state)}`;
          } else {
            await markSteps(state, ladder, "done");
            const said: string[] = [];
            const onSuccess = stepOf(state, ladder).onSuccess;
            await learn(state, { ...onSuccess, mentions: onSuccess.mentions.filter((id) => heard.has(id)), reveals: [] });
            if (speakable(onSuccess, state.known)) {
              await learn(state, onSuccess);
              speech.add(onSuccess.text[state.language]);
              said.push(`Said for you: ${quote(onSuccess.text[state.language])}.`);
            }
            onward = { next: typeof input.next === "string" ? input.next : onward?.next ?? null, quiet: input.quiet === true || (onward?.quiet ?? false), result: results.length };
            if (said.length) {
              ended = true;
              content = said.join(" ");
            } else {
              speech.confirming = true;
              content = "Recorded. Confirm to them in a few words of your own that it worked, naming nothing new and saying nothing about what comes next.";
            }
          }
        } else if (block.name === "heads_up") {
          const ladder = state.ladders.find((entry) => entry.handle === input.ladder && entry.partId === null);
          const position = typeof input.number === "number" && Number.isInteger(input.number) ? input.number - 1 : -1;
          const headsUp = ladder ? stepOf(state, ladder).headsUps[position] : undefined;
          if (!ladder || !headsUp || !stepOpen(state, ladder.stepId) || !headsUp.mentions.every((id) => state.known.has(id)) || namedIn(headsUp.when, unknownEntries(state)).length) {
            violations.push("unknown-heads-up");
            content = "There is no such heads-up you may give.";
          } else if (headsUpSaid || speech.headsUps.length) {
            content = "One heads-up per reply.";
          } else {
            const text = headsUp.text[state.language];
            const inserted = await db
              .insert(headsUpsGiven)
              .values({ runId, stepId: ladder.stepId, position, text, bundleVersion: state.version })
              .onConflictDoNothing()
              .returning({ position: headsUpsGiven.position });
            state.headsUps.add(headsUpKey(ladder.stepId, position));
            if (!inserted.length) content = "That heads-up was already given.";
            else {
              headsUpSaid = true;
              ended = true;
              speech.add(text);
              content = "Said for you. Do not repeat it.";
            }
          }
        } else if (block.name === "mark_known") {
          const said = typeof input.said === "string" ? input.said : "";
          const named = namedIn(said, state.bundle.knowledge).filter((id) => !state.known.has(id));
          const fresh = named.filter((id) => heard.has(id));
          if (fresh.length < named.length) violations.push("mark-unheard");
          if (fresh.length) {
            await db
              .insert(runKnowledge)
              .values(fresh.map((knowledgeId) => ({ runId, knowledgeId })))
              .onConflictDoNothing();
            for (const id of fresh) state.known.add(id);
            content = `Noted. If they reported finishing or starting something listed, call record_progress now. What you may use now:\n\n${offers(state)}`;
          } else content = "Nothing new to note.";
        } else if (block.name === "hold") {
          if (retried) content = `Nothing to hold now. Reply with exactly ${silence}`;
          else if (hinted) content = "You already handed something over in this reply. Add nothing.";
          else {
            hinted = true;
            ended = true;
            speech.add(await hold(state, askedBy.discordId, asked, typeof input.about === "string" ? input.about : "", recent));
            content = "Said for you in your voice, and recorded so the missing hint gets written. Your reply is complete: add nothing of your own.";
          }
        } else if (block.name === "ask_round") {
          const recent = state.roundAskedAt && Date.now() - state.roundAskedAt.getTime() < roundGapMs;
          if (recent || round || hinted) content = "Not now; do not ask about the round in this reply.";
          else {
            round = true;
            state.roundAskedAt = new Date();
            await db.update(runs).set({ roundAskedAt: state.roundAskedAt }).where(eq(runs.id, runId));
            ended = true;
            content = `Asked for you at the end of your reply: "${state.character.lines[state.language].round}". Do not ask it again.`;
          }
        } else content = `No tool named ${block.name}.`;
        if (!ended) complete = false;
        results.push({ type: "tool_result", tool_use_id: block.id, content });
      }
      if (onward) {
        const ready = firstHints(state);
        const chosen = ready.find((entry) => entry.handle === onward!.next) ?? ready[0];
        let note = hinted ? "No other hint in this reply." : "Nothing else handed over.";
        if (!onward.quiet && !hinted && chosen) {
          const result = await deliver(state, chosen, null, null, askedBy.discordId || null);
          if (result.ok) {
            hinted = true;
            speech.handing();
            emit({ type: "hint", text: result.text });
            handed.push({ ladder: chosen, deliveryId: result.deliveryId });
            cards.push(result.cardId);
            note = `Handed over the first hint of ${chosen.handle} on a card.`;
          }
        }
        const recorded = results[onward.result]!;
        recorded.content = `${recorded.content as string} ${note}${complete ? " Your reply is complete: add nothing of your own." : ""}`;
        onward = null;
      }
      log.violations = violations.splice(0);
      log.dropped = dropped.splice(0);
      caught.push(...log.violations);
      await logCall(runId, log);
      if (complete) break;
      conversation.push({ role: "user", content: results });
    }
    for (const said of speech.headsUps) await db.insert(headsUpsGiven).values({ runId, stepId: said.stepId, position: said.position, text: said.text, bundleVersion: state.version }).onConflictDoNothing();
    if (round && hinted) await db.update(runs).set({ roundAskedAt: askedBefore }).where(eq(runs.id, runId));
    else if (round) speech.add(state.character.lines[state.language].round);
    if (!failed && addressed && !speech.spoken.length && !cards.length) {
      caught.push("silent-to-addressed");
      speech.add(anyOf(state.character.lines[state.language].unheard));
    }
    if (!failed) await noteTried(state);
    const text = speech.spoken.join(" ");
    const findings = await audit(state, text, handed, openBefore, caught);
    const messageId = retried && !cards.length ? null : await finish(state, text, cards);
    if (findings.length) await db.insert(audits).values({ runId, messageId, findings });
    if (retried && !cards.length) return "ok";
    if (failed && !speech.spoken.length && !cards.length) emit({ type: "failed" });
    return "ok";
  } finally {
    await dequeue();
    await release(runId, lease);
  }
}

export async function retryHeld(game: string, map: string): Promise<{ waiting: number; answered: number }> {
  const result = await db.execute<{ runId: string; gapId: number; askedBy: string | null }>(sql`
    select g.run_id as "runId", g.id as "gapId", g.asked_by as "askedBy"
    from ${gaps} g
    join ${runs} r on r.id = g.run_id
    join ${maps} m on m.game = r.game and m.map = r.map
    where r.game = ${game} and r.map = ${map}
      and r.closed_at is null
      and g.answered_at is null
      and coalesce(g.tried_version, g.bundle_version) < m.latest_version
      and g.id = (select max(x.id) from ${gaps} x where x.run_id = g.run_id)
      and not exists (select 1 from ${messages} n where n.run_id = g.run_id and n.author = 'member' and n.kind = 'chat' and n.created_at > g.created_at)`);
  const outcomes = await Promise.all(
    result.rows.map(async (row) => {
      const [member] = row.askedBy
        ? await db
            .select({ name: runMembers.name })
            .from(runMembers)
            .where(and(eq(runMembers.runId, row.runId), eq(runMembers.discordId, row.askedBy)))
            .orderBy(desc(runMembers.id))
            .limit(1)
        : [];
      const [before] = await db.select({ last: max(deliveries.id) }).from(deliveries).where(eq(deliveries.runId, row.runId));
      let said = "";
      await coachTurn(row.runId, { discordId: row.askedBy ?? "", name: member?.name ?? "" }, { kind: "gap", gapId: row.gapId }, (event) => {
        if (event.type === "text") said += event.text;
      }).catch((error) => console.error("gap retry failed", error));
      const hints = await db
        .select({ text: deliveries.text })
        .from(deliveries)
        .where(and(eq(deliveries.runId, row.runId), row.askedBy ? eq(deliveries.askedBy, row.askedBy) : isNull(deliveries.askedBy), gt(deliveries.id, before?.last ?? 0)))
        .orderBy(asc(deliveries.id));
      if (hints.length) speakInCall(row.runId, [said.trim(), ...hints.map((hint) => hint.text)].filter(Boolean).join(" "));
      const [after] = await db.select({ answeredAt: gaps.answeredAt }).from(gaps).where(eq(gaps.id, row.gapId));
      return Boolean(after?.answeredAt);
    }),
  );
  return { waiting: outcomes.length, answered: outcomes.filter(Boolean).length };
}

export type StepInResult = { ok: true; message: number | null; card: number | null; recorded: number } | { ok: false; error: string };

const refusals: Record<string, string> = { "no-such-alt": "noSuchAlt", "unknown-mention": "unknownMention" };

export async function stepIn(runId: string, input: StepIn): Promise<StepInResult> {
  const lease = await acquire(runId);
  if (!lease) return { ok: false, error: "busy" };
  try {
    const state = await loadState(runId);
    if (!state) {
      const [run] = await db.select({ closedAt: runs.closedAt }).from(runs).where(eq(runs.id, runId));
      return { ok: false, error: run?.closedAt ? "closed" : "noSuchRun" };
    }
    const text = input.text.replace(/\s+/g, " ").trim();
    const progress = input.progress.map((entry) => ({ ladder: state.ladders.find((ladder) => ladder.stepId === entry.step && ladder.partId === entry.part), status: entry.status }));
    if (progress.some((entry) => !entry.ladder)) return { ok: false, error: "noSuchLadder" };
    for (const entry of progress) {
      if (entry.status !== "done") continue;
      const keys = entry.ladder!.partId === null ? withRequires(state.bundle.steps, entry.ladder!.stepId).map((stepId) => ladderKey(stepId, null)) : [keyOf(entry.ladder!)];
      for (const key of keys) state.done.add(key);
    }
    let aimed: { ladder: Ladder; alt: number | null; text: string } | null = null;
    const known = new Set(state.known);
    if (input.hint) {
      const hint = input.hint;
      const ladder = state.ladders.find((entry) => entry.stepId === hint.step && entry.partId === hint.part);
      if (!ladder) return { ok: false, error: "noSuchLadder" };
      if (isDone(state, ladder)) return { ok: false, error: "ladderDone" };
      if (!isReady(stepOf(state, ladder), state.done)) return { ok: false, error: "notReady" };
      if (ladder.optional && !isOpen(state, ladder)) return { ok: false, error: "optional" };
      const rung = ladder.rungs[state.given.get(keyOf(ladder)) ?? 0];
      if (!rung) return { ok: false, error: "nothingMore" };
      const line = lineAt(rung, hint.alt);
      if (!line) return { ok: false, error: "noSuchAlt" };
      if (!speakable(line, state.known)) return { ok: false, error: "unknownMention" };
      for (const id of [...line.mentions, ...line.reveals]) known.add(id);
      aimed = { ladder, alt: hint.alt, text: line.text[state.language] };
    }
    if (!text && !aimed && !progress.length) return { ok: false, error: "empty" };
    if (text.includes("[") || text.includes("]")) return { ok: false, error: "brackets" };
    if (namedIn(text, state.bundle.knowledge.filter((entry) => !known.has(entry.id))).length) return { ok: false, error: "namesUnknown" };
    if (showsNumber(text)) return { ok: false, error: "numberShown" };
    const gap = input.gap === null ? undefined : await openGap(runId, input.gap);
    if (input.gap !== null && !aimed) return { ok: false, error: "gapWithoutHint" };
    if (input.gap !== null && !gap) return { ok: false, error: "noSuchGap" };
    for (const entry of progress) await markSteps(state, entry.ladder!, entry.status);
    let card: number | null = null;
    if (aimed) {
      const result = await deliver(state, aimed.ladder, aimed.alt, null, null);
      if (!result.ok) return { ok: false, error: (result.violation && refusals[result.violation]) ?? "nothingMore" };
      card = result.cardId;
      if (gap) await answer(gap.id, result.deliveryId);
    }
    const message = await finish(state, text, card === null ? [] : [card], "claude");
    if (message !== null) speakInCall(runId, [text, aimed?.text ?? ""].filter(Boolean).join(" "));
    return { ok: true, message, card, recorded: progress.length };
  } finally {
    await release(runId, lease);
  }
}

async function openGap(runId: string, gapId: number): Promise<{ id: number } | undefined> {
  const [row] = await db
    .select({ id: gaps.id })
    .from(gaps)
    .where(and(eq(gaps.id, gapId), eq(gaps.runId, runId), isNull(gaps.answeredAt)));
  return row;
}
