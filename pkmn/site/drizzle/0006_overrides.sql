ALTER TABLE "save" ADD COLUMN "progress_id" text;--> statement-breakpoint
ALTER TABLE "save" ADD COLUMN "progress_set_by" text;--> statement-breakpoint
ALTER TABLE "save" ADD COLUMN "progress_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "snapshot" ADD COLUMN "fainted_set" integer;--> statement-breakpoint
ALTER TABLE "snapshot" ADD COLUMN "fainted_set_by" text;--> statement-breakpoint
ALTER TABLE "snapshot" ADD COLUMN "fainted_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "snapshot" ADD COLUMN "moved_by" text;--> statement-breakpoint
ALTER TABLE "snapshot" ADD COLUMN "moved_at" timestamp;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_progress_id_milestone_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_progress_set_by_user_id_fk" FOREIGN KEY ("progress_set_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_fainted_set_by_user_id_fk" FOREIGN KEY ("fainted_set_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_moved_by_user_id_fk" FOREIGN KEY ("moved_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_progress_source" CHECK ("save"."progress_id" IS NULL OR ("save"."progress_set_by" IS NOT NULL AND "save"."progress_set_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_fainted_source" CHECK ("snapshot"."fainted_set" IS NULL OR ("snapshot"."fainted_set_by" IS NOT NULL AND "snapshot"."fainted_set_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_moved_source" CHECK (("snapshot"."moved_by" IS NULL) = ("snapshot"."moved_at" IS NULL));