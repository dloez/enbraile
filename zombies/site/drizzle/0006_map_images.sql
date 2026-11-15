CREATE TABLE "map_images" (
	"digest" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
