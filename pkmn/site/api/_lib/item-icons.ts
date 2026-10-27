import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { PNG } from "pngjs";
import type { ItemIcons } from "../../shared/items.js";
import { db } from "./db.js";
import DATA from "./export/data.json" with { type: "json" };
import { directoryEntries, readEntry, type ZipEntry, zipDirectory } from "./export/zip.js";
import { deleteObject, objectSize, putObject, readObject, readRange } from "./files.js";
import { game } from "./schema.js";

const ITEM_ICON = /(?:^|\/)Graphics\/Items\/([^/]+)\.png$/i;
const TAIL = 0xffff + 22 + 20;
const NEAR = 1024 * 1024;
const COLUMNS = 32;
const LOCAL_HEADER_ROOM = 30 + 0xffff * 2;

const showdownItems = (DATA as unknown as { showdown: { items: Record<string, string> } }).showdown.items;

export function iconKey(gameId: string, version: string): string {
  return `games/${gameId}/item-icons-${version}.png`;
}

async function iconEntries(key: string, size: number): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, size - TAIL);
  const tail = await readRange(key, tailStart, size);
  let directory = zipDirectory(tail, tailStart);
  if ("record" in directory) directory = zipDirectory(tail, tailStart, await readRange(key, directory.record, directory.record + 56));
  if ("record" in directory) throw new Error("The game zip's directory could not be found");
  const bytes = await readRange(key, directory.start, directory.start + directory.size);
  return directoryEntries(bytes, directory.count).filter((entry) => ITEM_ICON.test(entry.name.replace(/\\/g, "/")));
}

function groups(entries: ZipEntry[]): ZipEntry[][] {
  const sorted = [...entries].sort((a, b) => a.offset - b.offset);
  const out: ZipEntry[][] = [];
  for (const entry of sorted) {
    const last = out[out.length - 1];
    const previous = last?.[last.length - 1];
    if (previous && entry.offset - (previous.offset + previous.compressedSize) < NEAR) last.push(entry);
    else out.push([entry]);
  }
  return out;
}

async function iconFiles(key: string, size: number): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const group of groups(await iconEntries(key, size))) {
    const start = group[0].offset;
    const last = group[group.length - 1];
    const bytes = await readRange(key, start, Math.min(size, last.offset + last.compressedSize + LOCAL_HEADER_ROOM));
    for (const entry of group) {
      const stem = ITEM_ICON.exec(entry.name.replace(/\\/g, "/"))?.[1];
      if (stem && !files.has(stem)) files.set(stem, readEntry(bytes, entry, start));
    }
  }
  return files;
}

function pack(files: Map<string, Uint8Array>): { sheet: Uint8Array; width: number; height: number; at: ItemIcons["at"] } {
  const images = [...files]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([stem, bytes]) => {
      try {
        return [{ stem, png: PNG.sync.read(Buffer.from(bytes)) }];
      } catch {
        return [];
      }
    });
  const cell = Math.max(1, ...images.map(({ png }) => Math.max(png.width, png.height)));
  const width = cell * COLUMNS;
  const height = cell * Math.max(1, Math.ceil(images.length / COLUMNS));
  const sheet = new PNG({ width, height });
  const at: ItemIcons["at"] = {};
  images.forEach(({ stem, png }, index) => {
    const x = (index % COLUMNS) * cell;
    const y = Math.floor(index / COLUMNS) * cell;
    PNG.bitblt(png, sheet, 0, 0, png.width, png.height, x, y);
    at[stem] = [x, y, png.width, png.height];
  });
  return { sheet: new Uint8Array(PNG.sync.write(sheet)), width, height, at };
}

export async function buildItemIcons(gameId: string, fileKey: string): Promise<ItemIcons | null> {
  const size = await objectSize(fileKey);
  if (size === undefined) throw new Error("The game zip is not in the file store");
  const files = await iconFiles(fileKey, size);
  if (files.size === 0) return null;
  const { sheet, width, height, at } = pack(files);
  const version = crypto.randomUUID();
  await putObject(iconKey(gameId, version), sheet, "image/png");
  const showdown: Record<string, string> = {};
  for (const [item, id] of Object.entries(showdownItems)) if (Object.hasOwn(at, item) && !Object.hasOwn(showdown, id)) showdown[id] = item;
  return { version, width, height, at, showdown };
}

export async function refreshItemIcons(gameId: string, fileKey: string, previous: ItemIcons | null): Promise<ItemIcons | null> {
  const icons = await buildItemIcons(gameId, fileKey);
  await db.update(game).set({ itemIcons: icons }).where(eq(game.id, gameId));
  if (previous && previous.version !== icons?.version) await deleteObject(iconKey(gameId, previous.version)).catch(() => undefined);
  return icons;
}

export const itemIconRoutes = new Hono();

itemIconRoutes.get("/:game", async (c) => {
  const [row] = await db.select({ itemIcons: game.itemIcons }).from(game).where(eq(game.id, c.req.param("game")));
  if (!row) return c.json({ error: "No such game" }, 404);
  c.header("Cache-Control", "private, max-age=300");
  return c.json(row.itemIcons);
});

itemIconRoutes.get("/:game/:version", async (c) => {
  const version = c.req.param("version").replace(/\.png$/, "");
  const [row] = await db.select({ itemIcons: game.itemIcons }).from(game).where(eq(game.id, c.req.param("game")));
  if (!row?.itemIcons || row.itemIcons.version !== version) return c.json({ error: "No such icons" }, 404);
  const sheet = await readObject(iconKey(c.req.param("game"), version));
  return c.body(new Uint8Array(sheet), 200, { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable" });
});
