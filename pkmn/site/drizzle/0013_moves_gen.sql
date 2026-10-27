ALTER TABLE "series" ALTER COLUMN "pool" SET DEFAULT '{"gen":9,"speciesGen":5,"movesGen":5,"noLegendary":false,"noMythical":false,"fullyEvolved":true,"maxBst":800}'::jsonb;--> statement-breakpoint
ALTER TABLE "team" ALTER COLUMN "pool" SET DEFAULT '{"gen":9,"speciesGen":5,"movesGen":5,"noLegendary":false,"noMythical":false,"fullyEvolved":true,"maxBst":800}'::jsonb;--> statement-breakpoint
UPDATE "series" SET "pool" = "pool" || '{"movesGen":5}'::jsonb WHERE NOT "pool" ? 'movesGen';--> statement-breakpoint
UPDATE "team" SET "pool" = "pool" || '{"movesGen":5}'::jsonb WHERE NOT "pool" ? 'movesGen';
