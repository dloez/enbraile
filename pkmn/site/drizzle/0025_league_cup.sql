CREATE TABLE "league_cup" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"started_by" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_cup_series_unique" UNIQUE("series_id")
);
--> statement-breakpoint
CREATE TABLE "league_cup_entrant" (
	"cup_id" text NOT NULL,
	"player_id" text NOT NULL,
	"seed" integer NOT NULL,
	CONSTRAINT "league_cup_entrant_cup_id_player_id_pk" PRIMARY KEY("cup_id","player_id"),
	CONSTRAINT "league_cup_entrant_seed_unique" UNIQUE("cup_id","seed"),
	CONSTRAINT "league_cup_entrant_seed" CHECK ("league_cup_entrant"."seed" >= 1)
);
--> statement-breakpoint
ALTER TABLE "league_match" ALTER COLUMN "round_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "league_match" ADD COLUMN "cup_id" text;--> statement-breakpoint
ALTER TABLE "league_match" ADD COLUMN "slot" text;--> statement-breakpoint
ALTER TABLE "league_cup" ADD CONSTRAINT "league_cup_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_cup" ADD CONSTRAINT "league_cup_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_cup_entrant" ADD CONSTRAINT "league_cup_entrant_cup_id_league_cup_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."league_cup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_cup_entrant" ADD CONSTRAINT "league_cup_entrant_player_id_user_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_cup_entrant_player_id_idx" ON "league_cup_entrant" USING btree ("player_id");--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_cup_id_league_cup_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."league_cup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_cup_slot_unique" UNIQUE("cup_id","slot");--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_home" CHECK (("league_match"."round_id" IS NULL) <> ("league_match"."cup_id" IS NULL) AND ("league_match"."cup_id" IS NULL) = ("league_match"."slot" IS NULL));