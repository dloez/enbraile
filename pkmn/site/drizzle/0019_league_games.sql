CREATE TABLE "league_game" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"number" integer NOT NULL,
	"winner_id" text NOT NULL,
	"fainted_a" integer NOT NULL,
	"fainted_b" integer NOT NULL,
	"replay" text,
	"recorded_by" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_game_match_number_unique" UNIQUE("match_id","number"),
	CONSTRAINT "league_game_number" CHECK ("league_game"."number" BETWEEN 1 AND 3),
	CONSTRAINT "league_game_fainted" CHECK ("league_game"."fainted_a" BETWEEN 0 AND 6 AND "league_game"."fainted_b" BETWEEN 0 AND 6)
);
--> statement-breakpoint
ALTER TABLE "league_game" ADD CONSTRAINT "league_game_match_id_league_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."league_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_game" ADD CONSTRAINT "league_game_winner_id_user_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_game" ADD CONSTRAINT "league_game_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" DROP COLUMN "replays";