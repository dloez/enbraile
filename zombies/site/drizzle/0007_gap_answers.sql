ALTER TABLE "gaps" ADD COLUMN "tried_version" integer;--> statement-breakpoint
ALTER TABLE "gaps" ADD COLUMN "answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gaps" ADD COLUMN "answer_delivery_id" integer;--> statement-breakpoint
ALTER TABLE "gaps" ADD CONSTRAINT "gaps_answer_delivery_id_deliveries_id_fk" FOREIGN KEY ("answer_delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;