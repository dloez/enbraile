import { integer, jsonb, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { Bundle } from "../../shared/bundle.js";

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
