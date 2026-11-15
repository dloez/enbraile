import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Bundle, Language } from "../../shared/bundle.js";
import type { ReplyEvent } from "../../shared/runs.js";
import { db } from "./db.js";
import { hasMore, ladderKey, laddersOf, lineAt, namedIn, speakable, type Ladder } from "./ladders.js";
import { bundleVersions, coachCalls, deliveries, hintCards, maps, messages, runKnowledge, runs } from "./schema.js";

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
- On "what now?" with nothing half done mentioned, give the first hint of a ladder not opened yet.
- If no listed hint fits what they ask, say briefly in voice that they should keep at it, or ask what they see. Never make a hint up.

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
};

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
  };
}

const quote = (text: string) => `"${text.replace(/\s+/g, " ").trim()}"`;

function offers(state: State): string {
  const lang = state.language;
  const opened: string[] = [];
  const fresh: string[] = [];
  for (const ladder of state.ladders) {
    const key = ladderKey(ladder.stepId, ladder.partId);
    const count = state.given.get(key) ?? 0;
    const label = ladder.partOf ? `${ladder.handle} (a part of ${ladder.partOf})` : ladder.handle;
    const next = ladder.rungs[count];
    if (count > 0) {
      const lines = [`- ${label}. Given so far: ${(state.givenLines.get(key) ?? []).map(quote).join(" then ")}.`];
      if (!next) lines.push("  Nothing more on this ladder.");
      else {
        const answer = next.level === 4 ? " This is the full answer: only with answer: true." : "";
        if (speakable(next, state.known)) lines.push(`  Next hint: ${quote(next.text[lang])}.${answer}`);
        const unknown = state.bundle.knowledge.filter((entry) => !state.known.has(entry.id));
        next.alts.forEach((alt, index) => {
          if (speakable(alt, state.known) && !namedIn(alt.when, unknown).length)
            lines.push(`  Alt ${index + 1}, for when ${alt.when}: ${quote(alt.text[lang])}.${answer}`);
        });
      }
      opened.push(lines.join("\n"));
    } else if (!ladder.optional && next && speakable(next, state.known)) {
      fresh.push(`- ${label}: ${quote(next.text[lang])}`);
    }
  }
  const knownNames = state.bundle.knowledge.filter((entry) => state.known.has(entry.id)).map((entry) => entry.name[lang]);
  return [
    `The run's language: ${languageNames[lang]}.`,
    `What the players know: ${knownNames.length ? knownNames.join("; ") : "nothing yet"}.`,
    `Ladders already opened:\n${opened.length ? opened.join("\n") : "- none"}`,
    `Ladders not opened yet, with their first hint:\n${fresh.length ? fresh.join("\n") : "- none"}`,
  ].join("\n\n");
}

async function history(runId: string): Promise<Anthropic.MessageParam[]> {
  const rows = (
    await db
      .select({ id: messages.id, author: messages.author, name: messages.name, text: messages.text })
      .from(messages)
      .where(eq(messages.runId, runId))
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

type Delivered = { ok: true; cardId: number } | { ok: false; reason: string; violation?: string };

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
    await tx.insert(deliveries).values({
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
    });
    const learned = [...new Set([...line.mentions, ...line.reveals])];
    if (learned.length)
      await tx
        .insert(runKnowledge)
        .values(learned.map((knowledgeId) => ({ runId: state.runId, knowledgeId })))
        .onConflictDoNothing();
    for (const id of learned) state.known.add(id);
    state.given.set(key, index + 1);
    state.givenLines.set(key, [...(state.givenLines.get(key) ?? []), text]);
    return { ok: true, cardId: card };
  });
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

class Speech {
  readonly spoken: string[] = [];
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
    this.spoken.push(text);
    this.emit({ type: "text", text: `${this.spoken.length > 1 ? " " : ""}${text}` });
  }

  private say(raw: string): void {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || text.replace(/[\s.…]/g, "") === "" || text.includes(silence)) return;
    if (text.includes("[") || text.includes("]")) {
      this.violations.push("brackets");
      return;
    }
    const unknown = this.state.bundle.knowledge.filter((entry) => !this.state.known.has(entry.id));
    if (namedIn(text, unknown).length) {
      this.violations.push("named-unknown");
      return;
    }
    this.add(text);
  }
}

export type Ask = { kind: "message" } | { kind: "more"; cardId: number };

async function finish(state: State, speech: Speech, cards: number[]): Promise<void> {
  const text = speech.spoken.join(" ");
  if (!text && !cards.length) return;
  await db.transaction(async (tx) => {
    const [message] = await tx.insert(messages).values({ runId: state.runId, author: "cari", name: "Cari", text }).returning({ id: messages.id });
    if (cards.length) await tx.update(hintCards).set({ messageId: message!.id }).where(inArray(hintCards.id, cards));
  });
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
    let target: { cardId: number; ladder: Ladder } | null = null;
    if (ask.kind === "more") {
      const found = await moreTarget(runId, ask.cardId, state);
      if (!found) return "notFound";
      if (!found.latest || !hasMore(found.ladder, state.given.get(ladderKey(found.ladder.stepId, found.ladder.partId)) ?? 0)) return "notLatest";
      const direct = await deliver(state, found.ladder, null, false, ask.cardId, askedBy.discordId);
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
    if (conversation[conversation.length - 1]?.role !== "user") return "ok";
    const violations: string[] = [];
    const speech = new Speech(state, emit, violations);
    const cards: number[] = [];
    let hinted = false;
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
          tools,
          output_config: { effort: "low" },
          messages: conversation,
        });
        for await (const event of stream) if (event.type === "content_block_delta" && event.delta.type === "text_delta") speech.push(event.delta.text);
        response = await stream.finalMessage();
        speech.flush();
      } catch (error) {
        log.error = error instanceof Error ? error.message : String(error);
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
        log.refusalCategory = response.stop_details?.category ?? null;
        await logCall(runId, log);
        break;
      }
      conversation.push({ role: "assistant", content: response.content });
      if (response.stop_reason !== "tool_use") {
        log.violations = violations.splice(0);
        await logCall(runId, log);
        break;
      }
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const input = (block.input ?? {}) as { ladder?: unknown; alt?: unknown; answer?: unknown; said?: unknown };
        let content: string;
        if (block.name === "give_hint") {
          const ladder = state.ladders.find((entry) => entry.handle === input.ladder);
          const opened = ladder && (state.given.get(ladderKey(ladder.stepId, ladder.partId)) ?? 0) > 0;
          if (hinted) {
            violations.push("second-hint");
            content = "Only one hint per reply. Say nothing more about hints.";
          } else if (!ladder || (ladder.optional && !opened)) {
            violations.push("unknown-ladder");
            content = "There is no such ladder you may use.";
          } else {
            const alt = typeof input.alt === "number" && Number.isInteger(input.alt) ? input.alt - 1 : null;
            const sameLadder = target && target.ladder.handle === ladder.handle ? target.cardId : null;
            const result = await deliver(state, ladder, alt, input.answer === true, sameLadder, askedBy.discordId);
            if (result.ok) {
              hinted = true;
              if (sameLadder === null) cards.push(result.cardId);
              content = "Handed over on the card. Add at most a few words of your own, and never repeat, explain or extend the hint.";
            } else {
              if (result.violation) violations.push(result.violation);
              content = result.reason;
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
            content = `Noted. What you may use now:\n\n${offers(state)}`;
          } else content = "Nothing new to note.";
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
      await logCall(runId, log);
      conversation.push({ role: "user", content: results });
    }
    if (round && hinted) await db.update(runs).set({ roundAskedAt: askedBefore }).where(eq(runs.id, runId));
    else if (round) speech.add(roundQuestion[state.language]);
    await finish(state, speech, cards);
    if (failed && !speech.spoken.length && !cards.length) emit({ type: "failed" });
    return "ok";
  } finally {
    await release(runId, lease);
  }
}
