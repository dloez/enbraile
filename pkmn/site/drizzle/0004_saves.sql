CREATE TABLE "save" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "save_series_user_unique" UNIQUE("series_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"save_id" text NOT NULL,
	"milestone_id" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"slot" text NOT NULL,
	"data" jsonb NOT NULL,
	"pokemon" integer NOT NULL,
	"fainted" integer NOT NULL,
	"uploaded_by" text,
	"taken_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "snapshot_save_milestone_unique" UNIQUE("save_id","milestone_id")
);
--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save" ADD CONSTRAINT "save_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_save_id_save_id_fk" FOREIGN KEY ("save_id") REFERENCES "public"."save"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "save_user_id_idx" ON "save" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "snapshot_milestone_id_idx" ON "snapshot" USING btree ("milestone_id");