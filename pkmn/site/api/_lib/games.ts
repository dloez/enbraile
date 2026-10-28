import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { gameCosts, newGame, partRequest, uploadAbort, uploadDone, uploadRequest, type Game } from "../../shared/games.js";
import { partRange, partSizeFor } from "../../shared/upload.js";
import { requireAdmin } from "./admin.js";
import { body } from "./body.js";
import { db } from "./db.js";
import {
  abortUpload,
  abortUploadsUnder,
  completeUpload,
  deleteObject,
  downloadUrl,
  objectSize,
  partUrl,
  startUpload,
} from "./files.js";
import { refreshItemIcons } from "./item-icons.js";
import { game } from "./schema.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    gameName: "A game needs a name",
    gameExists: "A game by that name exists",
    costs: "Costs are whole numbers of Mini Setas and money",
    noGame: "No such game",
    uploadZip: "Upload a .zip file",
    notGameUpload: "Not this game's upload",
    noPart: "No such part",
    refusedParts: "The file store refused the uploaded parts",
    noReach: "The upload did not reach the file store",
    noFile: "No file uploaded",
  },
  es: {
    gameName: "Un juego necesita un nombre",
    gameExists: "Ya existe un juego con ese nombre",
    costs: "Los costes son números enteros de Mini Setas y de dinero",
    noGame: "Ese juego no existe",
    uploadZip: "Sube un archivo .zip",
    notGameUpload: "Esa subida no es de este juego",
    noPart: "Esa parte no existe",
    refusedParts: "El almacén de archivos rechazó las partes subidas",
    noReach: "La subida no llegó al almacén de archivos",
    noFile: "No hay ningún archivo subido",
  },
});

type GameRow = typeof game.$inferSelect;

function view(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    fileSize: row.fileSize,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    itemIcons: row.itemIcons ? Object.keys(row.itemIcons.at).length : null,
    costs: { abilitySetas: row.abilitySetas, mintPrice: row.mintPrice },
  };
}

function gamePrefix(id: string): string {
  return `games/${id}/`;
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
  if (!input) return c.json({ error: t(c).gameName }, 400);
  const [row] = await db
    .insert(game)
    .values({ id: crypto.randomUUID(), name: input.name })
    .onConflictDoNothing({ target: game.name })
    .returning();
  if (!row) return c.json({ error: t(c).gameExists }, 409);
  return c.json(view(row), 201);
});

games.put("/:id/costs", async (c) => {
  const input = await body(c.req.raw, gameCosts);
  if (!input) return c.json({ error: t(c).costs }, 400);
  const [row] = await db.update(game).set(input).where(eq(game.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: t(c).noGame }, 404);
  return c.json(view(row));
});

games.post("/:id/upload", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: t(c).noGame }, 404);
  const input = await body(c.req.raw, uploadRequest);
  if (!input) return c.json({ error: t(c).uploadZip }, 400);
  const prefix = gamePrefix(row.id);
  await abortUploadsUnder(prefix).catch(() => undefined);
  const key = `${prefix}${crypto.randomUUID()}.zip`;
  return c.json({ key, uploadId: await startUpload(key), partSize: partSizeFor(input.size) });
});

games.post("/:id/upload/part", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: t(c).noGame }, 404);
  const input = await body(c.req.raw, partRequest);
  if (!input || !input.key.startsWith(gamePrefix(row.id))) return c.json({ error: t(c).notGameUpload }, 400);
  const range = partRange(input.size, partSizeFor(input.size), input.part);
  if (!range) return c.json({ error: t(c).noPart }, 400);
  return c.json({ url: await partUrl(input.key, input.uploadId, input.part, range.end - range.start) });
});

games.delete("/:id/upload", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: t(c).noGame }, 404);
  const input = await body(c.req.raw, uploadAbort);
  if (!input || !input.key.startsWith(gamePrefix(row.id))) return c.json({ error: t(c).notGameUpload }, 400);
  await abortUpload(input.key, input.uploadId);
  return c.json({});
});

games.post("/:id/file", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: t(c).noGame }, 404);
  const input = await body(c.req.raw, uploadDone);
  if (!input || !input.key.startsWith(gamePrefix(row.id))) return c.json({ error: t(c).notGameUpload }, 400);
  const parts = [...input.parts].sort((a, b) => a.part - b.part);
  try {
    await completeUpload(input.key, input.uploadId, parts);
  } catch {
    await abortUpload(input.key, input.uploadId).catch(() => undefined);
    return c.json({ error: t(c).refusedParts }, 400);
  }
  const size = await objectSize(input.key);
  if (size === undefined) return c.json({ error: t(c).noReach }, 400);
  const [updated] = await db
    .update(game)
    .set({ fileKey: input.key, fileName: input.fileName, fileSize: size, uploadedAt: new Date() })
    .where(eq(game.id, row.id))
    .returning();
  if (row.fileKey && row.fileKey !== input.key) await deleteObject(row.fileKey).catch(() => undefined);
  const itemIcons = await refreshItemIcons(row.id, input.key, row.itemIcons).catch(() => row.itemIcons);
  return c.json(view({ ...(updated ?? row), itemIcons }));
});

games.get("/:id/download", async (c) => {
  const row = await findGame(c.req.param("id"));
  if (!row) return c.json({ error: t(c).noGame }, 404);
  if (!row.fileKey || !row.fileName) return c.json({ error: t(c).noFile }, 404);
  return c.json({ url: await downloadUrl(row.fileKey, row.fileName) });
});
