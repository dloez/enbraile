import Anthropic from "@anthropic-ai/sdk";
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Bundle, Language } from "../../shared/bundle.js";
import type { ReplyEvent, StepIn } from "../../shared/runs.js";
import { db } from "./db.js";
import { blockerOf, hasMore, isReady, ladderKey, laddersOf, lineAt, namedIn, speakable, withRequires, type Ladder, type Line } from "./ladders.js";
import { audits, bundleVersions, coachCalls, deliveries, gaps, headsUpsGiven, hintCards, maps, messages, runKnowledge, runMembers, runs, runSteps } from "./schema.js";

const defaultModel = "claude-haiku-5-5";
const maxTokens = 1024;
const maxSteps = 4;
const historyLength = 24;
const roundGapMs = 10 * 60 * 1000;
const leaseMs = 60 * 1000;
const leaseWaitMs = 30 * 1000;
const leasePollMs = 300;
const silence = "(silence)";

const languageNames: Record<Language, string> = { es: "Spanish", en: "English" };
const roundQuestion: Record<Language, string> = { es: "Por cierto, ¿en qué ronda vais?", en: "By the way, what round are you on?" };
const notYet: Record<Language, string> = {
  es: "Esto no se mueve… y no creo que sea por falta de ganas. Igual no es el momento.",
  en: "This isn't budging… and I don't think it's for lack of trying. Maybe it isn't the moment.",
};

const holdLines: Record<Language, string[]> = {
  es: [
    "Uf, eso no lo tengo claro ahora mismo. Dame un momento y seguid a lo vuestro.",
    "Ahí me pillas. Lo miro y os digo; mientras, ¿qué tenéis delante?",
    "No quiero liaros con eso sin estar segura. Seguid, que ahora vuelvo.",
  ],
  en: [
    "Hm, I'm not sure about that one right now. Give me a moment and keep at it.",
    "You've got me there. I'll check and get back to you; meanwhile, what are you looking at?",
    "I don't want to send you the wrong way on that. Keep going, I'll be back.",
  ],
};

const recentLines = 8;

const systemPrompt = `You are Cari, the radio voice who coaches a small group of friends through a Zombies easter egg while they play. You have beaten it before; they want to solve it themselves with as little help as possible. They are mid-round, so be short and immediate.

How you speak
- Speak only the run's language, given below. One generic teammate voice, warm and a bit wry. One or two short sentences at most.
- You never write hints. Everything that moves them toward the solution is a prepared hint you hand over with give_hint, which the players see on a card. Your own words are only a brief lead-in or acknowledgement, one question about what they last saw or tried, or nothing.
- Never name, describe or imply any place, item, enemy, mechanic or step except those listed under "What the players know" or written in a hint already given. Never paraphrase, preview, repeat or explain a hint.
- Never mention steps, numbers, levels, ladders, cards, tools, threads, or how many hints exist or remain. Never offer choices or lists of things to try.
- Lines in square brackets in your earlier turns record hints you handed over. Never write square brackets yourself.

Choosing a hint
- Know where they are before hinting. If they only say they are stuck and you cannot tell what about, ask one quick question: what was the last thing that happened, and what have they tried since.
- One hint at a time: the next hint of the ladder that matches what they are asking about, or one of its Alts when they already have what the hint would tell them or are in the situation the Alt names; prefer whichever names fewer new things.
- Follow what they bring up, never your own order. When they report one part found, switch to the ladder of the part still missing.
- The full answer only when they clearly ask for the answer, and then with answer: true.
- On "what now?": if they have mentioned something half done, ask one open question about it, naming only what they mentioned; otherwise give the first hint of a ladder listed as ready.
- If they ask about something no listed hint covers, call hold with what they asked about: code says a prepared line in your voice and records it, so the missing hint gets written. Never make a hint up, and never answer it in your own words.
- Questions listed under "Held earlier" are ones you held on before new hints were written. When one of them is still what they need and a listed hint now answers it, give that hint with gap set to its number.

Following their progress
- A report that they finished something is also the question "what now?": always call record_progress with status done on its ladder, never just congratulate them. Code then says the prepared line about what they achieved and hands over the first hint of something else they can do now, so add no hint of your own and do not repeat either. Pass next with one of the ready ladders when what they said points at it, and quiet: true only when they made clear they already know what they are doing next.
- When they report one part of something found, record_progress done on that part's ladder and follow the part still missing from its first hint.
- When they say they are starting or working on something listed that is not open yet, record_progress with status started, then follow it like any open thread.
- Never offer an optional step. If they start one themselves, record it as started and follow it. Once they are clearly putting real time into it, give its heads-up that it is not essential, once.
- Something listed as blocked cannot be done yet. If they try it, say nothing about it: finding out it does not work yet is part of their game. Only when they ask about it, call give_hint on its ladder: the first time code says in your voice that it is not the moment; each time they ask again or want more, give_hint on it again climbs toward what is missing. Never say what is missing or that they need something else.
- A condition still to come (a round, an enemy that turns up by itself, another way round) never makes something blocked; only the list says what is blocked.
- Give a listed heads-up with heads_up only at the moment its "when" describes, such as just before they would spend something that works once, never when they start on the step. Each is given once.
- When they did the right thing and it did not come off, give first the Alt that only hints it may need another go; the Alt with the detail only after they have tried at least twice more.

Keeping track
- When the players name or describe something themselves, call mark_known with their own words before choosing a hint.
- Now and then call ask_round to learn their round, but never right after a hint or just as they start on something.
- If their message is them talking among themselves and needs nothing from you, reply with exactly ${silence}`;

const tools: Anthropic.Tool[] = [
  {
    name: "give_hint",
    description: "Hand the players the next prepared hint of one ladder, or one of that hint's Alts. It appears on a card under your reply.",
    input_schema: {
      type: "object",
      properties: {
        ladder: { type: "string", description: "The ladder's handle, such as s1 or s2p1." },
        alt: { type: "integer", minimum: 1, description: "The Alt's number, to give that Alt instead of the hint itself." },
        answer: { type: "boolean", description: "True only when the players clearly asked for the full answer." },
        gap: { type: "integer", minimum: 1, description: "When this hint answers a question listed under Held earlier, that question's number." },
      },
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

function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

const model = () => process.env.COACH_MODEL || defaultModel;

type State = {
  runId: string;
  language: Language;
  roundAskedAt: Date | null;
  bundle: Bundle;
  version: number;
  ladders: Ladder[];
  known: Set<string>;
  given: Map<string, number>;
  givenLines: Map<string, string[]>;
  done: Set<string>;
  started: Set<string>;
  told: Set<string>;
  headsUps: Set<string>;
  held: Held[];
};

type Held = { id: number; number: number; asked: string };

async function loadState(runId: string): Promise<State | null> {
  const [row] = await db
    .select({ language: runs.language, roundAskedAt: runs.roundAskedAt, bundle: bundleVersions.bundle, version: bundleVersions.version })
    .from(runs)
    .innerJoin(maps, and(eq(maps.game, runs.game), eq(maps.map, runs.map)))
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .where(eq(runs.id, runId));
  if (!row) return null;
  const known = await db.select({ id: runKnowledge.knowledgeId }).from(runKnowledge).where(eq(runKnowledge.runId, runId));
  const rows = await db
    .select({ stepId: deliveries.stepId, partId: deliveries.partId, rung: deliveries.rung, text: deliveries.text })
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
    roundAskedAt: row.roundAskedAt,
    bundle: row.bundle,
    version: row.version,
    ladders: laddersOf(row.bundle.steps),
    known: new Set(known.map((entry) => entry.id)),
    given,
    givenLines,
    done: new Set(progress.filter((entry) => entry.doneAt).map((entry) => ladderKey(entry.stepId, entry.partId || null))),
    started: new Set(progress.filter((entry) => entry.startedAt).map((entry) => ladderKey(entry.stepId, entry.partId || null))),
    told: new Set(progress.filter((entry) => entry.blockedToldAt).map((entry) => entry.stepId)),
    headsUps: new Set(said.map((entry) => headsUpKey(entry.stepId, entry.position))),
    held: open.map((entry, index) => ({ id: entry.id, number: index + 1, asked: entry.asked })),
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
    const title = titleOf(state, ladder);
    const label = `${ladder.partOf ? `${ladder.handle} (a part of ${ladder.partOf})` : ladder.handle}${title ? ` "${title}"` : ""}`;
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
        const answer = next.level === 4 ? " This is the full answer: only with answer: true." : "";
        if (speakable(next, state.known)) lines.push(`  Next hint: ${quote(next.text[lang])}.${answer}`);
        next.alts.forEach((alt, index) => {
          if (speakable(alt, state.known) && !namedIn(alt.when, unknown).length) lines.push(`  Alt ${index + 1}, for when ${alt.when}: ${quote(alt.text[lang])}.${answer}`);
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
  return [
    `The run's language: ${languageNames[lang]}.`,
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
      .select({ id: messages.id, author: messages.author, name: messages.name, text: messages.text })
      .from(messages)
      .where(and(eq(messages.runId, runId), eq(messages.kind, "chat")))
      .orderBy(desc(messages.id))
      .limit(historyLength)
  ).reverse();
  const ids = rows.map((row) => row.id);
  const cardLines = ids.length
    ? await db
        .select({ messageId: hintCards.messageId, text: deliveries.text })
        .from(deliveries)
        .innerJoin(hintCards, eq(hintCards.id, deliveries.cardId))
        .where(inArray(hintCards.messageId, ids))
        .orderBy(deliveries.id)
    : [];
  const turns: Anthropic.MessageParam[] = [];
  for (const row of rows) {
    const role = row.author === "cari" ? "assistant" : "user";
    const hints = cardLines.filter((line) => line.messageId === row.id).map((line) => `[hint given: ${quote(line.text)}]`);
    const text = role === "user" ? `${row.name}: ${row.text}` : [row.text, ...hints].filter(Boolean).join("\n");
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n${text}`;
    else turns.push({ role, content: text });
  }
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}

async function acquire(runId: string): Promise<Date | null> {
  const deadline = Date.now() + leaseWaitMs;
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

type Delivered = { ok: true; cardId: number; deliveryId: number } | { ok: false; reason: string; violation?: string };

async function deliver(state: State, ladder: Ladder, alt: number | null, answer: boolean, cardId: number | null, askedBy: string | null): Promise<Delivered> {
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
    if (rung.level === 4 && !answer)
      return { ok: false, reason: "The next hint is the full answer; give it only when they clearly ask for the answer.", violation: "answer-unasked" };
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
    return { ok: true, cardId: card, deliveryId: delivered!.id };
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
  const set = status === "done" ? { doneAt: now } : { startedAt: now };
  await db
    .insert(runSteps)
    .values(keys.map((key) => ({ runId: state.runId, ...key, ...set })))
    .onConflictDoUpdate({ target: [runSteps.runId, runSteps.stepId, runSteps.partId], set: status === "done" ? { doneAt: sql`coalesce(${runSteps.doneAt}, excluded.done_at)` } : { startedAt: sql`coalesce(${runSteps.startedAt}, excluded.started_at)` } });
  for (const key of keys) (status === "done" ? state.done : state.started).add(ladderKey(key.stepId, key.partId || null));
}

async function tellBlocked(state: State, stepId: string): Promise<void> {
  await db
    .insert(runSteps)
    .values({ runId: state.runId, stepId, blockedToldAt: new Date() })
    .onConflictDoUpdate({ target: [runSteps.runId, runSteps.stepId, runSteps.partId], set: { blockedToldAt: sql`coalesce(${runSteps.blockedToldAt}, excluded.blocked_told_at)` } });
  state.told.add(stepId);
}

type CallLog = {
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
    error: log.error,
  });
}

const sentenceEnd = /[.!?…:;]["»”')]*\s+|\n+/g;

const named = "pasos?|pistas?|tarjetas?|steps?|hints?|rungs?|cards?";
const graded = "pistas?|tarjetas?|hints?|rungs?|cards?";
const amount = "\\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|two|three|four|five|six|seven|eight|nine|ten";
const ordinal = "primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last";
const numbered = new RegExp(`\\b(?:(?:${named})\\s+(?:no?\\s*)?(?:${amount})|(?:${amount}|${ordinal})\\s+(?:${graded})|\\d+\\s*/\\s*\\d+)\\b`);

const showsNumber = (text: string) => numbered.test(text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[º°#.]/g, " "));

const flat = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

class Speech {
  readonly spoken: string[] = [];
  private readonly prepared: string[] = [];
  private buffer = "";

  constructor(
    private readonly state: State,
    private readonly emit: (event: ReplyEvent) => void,
    private readonly violations: string[],
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

  add(text: string): void {
    this.prepared.push(flat(text));
    this.spoken.push(text);
    this.emit({ type: "text", text: `${this.spoken.length > 1 ? " " : ""}${text}` });
  }

  private say(raw: string): void {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || text.replace(/[\s.…]/g, "") === "" || text.includes(silence) || /^\([^()]{0,40}\)$/.test(text)) return;
    if (text.includes("[") || text.includes("]")) {
      this.violations.push("brackets");
      return;
    }
    const repeated = flat(text);
    if (repeated.split(" ").length >= 3 && [...this.prepared, ...[...this.state.givenLines.values()].flat().map(flat)].some((line) => ` ${line} `.includes(` ${repeated} `))) {
      this.violations.push("repeated");
      return;
    }
    const unknown = this.state.bundle.knowledge.filter((entry) => !this.state.known.has(entry.id));
    if (namedIn(text, unknown).length) {
      this.violations.push("named-unknown");
      return;
    }
    if (showsNumber(text)) {
      this.violations.push("number-shown");
      return;
    }
    this.add(text);
  }
}

export type Ask = { kind: "message" } | { kind: "more"; cardId: number } | { kind: "gap"; gapId: number };

async function hold(state: State, askedBy: string, asked: string, about: string, recent: string[]): Promise<string> {
  const [held] = await db.select({ n: count() }).from(gaps).where(eq(gaps.runId, state.runId));
  const lines = holdLines[state.language];
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
    const [message] = await tx.insert(messages).values({ runId: state.runId, author: "cari", name: "Cari", text, postedBy }).returning({ id: messages.id });
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
  const findings = [...caught];
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
): Promise<"ok" | "notFound" | "notLatest"> {
  const lease = await acquire(runId);
  if (!lease) return "ok";
  try {
    const state = await loadState(runId);
    if (!state) return "notFound";
    const retried = ask.kind === "gap" ? state.held.find((entry) => entry.id === ask.gapId) : undefined;
    if (ask.kind === "gap" && !retried) return "notFound";
    let target: { cardId: number; ladder: Ladder } | null = null;
    if (ask.kind === "more") {
      const found = await moreTarget(runId, ask.cardId, state);
      if (!found) return "notFound";
      if (!found.latest || isDone(state, found.ladder) || !hasMore(found.ladder, state.given.get(ladderKey(found.ladder.stepId, found.ladder.partId)) ?? 0)) return "notLatest";
      const direct = await deliver(state, found.ladder, null, false, ask.cardId, askedBy.discordId || null);
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
    const recent = conversation.flatMap((turn) => (typeof turn.content === "string" ? turn.content.split("\n") : [])).slice(-recentLines);
    const violations: string[] = [];
    const caught: string[] = [];
    const handed: Handed[] = [];
    const openBefore = new Set(state.ladders.filter((ladder) => isOpen(state, ladder)).map(keyOf));
    const speech = new Speech(state, emit, violations);
    const cards: number[] = [];
    let hinted = false;
    let headsUpSaid = false;
    let round = false;
    let failed = false;
    const askedBefore = state.roundAskedAt;
    for (let step = 0; step < maxSteps; step++) {
      const started = Date.now();
      const log: CallLog = { stopReason: null, refused: false, refusalCategory: null, violations: [], error: null, latencyMs: 0, usage: null };
      let response: Anthropic.Message;
      try {
        const stream = api.messages.stream({
          model: model(),
          max_tokens: maxTokens,
          system: [
            { type: "text", text: systemPrompt },
            { type: "text", text: offers(state) },
          ],
          tools: retried ? tools.filter((tool) => tool.name === "give_hint") : tools,
          output_config: { effort: "low" },
          messages: conversation,
        });
        for await (const event of stream) if (event.type === "content_block_delta" && event.delta.type === "text_delta") speech.push(event.delta.text);
        response = await stream.finalMessage();
        speech.flush();
      } catch (error) {
        log.error = error instanceof Error ? error.message : String(error);
        log.violations = violations.splice(0);
        caught.push(...log.violations);
        log.latencyMs = Date.now() - started;
        await logCall(runId, log);
        failed = true;
        break;
      }
      log.latencyMs = Date.now() - started;
      log.usage = response.usage;
      log.stopReason = response.stop_reason;
      if (response.stop_reason === "refusal") {
        log.refused = true;
        log.violations = violations.splice(0);
        caught.push(...log.violations);
        log.refusalCategory = response.stop_details?.category ?? null;
        await logCall(runId, log);
        break;
      }
      conversation.push({ role: "assistant", content: response.content });
      if (response.stop_reason !== "tool_use") {
        log.violations = violations.splice(0);
        caught.push(...log.violations);
        await logCall(runId, log);
        break;
      }
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
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
          } else if (!isReady(step, state.done) && !state.told.has(step.id)) {
            await tellBlocked(state, step.id);
            speech.add(notYet[state.language]);
            hinted = true;
            content = "Said for you, in your voice, that it is not the moment. Add nothing about it. If they ask about it again or want more, call give_hint on the same ladder.";
          } else {
            const blocker = isReady(step, state.done) ? null : blockerOf(state.bundle.steps, step.id, state.done);
            const aimed = isReady(step, state.done) ? ladder : blocker ? state.ladders.find((entry) => entry.stepId === blocker.id && entry.partId === null) : undefined;
            if (!aimed) {
              content = "There is nothing you may give about that now. Ask what they see.";
            } else {
              const alt = !blocker && typeof input.alt === "number" && Number.isInteger(input.alt) ? input.alt - 1 : null;
              const sameLadder = target && target.ladder.handle === aimed.handle ? target.cardId : null;
              const result = await deliver(state, aimed, alt, input.answer === true, sameLadder, askedBy.discordId || null);
              if (result.ok) {
                hinted = true;
                handed.push({ ladder: aimed, deliveryId: result.deliveryId });
                if (sameLadder === null) cards.push(result.cardId);
                const answered = state.held.find((entry) => entry.number === input.gap);
                if (answered) await answer(answered.id, result.deliveryId);
                content = "Handed over on the card. Add at most a few words of your own, and never repeat, explain or extend the hint.";
              } else {
                if (result.violation) violations.push(result.violation);
                content = result.reason;
              }
            }
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
            const ready = firstHints(state);
            const chosen = ready.find((entry) => entry.handle === input.next) ?? ready[0];
            if (input.quiet === true || hinted || !chosen) said.push(hinted ? "No other hint in this reply." : "Nothing else handed over.");
            else {
              const result = await deliver(state, chosen, null, false, null, askedBy.discordId || null);
              if (result.ok) {
                hinted = true;
                handed.push({ ladder: chosen, deliveryId: result.deliveryId });
                cards.push(result.cardId);
                said.push(`Handed over the first hint of ${chosen.handle} on a card.`);
              } else said.push("Nothing else handed over.");
            }
            content = `${said.join(" ")} Your reply is complete: add nothing of your own.`;
          }
        } else if (block.name === "heads_up") {
          const ladder = state.ladders.find((entry) => entry.handle === input.ladder && entry.partId === null);
          const position = typeof input.number === "number" && Number.isInteger(input.number) ? input.number - 1 : -1;
          const headsUp = ladder ? stepOf(state, ladder).headsUps[position] : undefined;
          if (!ladder || !headsUp || !stepOpen(state, ladder.stepId) || !headsUp.mentions.every((id) => state.known.has(id)) || namedIn(headsUp.when, unknownEntries(state)).length) {
            violations.push("unknown-heads-up");
            content = "There is no such heads-up you may give.";
          } else if (headsUpSaid) {
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
            content = `Asked for you at the end of your reply: "${roundQuestion[state.language]}". Do not ask it again.`;
          }
        } else content = `No tool named ${block.name}.`;
        results.push({ type: "tool_result", tool_use_id: block.id, content });
      }
      log.violations = violations.splice(0);
      caught.push(...log.violations);
      await logCall(runId, log);
      conversation.push({ role: "user", content: results });
    }
    if (round && hinted) await db.update(runs).set({ roundAskedAt: askedBefore }).where(eq(runs.id, runId));
    else if (round) speech.add(roundQuestion[state.language]);
    if (!failed) await noteTried(state);
    const text = speech.spoken.join(" ");
    const findings = await audit(state, text, handed, openBefore, caught);
    const messageId = retried && !cards.length ? null : await finish(state, text, cards);
    if (findings.length) await db.insert(audits).values({ runId, messageId, findings });
    if (retried && !cards.length) return "ok";
    if (failed && !speech.spoken.length && !cards.length) emit({ type: "failed" });
    return "ok";
  } finally {
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
      await coachTurn(row.runId, { discordId: row.askedBy ?? "", name: member?.name ?? "" }, { kind: "gap", gapId: row.gapId }, () => {}).catch((error) => console.error("gap retry failed", error));
      const [after] = await db.select({ answeredAt: gaps.answeredAt }).from(gaps).where(eq(gaps.id, row.gapId));
      return Boolean(after?.answeredAt);
    }),
  );
  return { waiting: outcomes.length, answered: outcomes.filter(Boolean).length };
}

export type StepInResult = { ok: true; message: number; card: number | null } | { ok: false; error: string };

const refusals: Record<string, string> = { "answer-unasked": "answerUnasked", "no-such-alt": "noSuchAlt", "unknown-mention": "unknownMention" };

export async function stepIn(runId: string, input: StepIn): Promise<StepInResult> {
  const lease = await acquire(runId);
  if (!lease) return { ok: false, error: "busy" };
  try {
    const state = await loadState(runId);
    if (!state) return { ok: false, error: "noSuchRun" };
    const text = input.text.replace(/\s+/g, " ").trim();
    let aimed: { ladder: Ladder; alt: number | null } | null = null;
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
      if (rung.level === 4 && !hint.answer) return { ok: false, error: "answerUnasked" };
      const line = lineAt(rung, hint.alt);
      if (!line) return { ok: false, error: "noSuchAlt" };
      if (!speakable(line, state.known)) return { ok: false, error: "unknownMention" };
      for (const id of [...line.mentions, ...line.reveals]) known.add(id);
      aimed = { ladder, alt: hint.alt };
    }
    if (!text && !aimed) return { ok: false, error: "empty" };
    if (text.includes("[") || text.includes("]")) return { ok: false, error: "brackets" };
    if (namedIn(text, state.bundle.knowledge.filter((entry) => !known.has(entry.id))).length) return { ok: false, error: "namesUnknown" };
    if (showsNumber(text)) return { ok: false, error: "numberShown" };
    const gap = input.gap === null ? undefined : await openGap(runId, input.gap);
    if (input.gap !== null && !aimed) return { ok: false, error: "gapWithoutHint" };
    if (input.gap !== null && !gap) return { ok: false, error: "noSuchGap" };
    let card: number | null = null;
    if (aimed) {
      const result = await deliver(state, aimed.ladder, aimed.alt, input.hint?.answer === true, null, null);
      if (!result.ok) return { ok: false, error: (result.violation && refusals[result.violation]) ?? "nothingMore" };
      card = result.cardId;
      if (gap) await answer(gap.id, result.deliveryId);
    }
    const message = await finish(state, text, card === null ? [] : [card], "claude");
    return { ok: true, message: message!, card };
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
