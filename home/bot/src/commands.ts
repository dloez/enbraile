import { MessageFlags } from "discord.js";
import { client, guild } from "./discord.ts";
import type { SlashCommand } from "./module.ts";
import { modules } from "./modules.ts";

const failed = { en: "That didn't work.", es: "No ha funcionado." };

const byName = new Map<string, SlashCommand>(modules.flatMap((module) => module.commands ?? []).map((command) => [command.data.name, command]));

export async function registerCommands(): Promise<void> {
  const registered = await (await guild()).commands.set([...byName.values()].map((command) => command.data));
  console.log("commands", [...registered.values()].map((command) => command.name).join(" "));
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await byName.get(interaction.commandName)?.autocomplete?.(interaction);
    if (!interaction.isChatInputCommand()) return;
    const command = byName.get(interaction.commandName);
    if (!command) return;
    const locale = interaction.locale.startsWith("es") ? "es" : "en";
    await interaction.deferReply(command.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    const content = await command.run(interaction, locale).catch((error: Error) => {
      console.error("command", interaction.commandName, error.message);
      return failed[locale];
    });
    await interaction.editReply({ content, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("interaction", (error as Error).message);
  }
});
