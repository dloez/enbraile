import { and, asc, eq, gt, isNull, max } from "drizzle-orm";
import type { Viewer } from "../../shared/bundle.js";
import { asRevision, type CallLine, type CallState, type JoinRefusal } from "../../shared/runs.js";
import { bot } from "./bot.js";
import { db } from "./db.js";
import { postMessage, postRevision } from "./runs.js";
import { callLines, deliveries, runMembers, runs } from "./schema.js";

const botTimeoutMs = 5000;

const notHeard = { es: "No te he entendido bien, ¿me lo repites?", en: "I didn't catch that, can you say it again?" } as const;

async function speakerOf(discordId: string): Promise<{ runId: string; viewer: Viewer } | null> {
  const [row] = await db
    .select({ runId: runMembers.runId, name: runMembers.name, image: runMembers.image })
    .from(runMembers)
    .where(and(eq(runMembers.discordId, discordId), isNull(runMembers.leftAt)));
  return row ? { runId: row.runId, viewer: { discordId, name: row.name, image: row.image } } : null;
}

export type VoiceTurn = { ok: true; reply: string | null } | { ok: false };

export async function voiceTurn(discordId: string, text: string): Promise<VoiceTurn> {
  const speaker = await speakerOf(discordId);
  if (!speaker) return { ok: true, reply: null };
  const { runId, viewer } = speaker;
  const revision = asRevision(text, false);
  if (revision === "") return { ok: true, reply: null };
  if (revision !== null) return { ok: true, reply: await postRevision(viewer, runId, revision) };
  const [before] = await db.select({ last: max(deliveries.id) }).from(deliveries).where(eq(deliveries.runId, runId));
  await postMessage(viewer, runId, text);
  const { coachTurn } = await import("./coach.js");
  let said = "";
  let failed = false;
  await coachTurn(runId, viewer, { kind: "message" }, (event) => {
    if (event.type === "text") said += event.text;
    if (event.type === "failed") failed = true;
  });
  if (failed) return { ok: false };
  const hints = await db
    .select({ text: deliveries.text })
    .from(deliveries)
    .where(and(eq(deliveries.runId, runId), eq(deliveries.askedBy, discordId), gt(deliveries.id, before?.last ?? 0)))
    .orderBy(asc(deliveries.id));
  const reply = [said.trim(), ...hints.map((hint) => hint.text)].filter(Boolean).join(" ");
  if (reply) return { ok: true, reply };
  const [run] = await db.select({ language: runs.language }).from(runs).where(eq(runs.id, runId));
  return { ok: true, reply: notHeard[run?.language === "en" ? "en" : "es"] };
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

export async function bringCari(discordId: string): Promise<{ channelId: string } | { error: JoinRefusal }> {
  try {
    const response = await bot("join", botTimeoutMs, { method: "POST", body: { userId: discordId } });
    if (!response || (!response.ok && response.status !== 409)) return { error: "botOffline" };
    return (await response.json()) as { channelId: string } | { error: JoinRefusal };
  } catch (error) {
    console.error("bot join", (error as Error).message);
    return { error: "botOffline" };
  }
}
