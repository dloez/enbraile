CREATE TYPE "public"."league_mode" AS ENUM('open', 'closed');--> statement-breakpoint
ALTER TABLE "league_round" ADD COLUMN "mode" "league_mode" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "league_round" ALTER COLUMN "mode" DROP DEFAULT;
