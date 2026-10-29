CREATE TABLE "league_game_side" (
	"match_id" text NOT NULL,
	"number" integer NOT NULL,
	"player_id" text NOT NULL,
	"ban" integer,
	"banned_at" timestamp,
	"picks" jsonb,
	"picked_at" timestamp,
	CONSTRAINT "league_game_side_match_id_number_player_id_pk" PRIMARY KEY("match_id","number","player_id"),
	CONSTRAINT "league_game_side_number" CHECK ("league_game_side"."number" BETWEEN 1 AND 3),
	CONSTRAINT "league_game_side_ban" CHECK (("league_game_side"."ban" IS NULL) = ("league_game_side"."banned_at" IS NULL) AND ("league_game_side"."ban" IS NULL OR "league_game_side"."ban" BETWEEN 0 AND 7)),
	CONSTRAINT "league_game_side_picks" CHECK (("league_game_side"."picks" IS NULL) = ("league_game_side"."picked_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "league_game_side" ADD CONSTRAINT "league_game_side_match_id_league_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."league_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_game_side" ADD CONSTRAINT "league_game_side_player_id_user_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_game_side_player_id_idx" ON "league_game_side" USING btree ("player_id");