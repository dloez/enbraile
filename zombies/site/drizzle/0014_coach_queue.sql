CREATE TABLE "coach_queue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coach_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"discord_id" text,
	"name" text NOT NULL,
	"spoken" boolean DEFAULT false NOT NULL,
	"text" text,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "coach_queue" ADD CONSTRAINT "coach_queue_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_queue_run_id_id_index" ON "coach_queue" USING btree ("run_id","id");