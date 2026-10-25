CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_source" (
	"team_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "team_source_team_id_snapshot_id_pk" PRIMARY KEY("team_id","snapshot_id")
);
--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_source" ADD CONSTRAINT "team_source_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_source" ADD CONSTRAINT "team_source_snapshot_id_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_owner_id_idx" ON "team" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "team_source_snapshot_id_idx" ON "team_source" USING btree ("snapshot_id");