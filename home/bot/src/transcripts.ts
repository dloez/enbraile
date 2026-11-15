import { AwsClient } from "aws4fetch";
import { guild } from "./discord.ts";
import * as voice from "./voice.ts";

export type Line = { at: string; channelId: string; channel: string; userId: string; name: string; text: string; ms: number | null };

const FLUSH_MS = 60_000;
const BOT = "bot";

const endpoint = process.env.TRANSCRIPTS_ENDPOINT?.replace(/\/$/, "");
const bucket = process.env.TRANSCRIPTS_BUCKET;
const region = endpoint?.match(/s3\.([\w-]+)\.backblazeb2\.com/)?.[1] ?? "us-east-1";
const keyId = process.env.B2_KEY_ID;
const key = process.env.B2_APPLICATION_KEY;
const client = endpoint && bucket && keyId && key ? new AwsClient({ accessKeyId: keyId, secretAccessKey: key, service: "s3", region }) : null;

const keepers = new Set<string>();
let lines: Line[] = [];
let flushing: Promise<void> = Promise.resolve();

export const configured = () => client !== null;
export const active = () => client !== null && keepers.size > 0;

export function keep(owner: string, on: boolean): void {
  if (on) keepers.add(owner);
  else keepers.delete(owner);
}

async function nameOf(userId: string): Promise<string> {
  if (userId === BOT) return "Enbraile";
  const member = await (await guild()).members.fetch(userId).catch(() => null);
  return member?.displayName ?? userId;
}

export async function record(userId: string, text: string, at: number, ms: number | null): Promise<void> {
  const channelId = voice.channel();
  if (!active() || !channelId || !text) return;
  const channel = (await guild()).channels.cache.get(channelId)?.name ?? channelId;
  lines.push({ at: new Date(at).toISOString(), channelId, channel, userId, name: await nameOf(userId), text, ms });
}

export const recordBot = (text: string) => record(BOT, text, Date.now(), null);

async function upload(): Promise<void> {
  if (!client || !lines.length) return;
  const batch = lines;
  lines = [];
  const byChannel = new Map<string, Line[]>();
  for (const line of batch) byChannel.set(line.channelId, [...(byChannel.get(line.channelId) ?? []), line]);
  for (const [channelId, group] of byChannel) {
    const first = group[0]!.at;
    const path = `${first.slice(0, 4)}/${first.slice(5, 7)}/${first.slice(8, 10)}/${channelId}/${first.replace(/[:.]/g, "-")}.jsonl`;
    const body = group.map((line) => JSON.stringify(line)).join("\n") + "\n";
    const response = await client.fetch(`${endpoint}/${bucket}/${path}`, { method: "PUT", body, headers: { "content-type": "application/x-ndjson" } }).catch((error: Error) => error);
    if (response instanceof Error || !response.ok) {
      console.error("transcripts", path, response instanceof Error ? response.message : `${response.status} ${(await response.text()).slice(0, 200)}`);
      lines = [...group, ...lines];
    }
  }
}

export function flush(): Promise<void> {
  flushing = flushing.then(upload, upload);
  return flushing;
}

setInterval(() => void flush(), FLUSH_MS).unref();
