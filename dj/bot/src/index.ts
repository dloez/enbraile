import type { Module } from "../../../home/bot/src/sdk.ts";
import { commands } from "./commands.ts";
import { watchVoice } from "./discord.ts";
import { route } from "./routes.ts";
import * as session from "./session.ts";

export const dj: Module = {
  name: "dj",
  commands,
  route,
  live: (userId, send) => {
    const unwatch = session.watch((view) => send({ type: "view", view }));
    const unvoice = watchVoice(userId, (voice) => send({ type: "voice", voice }));
    send({ type: "view", view: session.view() });
    return () => {
      unwatch();
      unvoice();
    };
  },
  start: session.resumeAfterRestart,
  stop: session.snapshot,
};
