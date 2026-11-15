CREATE TABLE "heads_ups_given" (
	"run_id" text NOT NULL,
	"step_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"bundle_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heads_ups_given_run_id_step_id_position_pk" PRIMARY KEY("run_id","step_id","position")
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"run_id" text NOT NULL,
	"step_id" text NOT NULL,
	"part_id" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"blocked_told_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_steps_run_id_step_id_part_id_pk" PRIMARY KEY("run_id","step_id","part_id")
);
--> statement-breakpoint
ALTER TABLE "heads_ups_given" ADD CONSTRAINT "heads_ups_given_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;