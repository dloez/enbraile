import type { Session } from "./session.js";

export interface Env {
  SESSION: DurableObjectNamespace<Session>;
  GUILD_ID: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  WORKER_URL: string;
  DISCORD_BOT_TOKEN: string;
  INTERNAL_SECRET: string;
}
