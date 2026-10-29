ALTER TABLE "team" ADD COLUMN "match_id" text;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_match_id_league_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."league_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_locked_by_user_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_match_owner_unique" UNIQUE("match_id","owner_id");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_locked_by" CHECK ("team"."locked_by" IS NULL OR "team"."locked_at" IS NOT NULL);