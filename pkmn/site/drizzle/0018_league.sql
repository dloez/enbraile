CREATE TABLE "league_match" (
	"id" text PRIMARY KEY NOT NULL,
	"round_id" text NOT NULL,
	"position" integer NOT NULL,
	"player_a" text NOT NULL,
	"player_b" text NOT NULL,
	"games_a" integer,
	"games_b" integer,
	"fainted_a" integer,
	"fainted_b" integer,
	"replays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "league_match_round_position_unique" UNIQUE("round_id","position"),
	CONSTRAINT "league_match_two_players" CHECK ("league_match"."player_a" <> "league_match"."player_b"),
	CONSTRAINT "league_match_score" CHECK (("league_match"."games_a" IS NULL) = ("league_match"."games_b" IS NULL) AND ("league_match"."games_a" IS NULL OR ("league_match"."games_a" BETWEEN 0 AND 2 AND "league_match"."games_b" BETWEEN 0 AND 2 AND "league_match"."games_a" <> "league_match"."games_b" AND GREATEST("league_match"."games_a", "league_match"."games_b") = 2))),
	CONSTRAINT "league_match_fainted" CHECK (("league_match"."fainted_a" IS NULL OR "league_match"."fainted_a" >= 0) AND ("league_match"."fainted_b" IS NULL OR "league_match"."fainted_b" >= 0))
);
--> statement-breakpoint
CREATE TABLE "league_round" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"milestone_id" text NOT NULL,
	"bye_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_round_milestone_unique" UNIQUE("milestone_id")
);
--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_round_id_league_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."league_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_player_a_user_id_fk" FOREIGN KEY ("player_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_player_b_user_id_fk" FOREIGN KEY ("player_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_round" ADD CONSTRAINT "league_round_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_round" ADD CONSTRAINT "league_round_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_round" ADD CONSTRAINT "league_round_bye_id_user_id_fk" FOREIGN KEY ("bye_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_match_player_a_idx" ON "league_match" USING btree ("player_a");--> statement-breakpoint
CREATE INDEX "league_match_player_b_idx" ON "league_match" USING btree ("player_b");--> statement-breakpoint
CREATE INDEX "league_round_series_id_idx" ON "league_round" USING btree ("series_id");