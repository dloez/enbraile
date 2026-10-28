import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import type { ExportReport, Snapshot } from "../../shared/snapshot.js";
import { DEFAULT_ABILITY_SETAS, DEFAULT_MINT_PRICE } from "../../shared/games.js";
import { FAINTED_PER_GAME, GAMES_TO_WIN, MATCH_GAMES } from "../../shared/league.js";
import { DEFAULT_POOL, type TeamPool } from "../../shared/pool.js";
import type { TeamSlots } from "../../shared/team.js";
import type { ItemIcons } from "../../shared/items.js";
import type { TmRolls, World } from "./export/export.js";
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
  itemIcons: jsonb("item_icons").$type<ItemIcons>(),
  abilitySetas: integer("ability_setas").notNull().default(DEFAULT_ABILITY_SETAS),
  mintPrice: integer("mint_price").notNull().default(DEFAULT_MINT_PRICE),
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
    rulesEs: text("rules_es").notNull().default(""),
    pool: jsonb("pool").$type<TeamPool>().notNull().default(DEFAULT_POOL),
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
    needsSave: boolean("needs_save").notNull().default(false),
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
    world: jsonb("world").$type<World>(),
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

export const team = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    size: integer("size").notNull().default(6),
    anyPokemon: boolean("any_pokemon").notNull().default(false),
    slots: jsonb("slots").$type<TeamSlots>().notNull(),
    pool: jsonb("pool").$type<TeamPool>().notNull().default(DEFAULT_POOL),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("team_owner_id_idx").on(table.ownerId),
    check("team_size", sql`${table.size} BETWEEN 6 AND 8`),
    check("team_slots_size", sql`jsonb_array_length(${table.slots}) = ${table.size}`),
  ],
);

export const teamSource = pgTable(
  "team_source",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshot.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.snapshotId] }), index("team_source_snapshot_id_idx").on(table.snapshotId)],
);

export const leagueRound = pgTable(
  "league_round",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestone.id, { onDelete: "restrict" }),
    byeId: text("bye_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("league_round_milestone_unique").on(table.milestoneId), index("league_round_series_id_idx").on(table.seriesId)],
);

export const leagueMatch = pgTable(
  "league_match",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => leagueRound.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    playerA: text("player_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    playerB: text("player_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gamesA: integer("games_a"),
    gamesB: integer("games_b"),
    faintedA: integer("fainted_a"),
    faintedB: integer("fainted_b"),
  },
  (table) => [
    unique("league_match_round_position_unique").on(table.roundId, table.position),
    index("league_match_player_a_idx").on(table.playerA),
    index("league_match_player_b_idx").on(table.playerB),
    check("league_match_two_players", sql`${table.playerA} <> ${table.playerB}`),
    check(
      "league_match_score",
      sql`(${table.gamesA} IS NULL) = (${table.gamesB} IS NULL) AND (${table.gamesA} IS NULL OR (${table.gamesA} BETWEEN 0 AND ${sql.raw(String(GAMES_TO_WIN))} AND ${table.gamesB} BETWEEN 0 AND ${sql.raw(String(GAMES_TO_WIN))} AND ${table.gamesA} <> ${table.gamesB} AND GREATEST(${table.gamesA}, ${table.gamesB}) = ${sql.raw(String(GAMES_TO_WIN))}))`,
    ),
    check("league_match_fainted", sql`(${table.faintedA} IS NULL OR ${table.faintedA} >= 0) AND (${table.faintedB} IS NULL OR ${table.faintedB} >= 0)`),
  ],
);

export const leagueGame = pgTable(
  "league_game",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => leagueMatch.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    winnerId: text("winner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    faintedA: integer("fainted_a").notNull(),
    faintedB: integer("fainted_b").notNull(),
    replay: text("replay"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  },
  (table) => [
    unique("league_game_match_number_unique").on(table.matchId, table.number),
    check("league_game_number", sql`${table.number} BETWEEN 1 AND ${sql.raw(String(MATCH_GAMES))}`),
    check(
      "league_game_fainted",
      sql`${table.faintedA} BETWEEN 0 AND ${sql.raw(String(FAINTED_PER_GAME))} AND ${table.faintedB} BETWEEN 0 AND ${sql.raw(String(FAINTED_PER_GAME))}`,
    ),
  ],
);
