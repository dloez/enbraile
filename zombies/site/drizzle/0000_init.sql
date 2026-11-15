CREATE TABLE "bundle_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bundle_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game" text NOT NULL,
	"map" text NOT NULL,
	"version" integer NOT NULL,
	"digest" text NOT NULL,
	"bundle" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_versions_game_map_version_unique" UNIQUE("game","map","version")
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"game" text NOT NULL,
	"map" text NOT NULL,
	"latest_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maps_game_map_pk" PRIMARY KEY("game","map")
);
