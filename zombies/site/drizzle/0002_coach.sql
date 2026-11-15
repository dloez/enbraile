CREATE TABLE "coach_calls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coach_calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer NOT NULL,
	"stop_reason" text,
	"refused" boolean DEFAULT false NOT NULL,
	"refusal_category" text,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"card_id" integer NOT NULL,
	"step_id" text NOT NULL,
	"part_id" text,
	"rung" integer NOT NULL,
	"alt" integer,
	"level" integer NOT NULL,
	"text" text NOT NULL,
	"mentions" jsonb NOT NULL,
	"reveals" jsonb NOT NULL,
	"bundle_version" integer NOT NULL,
	"asked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hint_cards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hint_cards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"message_id" integer,
	"step_id" text NOT NULL,
	"part_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "round_asked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "coach_busy_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_calls" ADD CONSTRAINT "coach_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_card_id_hint_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."hint_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_cards" ADD CONSTRAINT "hint_cards_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_cards" ADD CONSTRAINT "hint_cards_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_calls_run_id_id_index" ON "coach_calls" USING btree ("run_id","id");--> statement-breakpoint
CREATE INDEX "deliveries_run_id_id_index" ON "deliveries" USING btree ("run_id","id");--> statement-breakpoint
CREATE INDEX "deliveries_card_id_index" ON "deliveries" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "hint_cards_run_id_step_id_index" ON "hint_cards" USING btree ("run_id","step_id");--> statement-breakpoint
CREATE INDEX "hint_cards_message_id_index" ON "hint_cards" USING btree ("message_id");