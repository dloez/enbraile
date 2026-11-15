import { sql } from "drizzle-orm";
import { foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import type { Bundle, Language } from "../../shared/bundle.js";

export const maps = pgTable(
  "maps",
  {
    game: text("game").notNull(),
    map: text("map").notNull(),
    latestVersion: integer("latest_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.game, table.map] })],
);

export const bundleVersions = pgTable(
  "bundle_versions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    game: text("game").notNull(),
    map: text("map").notNull(),
    version: integer("version").notNull(),
    digest: text("digest").notNull(),
    bundle: jsonb("bundle").$type<Bundle>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.game, table.map, table.version)],
);

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    game: text("game").notNull(),
    map: text("map").notNull(),
    language: text("language").$type<Language>().notNull(),
    startedBy: text("started_by").notNull(),
    startedByName: text("started_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [foreignKey({ columns: [table.game, table.map], foreignColumns: [maps.game, maps.map] }), index().on(table.game, table.map)],
);

export const runMembers = pgTable(
  "run_members",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    discordId: text("discord_id").notNull(),
    name: text("name").notNull(),
    image: text("image"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("run_members_one_active_run").on(table.discordId).where(sql`${table.leftAt} is null`),
    index().on(table.runId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    author: text("author").$type<"member" | "cari">().notNull(),
    discordId: text("discord_id"),
    name: text("name").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id)],
);

export const runKnowledge = pgTable(
  "run_knowledge",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    knowledgeId: text("knowledge_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.knowledgeId] })],
);
