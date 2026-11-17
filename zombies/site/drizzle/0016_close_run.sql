ALTER TABLE "runs" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "closed_by_name" text;