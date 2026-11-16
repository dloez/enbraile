import { PermissionFlagsBits } from "discord.js";
import { guild, hearing, transcripts, voice, type TranscriptLine } from "../../../home/bot/src/sdk.ts";

export type Channel = { id: string; name: string; canJoin: boolean; reason: "noAccess" | "full" | null };
export type Joined = { channelId: string; coach: Coach } | { error: "notInVoice" | "noAccess" | "full" };
export type Coach = { name: string; wake: string };

const OWNER = "zombies";
const COACHES: Record<string, Coach & { unheard: string }> = {
  cari: { name: "Cari", wake: "cari", unheard: "No te he entendido bien, ¿me lo repites?" },
  richtofen: { name: "Richtofen", wake: "richtofen", unheard: "¿Qué? ¡Hablad más claro, ratitas! Repetídmelo." },
};
const coachOf = (named: string | null) => (named === "richtofen" ? COACHES.richtofen! : COACHES.cari!);
const SITE_TIMEOUT_MS = 25_000;
const AVATAR = { size: 128, extension: "webp" } as const;

const siteUrl = (process.env.ZOMBIES_URL ?? "https://zombies.enbraile.vip").replace(/\/$/, "");
const secret = process.env.INTERNAL_SECRET ?? "";

let broughtBy: string | null = null;
let heldVoice: string | null = null;

function keepVoice(named: string | null): void {
  if (named === heldVoice) return;
  if (heldVoice !== null) hearing.release(OWNER, heldVoice);
  heldVoice = null;
  if (named === null) return;
  try {
    hearing.hold(OWNER, named);
    heldVoice = named;
  } catch (error) {
    console.error("zombies voice", named, (error as Error).message);
  }
}

function keepTranscripts(): void {
  const held = voice.holding(OWNER);
  if (!held) {
    broughtBy = null;
    keepVoice(null);
  }
  transcripts.keep(OWNER, held);
}

export async function channelOf(userId: string): Promise<Channel | null> {
  const server = await guild();
  const channelId = server.voiceStates.cache.get(userId)?.channelId;
  const channel = channelId ? server.channels.cache.get(channelId) : undefined;
  if (!channel || !channel.isVoiceBased()) return null;
  const me = server.members.me;
  const allowed = Boolean(me && channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]));
  const present = Boolean(me && channel.members.has(me.id));
  const full = !present && channel.userLimit > 0 && channel.members.size >= channel.userLimit && !(me && channel.permissionsFor(me).has(PermissionFlagsBits.MoveMembers));
  const reason = !allowed ? "noAccess" : full ? "full" : null;
  return { id: channel.id, name: channel.name, canJoin: !reason, reason };
}

export async function join(userId: string, named?: string | null): Promise<Joined> {
  const channel = await channelOf(userId);
  if (!channel) return { error: "notInVoice" };
  if (channel.reason) return { error: channel.reason };
  await voice.hold(OWNER, channel.id, { listen: true });
  broughtBy = userId;
  keepTranscripts();
  const coach = named === undefined ? await coachVoice(userId) : named;
  keepVoice(coach);
  const { name, wake } = coachOf(coach);
  return { channelId: channel.id, coach: { name, wake } };
}

export function leave(): void {
  if (voice.holding(OWNER)) voice.release(OWNER);
  keepTranscripts();
}

export async function namesOf(ids: string[]): Promise<{ names: Record<string, string>; avatars: Record<string, string> }> {
  const server = await guild();
  const found = await Promise.all(ids.map((id) => server.members.fetch({ user: id, force: true }).then((member) => ({ id, name: member.displayName, avatar: member.avatarURL(AVATAR) ?? member.user.avatarURL(AVATAR) }), () => null)));
  const members = found.filter((entry) => entry !== null);
  return {
    names: Object.fromEntries(members.map((member) => [member.id, member.name])),
    avatars: Object.fromEntries(members.flatMap((member) => (member.avatar ? [[member.id, member.avatar]] : []))),
  };
}

export const here = () => (voice.holding(OWNER) ? voice.channel() : null);

function site(path: string, body: unknown): Promise<Response> {
  return fetch(`${siteUrl}/api/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
  });
}

async function coachVoice(userId: string): Promise<string | null> {
  try {
    const response = await site("voice/coach", { userId });
    if (!response.ok) throw new Error(`site answered ${response.status}`);
    const { voice: named } = (await response.json()) as { voice?: unknown };
    return typeof named === "string" ? named : null;
  } catch (error) {
    console.error("zombies coach voice", userId, (error as Error).message);
    return null;
  }
}

async function ask(userId: string, text: string, word: string): Promise<{ reply: string; voice: string | null } | null> {
  const response = await site("voice", { userId, text, word });
  if (!response.ok) throw new Error(`site answered ${response.status}`);
  const { reply, voice: named } = (await response.json()) as { reply?: unknown; voice?: unknown };
  if (typeof reply !== "string" || !reply.trim()) return null;
  return { reply, voice: typeof named === "string" ? named : null };
}

async function heard(userId: string, text: string, word: string): Promise<void> {
  if (!voice.holding(OWNER) || !text.trim()) return;
  const answer = await ask(userId, text, word).catch(async (error: Error) => {
    await hearing.say(coachOf(heldVoice).unheard, heldVoice === null ? {} : { voice: heldVoice });
    throw error;
  });
  if (!answer) return;
  keepVoice(answer.voice);
  await hearing.say(answer.reply, heldVoice === null ? {} : { voice: heldVoice });
}

async function said(line: TranscriptLine): Promise<void> {
  if (!voice.holding(OWNER) || !line.text.trim()) return;
  const response = await site("voice/transcript", { userId: line.userId, name: line.name, text: line.text, at: line.at, ms: line.ms, broughtBy });
  if (!response.ok) throw new Error(`site answered ${response.status}`);
}

export function start(): () => void {
  const unhear = Object.keys(COACHES).map((word) =>
    hearing.onTrigger(word, ({ userId, text }) => {
      heard(userId, text, word).catch((error: Error) => console.error("zombies voice", userId, error.message));
    }),
  );
  const unlisten = hearing.onTranscript((line) => {
    said(line).catch((error: Error) => console.error("zombies transcript", line.userId, error.message));
  });
  const unwatch = voice.watch((event) => {
    if (event.type === "members" && voice.holding(OWNER) && voice.members().length === 0) leave();
    else keepTranscripts();
  });
  return () => {
    for (const stop of unhear) stop();
    unlisten();
    keepVoice(null);
    unwatch();
    transcripts.keep(OWNER, false);
  };
}
