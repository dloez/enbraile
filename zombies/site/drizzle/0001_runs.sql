CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"author" text NOT NULL,
	"discord_id" text,
	"name" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_knowledge" (
	"run_id" text NOT NULL,
	"knowledge_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_knowledge_run_id_knowledge_id_pk" PRIMARY KEY("run_id","knowledge_id")
);
--> statement-breakpoint
CREATE TABLE "run_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "run_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"discord_id" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"game" text NOT NULL,
	"map" text NOT NULL,
	"language" text NOT NULL,
	"started_by" text NOT NULL,
	"started_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_knowledge" ADD CONSTRAINT "run_knowledge_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_members" ADD CONSTRAINT "run_members_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_game_map_maps_game_map_fk" FOREIGN KEY ("game","map") REFERENCES "public"."maps"("game","map") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_run_id_id_index" ON "messages" USING btree ("run_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_members_one_active_run" ON "run_members" USING btree ("discord_id") WHERE "run_members"."left_at" is null;--> statement-breakpoint
CREATE INDEX "run_members_run_id_index" ON "run_members" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "runs_game_map_index" ON "runs" USING btree ("game","map");