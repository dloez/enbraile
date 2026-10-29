ALTER TABLE "save" ADD COLUMN "hatched_set" integer;--> statement-breakpoint
ALTER TABLE "save" ADD COLUMN "hatched_set_by" text;--> statement-breakpoint
ALTER TABLE "save" ADD COLUMN "hatched_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_hatched_set_by_user_id_fk" FOREIGN KEY ("hatched_set_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_hatched_source" CHECK ("save"."hatched_set" IS NULL OR ("save"."hatched_set_by" IS NOT NULL AND "save"."hatched_set_at" IS NOT NULL));