import { EndBehaviorType, type VoiceReceiver } from "@discordjs/voice";
import { client } from "./discord.ts";
import { oggOpus } from "./ogg.ts";
import * as voice from "./voice.ts";

const SILENCE_MS = 800;
const MIN_PACKETS = 20;
const MAX_MS = 30_000;

export type ListenEvents = { opened: (userId: string) => void; closed: (userId: string, clip: Buffer | null, startedAt: number) => void };

export function listen(events: ListenEvents, enabled: () => boolean): void {
  let bound: VoiceReceiver | null = null;
  const bind = () => {
    const receiver = voice.receiver();
    if (!receiver || receiver === bound) return;
    bound = receiver;
    const open = new Set<string>();
    receiver.speaking.on("start", (userId) => {
      if (!enabled() || open.has(userId) || client.users.cache.get(userId)?.bot) return;
      open.add(userId);
      events.opened(userId);
      const packets: Buffer[] = [];
      const startedAt = Date.now();
      const stream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_MS } });
      const cap = setTimeout(() => stream.destroy(), MAX_MS);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(cap);
        open.delete(userId);
        events.closed(userId, packets.length >= MIN_PACKETS ? oggOpus(packets) : null, startedAt);
      };
      stream.on("data", (packet: Buffer) => packets.push(packet));
      stream.once("end", finish);
      stream.once("close", finish);
      stream.on("error", (error) => {
        console.error("listen", userId, error.message);
        finish();
      });
    });
  };
  voice.watch((event) => {
    if (event.type === "connected") bind();
  });
  bind();
}
