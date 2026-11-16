import { sql } from "drizzle-orm";
import { boolean, customType, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import type { Bundle, Language } from "../../shared/bundle.js";
import type { ImageType } from "../../shared/image.js";
import type { GapContext, Rating } from "../../shared/runs.js";
import type { Voice } from "../../shared/voices.js";

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

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const mapImages = pgTable("map_images", {
  digest: text("digest").primaryKey(),
  type: text("type").$type<ImageType>().notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bundleVersions = pgTable(
  "bundle_versions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    game: text("game").notNull(),
    map: text("map").notNull(),
    version: integer("version").notNull(),
    digest: text("digest").notNull(),
    bundle: jsonb("bundle").$type<Bundle>().notNull(),
    publishedBy: text("published_by").$type<"claude">().notNull(),
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
    voice: text("voice").$type<Voice>().notNull().default("chatterbox"),
    startedBy: text("started_by").notNull(),
    startedByName: text("started_by_name").notNull(),
    roundAskedAt: timestamp("round_asked_at", { withTimezone: true }),
    coachBusyUntil: timestamp("coach_busy_until", { withTimezone: true }),
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
    kind: text("kind").$type<"chat" | "revision" | "ack">().notNull().default("chat"),
    discordId: text("discord_id"),
    name: text("name").notNull(),
    text: text("text").notNull(),
    postedBy: text("posted_by").$type<"claude">(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id)],
);

export const runHistory = pgTable(
  "run_history",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    author: text("author").$type<"member" | "cari">().notNull(),
    name: text("name").notNull(),
    text: text("text").notNull(),
    saidAt: timestamp("said_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id)],
);

export const callLines = pgTable(
  "call_lines",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    discordId: text("discord_id").notNull(),
    name: text("name").notNull(),
    text: text("text").notNull(),
    ms: integer("ms"),
    saidAt: timestamp("said_at", { withTimezone: true }).notNull(),
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

export const hintCards = pgTable(
  "hint_cards",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    messageId: integer("message_id").references(() => messages.id),
    stepId: text("step_id").notNull(),
    partId: text("part_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.stepId), index().on(table.messageId)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    cardId: integer("card_id")
      .notNull()
      .references(() => hintCards.id),
    stepId: text("step_id").notNull(),
    partId: text("part_id"),
    rung: integer("rung").notNull(),
    alt: integer("alt"),
    level: integer("level").notNull(),
    text: text("text").notNull(),
    mentions: jsonb("mentions").$type<string[]>().notNull(),
    reveals: jsonb("reveals").$type<string[]>().notNull(),
    bundleVersion: integer("bundle_version").notNull(),
    askedBy: text("asked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id), index().on(table.cardId)],
);

export const coachCalls = pgTable(
  "coach_calls",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull(),
    stopReason: text("stop_reason"),
    refused: boolean("refused").notNull().default(false),
    refusalCategory: text("refusal_category"),
    violations: jsonb("violations").$type<string[]>().notNull().default([]),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id)],
);

export const runSteps = pgTable(
  "run_steps",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    stepId: text("step_id").notNull(),
    partId: text("part_id").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    blockedToldAt: timestamp("blocked_told_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.stepId, table.partId] })],
);

export const headsUpsGiven = pgTable(
  "heads_ups_given",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    stepId: text("step_id").notNull(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    bundleVersion: integer("bundle_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.stepId, table.position] })],
);

export const gaps = pgTable(
  "gaps",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    askedBy: text("asked_by"),
    asked: text("asked").notNull(),
    about: text("about").notNull(),
    said: text("said").notNull(),
    context: jsonb("context").$type<GapContext>().notNull(),
    bundleVersion: integer("bundle_version").notNull(),
    triedVersion: integer("tried_version"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    answerDeliveryId: integer("answer_delivery_id").references(() => deliveries.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id)],
);

export const audits = pgTable(
  "audits",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    messageId: integer("message_id").references(() => messages.id),
    findings: jsonb("findings").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.runId, table.id)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    kind: text("kind").$type<"revision" | "card">().notNull(),
    discordId: text("discord_id").notNull(),
    name: text("name").notNull(),
    messageId: integer("message_id").references(() => messages.id),
    refersTo: integer("refers_to").references(() => messages.id),
    cardId: integer("card_id").references(() => hintCards.id),
    deliveryId: integer("delivery_id").references(() => deliveries.id),
    rating: text("rating").$type<Rating>(),
    text: text("text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.runId, table.id),
    uniqueIndex("feedback_one_rating_per_card").on(table.cardId, table.discordId).where(sql`${table.kind} = 'card'`),
  ],
);
