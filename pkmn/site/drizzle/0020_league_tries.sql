CREATE TABLE "league_try" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"player_id" text NOT NULL,
	"team_id" text,
	"combats_won" integer NOT NULL,
	"members" jsonb NOT NULL,
	"logged_by" text,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"edited_by" text,
	"edited_at" timestamp,
	CONSTRAINT "league_try_combats" CHECK ("league_try"."combats_won" BETWEEN 0 AND 5),
	CONSTRAINT "league_try_members" CHECK (jsonb_array_length("league_try"."members") BETWEEN 1 AND 6)
);
--> statement-breakpoint
ALTER TABLE "league_try" ADD CONSTRAINT "league_try_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_try" ADD CONSTRAINT "league_try_player_id_user_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_try" ADD CONSTRAINT "league_try_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_try" ADD CONSTRAINT "league_try_logged_by_user_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_try" ADD CONSTRAINT "league_try_edited_by_user_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_try_series_id_idx" ON "league_try" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "league_try_player_id_idx" ON "league_try" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "league_try_team_id_idx" ON "league_try" USING btree ("team_id");