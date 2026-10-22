import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";
import { newGame, uploadDone, uploadRequest, type Game } from "../../shared/games.js";
import { requireAdmin } from "./admin.js";
import { db } from "./db.js";
import { deleteObject, downloadUrl, objectSize, uploadUrl } from "./files.js";
import { game } from "./schema.js";

type GameRow = typeof game.$inferSelect;

function view(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    fileSize: row.fileSize,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
  };
}

async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | undefined> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  return parsed.success ? parsed.data : undefined;
}

async function findGame(id: string): Promise<GameRow | undefined> {
  const [row] = await db.select().from(game).where(eq(game.id, id));
  return row;
}

export const games = new Hono();

games.use(requireAdmin);

games.get("/", async (c) => {
  const rows = await db.select().from(game).orderBy(asc(game.createdAt));
  return c.json(rows.map(view));
});

games.post("/", async (c) => {
  const input = await body(c.req.raw, newGame);
  if (!input) return c.json({ error: "A game needs a name" }, 400);
  const [row] = await db
    .insert(game)
    .values({ id: crypto.randomUUID(), name: input.name })
    .onConflictDoNothing({ target: game.name })
    .returning();
  if (!row) return c.json({ error: "A game by that name exists" }, 409);
  return c.json(view(row), 201);
});

games.post("/:id/upload", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: "No such game" }, 404);
  const input = await body(c.req.raw, uploadRequest);
  if (!input) return c.json({ error: "Upload a .zip file" }, 400);
  const key = `games/${row.id}/${crypto.randomUUID()}.zip`;
  return c.json({ key, url: await uploadUrl(key, input.size) });
});

games.post("/:id/file", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: "No such game" }, 404);
  const input = await body(c.req.raw, uploadDone);
  if (!input || !input.key.startsWith(`games/${row.id}/`)) return c.json({ error: "Not this game's upload" }, 400);
  const size = await objectSize(input.key);
  if (size === undefined) return c.json({ error: "The upload did not reach the file store" }, 400);
  const [updated] = await db
    .update(game)
    .set({ fileKey: input.key, fileName: input.fileName, fileSize: size, uploadedAt: new Date() })
    .where(eq(game.id, row.id))
    .returning();
  if (row.fileKey && row.fileKey !== input.key) await deleteObject(row.fileKey).catch(() => undefined);
  return c.json(view(updated ?? row));
});

games.get("/:id/download", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: "No such game" }, 404);
  if (!row.fileKey || !row.fileName) return c.json({ error: "No file uploaded" }, 404);
  return c.json({ url: await downloadUrl(row.fileKey, row.fileName) });
});
