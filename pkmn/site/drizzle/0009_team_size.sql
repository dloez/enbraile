ALTER TABLE "team" ADD COLUMN "size" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_size" CHECK ("team"."size" BETWEEN 6 AND 8);--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_slots_size" CHECK (jsonb_array_length("team"."slots") = "team"."size");