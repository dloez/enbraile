CREATE TYPE "public"."ingestion" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."milestone_mark" AS ENUM('none', 'round', 'tournament');--> statement-breakpoint
CREATE TYPE "public"."scene" AS ENUM('night', 'route');--> statement-breakpoint
CREATE TYPE "public"."series_state" AS ENUM('draft', 'running', 'finished');--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"mark" "milestone_mark" DEFAULT 'none' NOT NULL,
	CONSTRAINT "milestone_series_position_unique" UNIQUE("series_id","position"),
	CONSTRAINT "milestone_series_name_unique" UNIQUE("series_id","name")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"game_id" text,
	"scene" "scene" DEFAULT 'night' NOT NULL,
	"ingestion" "ingestion" DEFAULT 'manual' NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"state" "series_state" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "series_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "series_player" (
	"series_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "series_player_series_id_user_id_pk" PRIMARY KEY("series_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_player" ADD CONSTRAINT "series_player_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_player" ADD CONSTRAINT "series_player_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "series_one_running_idx" ON "series" USING btree ("state") WHERE "series"."state" = 'running';--> statement-breakpoint
CREATE INDEX "series_player_user_id_idx" ON "series_player" USING btree ("user_id");