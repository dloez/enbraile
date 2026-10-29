ALTER TABLE "league_cup" ADD COLUMN "mode" "league_mode" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "league_cup" ALTER COLUMN "mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "league_match" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "team" SET "private" = false WHERE "locked_at" IS NOT NULL AND "match_id" IS NULL;
