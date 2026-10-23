import { and, asc, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { partRequest, uploadAbort } from "../../shared/games.js";
import {
  isExportName,
  largestExport,
  largestSaveZip,
  saveUploadDone,
  saveUploadRequest,
  snapshotRequest,
  suggestMilestone,
  type SavedSnapshot,
  type UploadedSave,
} from "../../shared/save-upload.js";
import { partRange, partSizeFor } from "../../shared/upload.js";
import { body } from "./body.js";
import { db } from "./db.js";
import { ExportError } from "./export/export.js";
import { saveSlots } from "./export/save-zip.js";
import { abortUpload, abortUploadsUnder, completeUpload, deleteObject, downloadUrl, objectSize, objectsUnder, partUrl, readObject, startUpload } from "./files.js";
import { ingest, isExportKey, parseExport, savePrefix, stillUsed } from "./ingest.js";
import { milestone, save, snapshot } from "./schema.js";
import { findShown, mayUpload, plays, type SeriesRow, viewer } from "./series-data.js";

const staleMs = 60 * 60 * 1000;

type Target = { row: SeriesRow; playerId: string; uploaderId: string; prefix: string };

async function target(c: Context): Promise<Target | Response> {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const row = await findShown(c.req.param("number") ?? "", !!reader.admin);
  if (!row) return c.json({ error: "No such series" }, 404);
  const playerId = c.req.param("player") ?? "";
  if (!(await plays(row.id, playerId))) return c.json({ error: "Not a player of this series" }, 404);
  if (!mayUpload(reader, row, playerId)) return c.json({ error: "You cannot upload for this player" }, 403);
  return { row, playerId, uploaderId: reader.id, prefix: savePrefix(row.id, playerId) };
}

async function clearStale(prefix: string) {
  const objects = await objectsUnder(prefix);
  const now = Date.now();
  for (const object of objects) {
    if (!object.modified || now - object.modified.getTime() < staleMs) continue;
    if (!(await stillUsed(object.key))) await deleteObject(object.key).catch(() => undefined);
  }
}

async function milestoneNames(seriesId: string): Promise<{ id: string; name: string }[]> {
  return db.select({ id: milestone.id, name: milestone.name }).from(milestone).where(eq(milestone.seriesId, seriesId)).orderBy(asc(milestone.position));
}

function reason(error: unknown): string | undefined {
  return error instanceof ExportError ? error.message : undefined;
}

export const saveUploads = new Hono();

saveUploads.post("/:number/trainers/:player/upload", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, saveUploadRequest);
  if (!input) return c.json({ error: "Upload a .zip save or a .json export" }, 400);
  const json = isExportName(input.fileName);
  if (json && input.size > largestExport) return c.json({ error: "An export is at most 10 MB" }, 400);
  if (!json && input.size > largestSaveZip) return c.json({ error: "A save zip is at most 100 MB" }, 400);
  await abortUploadsUnder(found.prefix).catch(() => undefined);
  await clearStale(found.prefix).catch(() => undefined);
  const key = `${found.prefix}${crypto.randomUUID()}.${json ? "json" : "zip"}`;
  return c.json({ key, uploadId: await startUpload(key), partSize: partSizeFor(input.size) });
});

saveUploads.post("/:number/trainers/:player/upload/part", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, partRequest);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: "Not this player's upload" }, 400);
  const range = partRange(input.size, partSizeFor(input.size), input.part);
  if (!range) return c.json({ error: "No such part" }, 400);
  return c.json({ url: await partUrl(input.key, input.uploadId, input.part, range.end - range.start) });
});

saveUploads.delete("/:number/trainers/:player/upload", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, uploadAbort);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: "Not this player's upload" }, 400);
  await abortUpload(input.key, input.uploadId);
  return c.json({});
});

saveUploads.post("/:number/trainers/:player/file", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, saveUploadDone);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: "Not this player's upload" }, 400);
  const parts = [...input.parts].sort((a, b) => a.part - b.part);
  try {
    await completeUpload(input.key, input.uploadId, parts);
  } catch {
    await abortUpload(input.key, input.uploadId).catch(() => undefined);
    return c.json({ error: "The file store refused the uploaded parts" }, 400);
  }
  const size = await objectSize(input.key);
  if (size === undefined) return c.json({ error: "The upload did not reach the file store" }, 400);
  const names = (await milestoneNames(found.row.id)).map((m) => m.name);
  try {
    const file = await readObject(input.key);
    if (isExportKey(input.key)) {
      const { sheet, report } = parseExport(file);
      const answer: UploadedSave = { key: input.key, fileName: input.fileName, size, slots: [], export: { pokemon: sheet.pokemon.length, report } };
      return c.json(answer);
    }
    const slots = saveSlots(file).map((slot) => ({ ...slot, suggested: suggestMilestone(names, slot) }));
    const answer: UploadedSave = { key: input.key, fileName: input.fileName, size, slots, export: null };
    return c.json(answer);
  } catch (error) {
    await deleteObject(input.key).catch(() => undefined);
    const why = reason(error);
    if (why) return c.json({ error: why }, 400);
    throw error;
  }
});

saveUploads.post("/:number/trainers/:player/snapshots", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, snapshotRequest);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: "Not this player's upload" }, 400);
  const [chosen] = await db
    .select({ id: milestone.id, name: milestone.name })
    .from(milestone)
    .where(and(eq(milestone.seriesId, found.row.id), eq(milestone.name, input.milestone)));
  if (!chosen) return c.json({ error: "No such milestone" }, 400);
  if (isExportKey(input.key) !== (input.slot === null)) return c.json({ error: isExportKey(input.key) ? "An export has no slot" : "Pick a slot of the zip" }, 400);
  if ((await objectSize(input.key)) === undefined) return c.json({ error: "The upload is gone; upload the file again" }, 400);
  try {
    const done = await ingest({
      seriesId: found.row.id,
      userId: found.playerId,
      milestoneId: chosen.id,
      fileKey: input.key,
      fileName: input.fileName,
      slot: input.slot,
      uploadedBy: found.uploaderId,
    });
    const answer: SavedSnapshot = { milestone: chosen.name, ...done };
    return c.json(answer);
  } catch (error) {
    const why = reason(error);
    if (why) return c.json({ error: why }, 400);
    throw error;
  }
});

saveUploads.get("/:number/trainers/:player/snapshots/:milestone/zip", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: "Sign in first" }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: "No such series" }, 404);
  const playerId = c.req.param("player");
  if (!reader.admin && reader.id !== playerId) return c.json({ error: "Only the player and admins download a player's zip" }, 403);
  const [found] = await db
    .select({ rolledKey: snapshot.rolledKey, fileName: snapshot.fileName })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, row.id), eq(save.userId, playerId), eq(milestone.name, c.req.param("milestone"))));
  if (!found?.rolledKey) return c.json({ error: "No zip for this snapshot" }, 404);
  return c.json({ url: await downloadUrl(found.rolledKey, found.fileName) });
});
