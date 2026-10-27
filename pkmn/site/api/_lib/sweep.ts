import { Hono } from "hono";
import { db } from "./db.js";
import { deleteObject, objectsUnder } from "./files.js";
import { iconKey } from "./item-icons.js";
import { game, snapshot } from "./schema.js";

const staleMs = 24 * 60 * 60 * 1000;

async function namedKeys(): Promise<Set<string>> {
  const games = await db.select({ id: game.id, fileKey: game.fileKey, itemIcons: game.itemIcons }).from(game);
  const snapshots = await db.select({ fileKey: snapshot.fileKey, rolledKey: snapshot.rolledKey }).from(snapshot);
  const keys = [
    ...games.flatMap((row) => [row.fileKey, row.itemIcons ? iconKey(row.id, row.itemIcons.version) : null]),
    ...snapshots.flatMap((row) => [row.fileKey, row.rolledKey]),
  ];
  return new Set(keys.filter((key): key is string => key !== null));
}

export async function sweepFiles(): Promise<{ deleted: string[]; kept: number }> {
  const objects = await objectsUnder("");
  const named = await namedKeys();
  const now = Date.now();
  const deleted: string[] = [];
  for (const object of objects) {
    if (named.has(object.key) || !object.modified || now - object.modified.getTime() < staleMs) continue;
    if ((await namedKeys()).has(object.key)) continue;
    await deleteObject(object.key);
    deleted.push(object.key);
  }
  return { deleted, kept: objects.length - deleted.length };
}

export const cron = new Hono();

cron.use(async (c, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "Not allowed" }, 401);
  await next();
});

cron.get("/sweep-files", async (c) => c.json(await sweepFiles()));
