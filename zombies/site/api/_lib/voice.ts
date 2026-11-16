import { and, asc, eq, gt, isNull, max } from "drizzle-orm";
import type { Viewer } from "../../shared/bundle.js";
import { asRevision, type CallLine, type CallState, type JoinRefusal } from "../../shared/runs.js";
import { characterOf, type Voice } from "../../shared/voices.js";
import { bot, inBackground } from "./bot.js";
import { db } from "./db.js";
import { postMessage, postRevision } from "./runs.js";
import { callLines, deliveries, runMembers, runs } from "./schema.js";

const botTimeoutMs = 5000;

async function speakerOf(discordId: string): Promise<{ runId: string; viewer: Viewer } | null> {
  const [row] = await db
    .select({ runId: runMembers.runId, name: runMembers.name, image: runMembers.image })
    .from(runMembers)
    .where(and(eq(runMembers.discordId, discordId), isNull(runMembers.leftAt)));
  return row ? { runId: row.runId, viewer: { discordId, name: row.name, image: row.image } } : null;
}

export type VoiceTurn = { reply: string | null; voice: Voice | null };

const silent: VoiceTurn = { reply: null, voice: null };

export async function voiceTurn(discordId: string, text: string, word: string): Promise<VoiceTurn> {
  const speaker = await speakerOf(discordId);
  if (!speaker) return silent;
  const { runId, viewer } = speaker;
  const [run] = await db.select({ voice: runs.voice, language: runs.language }).from(runs).where(eq(runs.id, runId));
  if (!run || (word !== "cari" && word !== characterOf(run.voice).wake)) return silent;
  const revision = asRevision(text, false);
  if (revision === "") return { reply: characterOf(run.voice).lines[run.language].unheard, voice: run.voice };
  if (revision !== null) return { reply: await postRevision(viewer, runId, revision), voice: run.voice };
  const [before] = await db.select({ last: max(deliveries.id) }).from(deliveries).where(eq(deliveries.runId, runId));
  await postMessage(viewer, runId, text);
  const { coachTurn } = await import("./coach.js");
  let said = "";
  await coachTurn(runId, viewer, { kind: "message", spoken: true }, (event) => {
    if (event.type === "text") said += event.text;
  });
  const hints = await db
    .select({ text: deliveries.text })
    .from(deliveries)
    .where(and(eq(deliveries.runId, runId), eq(deliveries.askedBy, discordId), gt(deliveries.id, before?.last ?? 0)))
    .orderBy(asc(deliveries.id));
  const reply = [said.trim(), ...hints.map((hint) => hint.text)].filter(Boolean).join(" ");
  return { reply: reply || characterOf(run.voice).lines[run.language].unheard, voice: run.voice };
}

export async function coachVoice(discordId: string): Promise<Voice | null> {
  const speaker = await speakerOf(discordId);
  if (!speaker) return null;
  const [run] = await db.select({ voice: runs.voice }).from(runs).where(eq(runs.id, speaker.runId));
  return run?.voice ?? null;
}

export async function keepCallLine(line: CallLine): Promise<boolean> {
  const run = (await speakerOf(line.userId)) ?? (line.broughtBy ? await speakerOf(line.broughtBy) : null);
  if (!run) return false;
  await db.insert(callLines).values({ runId: run.runId, discordId: line.userId, name: line.name, text: line.text, ms: line.ms, saidAt: new Date(line.at) });
  return true;
}

const offline: CallState = { reachable: false, channel: null, cari: null };

export async function callState(discordId: string): Promise<CallState> {
  try {
    const response = await bot(`voice?userId=${encodeURIComponent(discordId)}`, botTimeoutMs);
    if (!response?.ok) return offline;
    const { channel, cari } = (await response.json()) as Omit<CallState, "reachable">;
    return { reachable: true, channel: channel ?? null, cari: cari ?? null };
  } catch (error) {
    console.error("bot voice", (error as Error).message);
    return offline;
  }
}

export async function bringCari(discordId: string, voice: Voice): Promise<{ channelId: string } | { error: JoinRefusal }> {
  try {
    const response = await bot("join", botTimeoutMs, { method: "POST", body: { userId: discordId, voice } });
    if (!response || (!response.ok && response.status !== 409)) return { error: "botOffline" };
    return (await response.json()) as { channelId: string } | { error: JoinRefusal };
  } catch (error) {
    console.error("bot join", (error as Error).message);
    return { error: "botOffline" };
  }
}

export function speakInCall(runId: string, text: string): void {
  if (!text.trim() || !process.env.BOT_URL) return;
  const sent = (async () => {
    const [run] = await db.select({ voice: runs.voice }).from(runs).where(eq(runs.id, runId));
    const members = await db
      .select({ discordId: runMembers.discordId })
      .from(runMembers)
      .where(and(eq(runMembers.runId, runId), isNull(runMembers.leftAt)));
    if (!run || !members.length) return;
    const response = await bot("say", botTimeoutMs, { method: "POST", body: { text, voice: run.voice, userIds: members.map((member) => member.discordId) } });
    if (response && !response.ok && response.status !== 409) throw new Error(`bot answered ${response.status}`);
  })().catch((error) => console.error("bot say", runId, (error as Error).message));
  inBackground(sent);
}
