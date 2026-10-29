ALTER TABLE "team" ADD COLUMN "fixed_by" text;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "fixed_at" timestamp;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_fixed_by_user_id_fk" FOREIGN KEY ("fixed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;