import { dj } from "../../../dj/bot/src/index.ts";
import { hearing } from "./hearing.ts";
import type { Module } from "./module.ts";

export const modules: Module[] = [dj, hearing];
