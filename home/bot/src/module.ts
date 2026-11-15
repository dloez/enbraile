import type Anthropic from "@anthropic-ai/sdk";
import type { WebSocket } from "ws";
import type { AutocompleteInteraction, ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

export type Reply = [unknown, number?];
export type Locale = "en" | "es";

export type SlashCommand = {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  ephemeral?: boolean;
  run: (interaction: ChatInputCommandInteraction, locale: Locale) => Promise<string>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

export type Route = (method: "GET" | "POST", path: string, query: URLSearchParams, input: Record<string, unknown>, userId: string) => Promise<Reply>;

export type Tool = {
  definition: Anthropic.Tool;
  run: (input: Record<string, unknown>, userId: string) => Promise<string>;
};

export type Module = {
  name: string;
  commands?: SlashCommand[];
  route?: Route;
  tools?: Tool[];
  live?: (userId: string, send: (message: unknown) => void) => () => void;
  connect?: (socket: WebSocket) => void;
  start?: () => Promise<void>;
  stop?: () => void;
};
