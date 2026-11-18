import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Viewer } from "../../shared/bundle.js";
import { asRevision, type CallLine, type CallState, type JoinRefusal, type VoiceEvent } from "../../shared/runs.js";
import { anyOf, characterOf, type Voice } from "../../shared/voices.js";
import { bot, inBackground } from "./bot.js";
import { db } from "./db.js";
import { postMessage, postRevision } from "./runs.js";
import { bundleVersions, callLines, maps, messages, runMembers, runs } from "./schema.js";

const botTimeoutMs = 5000;
const voiceLeaseWaitMs = 12 * 1000;

async function speakerOf(discordId: string): Promise<{ runId: string; viewer: Viewer } | null> {
  const [row] = await db
    .select({ runId: runMembers.runId, name: runMembers.name, image: runMembers.image })
    .from(runMembers)
    .where(and(eq(runMembers.discordId, discordId), isNull(runMembers.leftAt)));
  return row ? { runId: row.runId, viewer: { discordId, name: row.name, image: row.image } } : null;
}

export async function voiceTurn(discordId: string, text: string, word: string, send: (event: VoiceEvent) => void, guest: { name: string | null; broughtBy: string | null } = { name: null, broughtBy: null }): Promise<void> {
  const own = await speakerOf(discordId);
  const host = own || !guest.broughtBy ? null : await speakerOf(guest.broughtBy);
  const speaker = own ?? (host && guest.name ? { runId: host.runId, viewer: { discordId, name: guest.name, image: null } } : null);
  if (!speaker) return;
  const { runId, viewer } = speaker;
  const [run] = await db.select({ voice: runs.voice, language: runs.language }).from(runs).where(eq(runs.id, runId));
  if (!run || word !== characterOf(run.voice).wake) return;
  const lines = characterOf(run.voice).lines[run.language];
  send({ type: "voice", voice: run.voice });
  const revision = asRevision(text, false, true);
  if (revision === "") return send({ type: "say", text: anyOf(lines.unheard) });
  if (revision !== null) {
    const acknowledged = await postRevision(viewer, runId, revision);
    if (acknowledged) send({ type: "say", text: acknowledged });
    return;
  }
  const { coachTurn } = await import("./coach.js");
  let spoke = false;
  const ended = await coachTurn(
    runId,
    viewer,
    { kind: "message", spoken: true },
    (event) => {
      if (event.type !== "text" && event.type !== "hint") return;
      const said = event.text.trim();
      if (!said) return;
      spoke = true;
      send({ type: "say", text: said });
    },
    { waitMs: voiceLeaseWaitMs, before: async () => void (await postMessage(viewer, runId, text, true)), asking: { text, spoken: true } },
  );
  if (ended === "busy") return send({ type: "say", text: anyOf(lines.busy) });
  if (!spoke) send({ type: "say", text: anyOf(lines.unheard) });
}

export async function coachVoice(discordId: string): Promise<Voice | null> {
  const speaker = await speakerOf(discordId);
  if (!speaker) return null;
  const [run] = await db.select({ voice: runs.voice }).from(runs).where(eq(runs.id, speaker.runId));
  return run?.voice ?? null;
}

const preparedWindowMs = 24 * 60 * 60 * 1000;

export async function preparedLines(): Promise<{ voice: Voice; lines: string[] }[]> {
  const since = new Date(Date.now() - preparedWindowMs);
  const rows = await db
    .select({ voice: runs.voice, language: runs.language, bundle: bundleVersions.bundle })
    .from(runs)
    .innerJoin(maps, and(eq(maps.game, runs.game), eq(maps.map, runs.map)))
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .where(and(isNull(runs.closedAt), or(gt(runs.createdAt, since), sql`exists (select 1 from ${messages} m where m.run_id = ${runs.id} and m.created_at > ${since})`)));
  const byVoice = new Map<Voice, Set<string>>();
  for (const row of rows) {
    const lang = row.language;
    const fixed = characterOf(row.voice).lines[lang];
    const lines = byVoice.get(row.voice) ?? new Set<string>();
    for (const step of row.bundle.steps) {
      for (const rung of [step.ladder, ...step.parts.map((part) => part.ladder)].flat()) {
        lines.add(rung.text[lang]);
        for (const alt of rung.alts) lines.add(alt.text[lang]);
      }
      lines.add(step.onSuccess.text[lang]);
      for (const headsUp of step.headsUps) lines.add(headsUp.text[lang]);
    }
    for (const line of [fixed.round, ...fixed.hold, ...fixed.unheard, ...fixed.busy]) lines.add(line);
    byVoice.set(row.voice, lines);
  }
  return [...byVoice].map(([voice, lines]) => ({ voice, lines: [...lines] }));
}

export async function keepCallLine(line: CallLine): Promise<boolean> {
  const run = (await speakerOf(line.userId)) ?? (line.broughtBy ? await speakerOf(line.broughtBy) : null);
  if (!run) return false;
  await db.insert(callLines).values({ runId: run.runId, discordId: line.userId, name: line.name, text: line.text, ms: line.ms, saidAt: new Date(line.at) });
  return true;
}

const offline: CallState = { reachable: false, channel: null, coach: null };

export async function callState(discordId: string): Promise<CallState> {
  try {
    const response = await bot(`voice?userId=${encodeURIComponent(discordId)}`, botTimeoutMs);
    if (!response?.ok) return offline;
    const { channel, coach } = (await response.json()) as Omit<CallState, "reachable">;
    return { reachable: true, channel: channel ?? null, coach: coach ?? null };
  } catch (error) {
    console.error("bot voice", (error as Error).message);
    return offline;
  }
}

export async function bringCoach(discordId: string, voice: Voice): Promise<{ channelId: string } | { error: JoinRefusal }> {
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

export function dismissCoach(userIds: string[]): void {
  if (!userIds.length || !process.env.BOT_URL) return;
  const sent = (async () => {
    const response = await bot("leave", botTimeoutMs, { method: "POST", body: { userIds } });
    if (response && !response.ok && response.status !== 409) throw new Error(`bot answered ${response.status}`);
  })().catch((error) => console.error("bot leave", (error as Error).message));
  inBackground(sent);
}
