CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"file_key" text,
	"file_name" text,
	"file_size" bigint,
	"uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_name_unique" UNIQUE("name")
);
