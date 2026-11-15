import { dj } from "../../../dj/bot/src/index.ts";
import { assistant } from "./assistant/index.ts";
import type { Module } from "./module.ts";

export const modules: Module[] = [dj, assistant];
