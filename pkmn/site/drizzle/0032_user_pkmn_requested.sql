ALTER TABLE "user" ADD COLUMN "pkmn_requested_at" timestamp;--> statement-breakpoint
UPDATE "user" SET "pkmn_requested_at" = "created_at" WHERE "allowed" = false AND "admin" = false;
