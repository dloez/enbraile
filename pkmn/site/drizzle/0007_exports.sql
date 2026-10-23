ALTER TABLE "snapshot" ALTER COLUMN "slot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshot" ADD COLUMN "missing" jsonb;