ALTER TABLE "bundle_versions" ADD COLUMN "published_by" text DEFAULT 'claude' NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle_versions" ALTER COLUMN "published_by" DROP DEFAULT;
