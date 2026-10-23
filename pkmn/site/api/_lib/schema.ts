import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import type { ExportReport, Snapshot } from "../../shared/snapshot.js";
import type { TmRolls } from "./export/export.js";
import { INGESTION_MODES, MILESTONE_MARKS, SCENES, SERIES_STATES } from "../../shared/series.js";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  admin: boolean("admin").notNull().default(false),
  allowed: boolean("allowed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const game = pgTable("game", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  fileSize: bigint("file_size", { mode: "number" }),
  uploadedAt: timestamp("uploaded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sceneEnum = pgEnum("scene", SCENES);

export const ingestionEnum = pgEnum("ingestion", INGESTION_MODES);

export const seriesStateEnum = pgEnum("series_state", SERIES_STATES);

export const milestoneMarkEnum = pgEnum("milestone_mark", MILESTONE_MARKS);

export const series = pgTable(
  "series",
  {
    id: text("id").primaryKey(),
    number: integer("number").notNull().unique(),
    name: text("name").notNull(),
    gameId: text("game_id").references(() => game.id, { onDelete: "restrict" }),
    scene: sceneEnum("scene").notNull().default("night"),
    ingestion: ingestionEnum("ingestion").notNull().default("manual"),
    rules: text("rules").notNull().default(""),
    state: seriesStateEnum("state").notNull().default("draft"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("series_one_running_idx").on(table.state).where(sql`${table.state} = 'running'`)],
);

export const seriesPlayer = pgTable(
  "series_player",
  {
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.seriesId, table.userId] }), index("series_player_user_id_idx").on(table.userId)],
);

export const milestone = pgTable(
  "milestone",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    mark: milestoneMarkEnum("mark").notNull().default("none"),
  },
  (table) => [unique("milestone_series_position_unique").on(table.seriesId, table.position), unique("milestone_series_name_unique").on(table.seriesId, table.name)],
);

export const save = pgTable(
  "save",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    progressId: text("progress_id").references(() => milestone.id, { onDelete: "set null" }),
    progressSetBy: text("progress_set_by").references(() => user.id, { onDelete: "restrict" }),
    progressSetAt: timestamp("progress_set_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("save_series_user_unique").on(table.seriesId, table.userId),
    index("save_user_id_idx").on(table.userId),
    check("save_progress_source", sql`${table.progressId} IS NULL OR (${table.progressSetBy} IS NOT NULL AND ${table.progressSetAt} IS NOT NULL)`),
  ],
);

export const snapshot = pgTable(
  "snapshot",
  {
    id: text("id").primaryKey(),
    saveId: text("save_id")
      .notNull()
      .references(() => save.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestone.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    slot: text("slot"),
    data: jsonb("data").$type<Snapshot>().notNull(),
    missing: jsonb("missing").$type<ExportReport>(),
    tmRolls: jsonb("tm_rolls").$type<TmRolls>(),
    rolledKey: text("rolled_key"),
    pokemon: integer("pokemon").notNull(),
    fainted: integer("fainted").notNull(),
    faintedSet: integer("fainted_set"),
    faintedSetBy: text("fainted_set_by").references(() => user.id, { onDelete: "restrict" }),
    faintedSetAt: timestamp("fainted_set_at"),
    movedBy: text("moved_by").references(() => user.id, { onDelete: "restrict" }),
    movedAt: timestamp("moved_at"),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    takenAt: timestamp("taken_at").notNull().defaultNow(),
  },
  (table) => [
    unique("snapshot_save_milestone_unique").on(table.saveId, table.milestoneId),
    index("snapshot_milestone_id_idx").on(table.milestoneId),
    check("snapshot_fainted_source", sql`${table.faintedSet} IS NULL OR (${table.faintedSetBy} IS NOT NULL AND ${table.faintedSetAt} IS NOT NULL)`),
    check("snapshot_moved_source", sql`(${table.movedBy} IS NULL) = (${table.movedAt} IS NULL)`),
  ],
);
