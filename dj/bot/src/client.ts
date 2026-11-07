import { Client, GatewayIntentBits } from "discord.js";

export const GUILD_ID = process.env.GUILD_ID ?? "757377019536211988";

export const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
export const ready = new Promise<void>((resolve) => client.once("clientReady", () => resolve()));
client.on("error", (error) => console.error("gateway", error.message));

export async function guild() {
  await ready;
  return client.guilds.cache.get(GUILD_ID) ?? client.guilds.fetch(GUILD_ID);
}
