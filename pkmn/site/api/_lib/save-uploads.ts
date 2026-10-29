import { and, eq } from "drizzle-orm";
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
import { findShown, mayUpload, milestonesOf, plays, type SeriesRow, viewer } from "./series-data.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    signIn: "Sign in first",
    noSeries: "No such series",
    notPlayer: "Not a player of this series",
    cannotUpload: "You cannot upload for this player",
    uploadSave: "Upload a .zip save or a .json export",
    exportMax: "An export is at most 10 MB",
    zipMax: "A save zip is at most 100 MB",
    notPlayerUpload: "Not this player's upload",
    noPart: "No such part",
    refusedParts: "The file store refused the uploaded parts",
    noReach: "The upload did not reach the file store",
    noMilestone: "No such milestone",
    uploadGone: "The upload is gone; upload the file again",
    zipDownload: "Only the player and admins download a player's zip",
    noZip: "No zip for this snapshot",
    exportNoSlot: "An export has no slot",
    pickSlot: "Pick a slot of the zip",
  },
  es: {
    signIn: "Inicia sesión primero",
    noSeries: "Esa serie no existe",
    notPlayer: "No es jugador de esta serie",
    cannotUpload: "No puedes subir la partida de este jugador",
    uploadSave: "Sube una partida .zip o una exportación .json",
    exportMax: "Una exportación pesa como máximo 10 MB",
    zipMax: "Un zip de partida pesa como máximo 100 MB",
    notPlayerUpload: "Esa subida no es de este jugador",
    noPart: "Esa parte no existe",
    refusedParts: "El almacén de archivos rechazó las partes subidas",
    noReach: "La subida no llegó al almacén de archivos",
    noMilestone: "Ese hito no existe",
    uploadGone: "La subida ya no está; sube el archivo otra vez",
    zipDownload: "Solo el jugador y los administradores descargan el zip de un jugador",
    noZip: "Esta captura no tiene zip",
    exportNoSlot: "Una exportación no tiene partida",
    pickSlot: "Elige una partida del zip",
  },
});

const staleMs = 60 * 60 * 1000;

type Target = { row: SeriesRow; playerId: string; uploaderId: string; prefix: string };

async function target(c: Context): Promise<Target | Response> {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number") ?? "", !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const playerId = c.req.param("player") ?? "";
  if (!(await plays(row.id, playerId))) return c.json({ error: t(c).notPlayer }, 404);
  if (!mayUpload(reader, row, playerId)) return c.json({ error: t(c).cannotUpload }, 403);
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

function reason(c: Context, error: unknown): string | undefined {
  return error instanceof ExportError ? says(error.texts)(c) : undefined;
}

export const saveUploads = new Hono();

saveUploads.post("/:number/trainers/:player/upload", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, saveUploadRequest);
  if (!input) return c.json({ error: t(c).uploadSave }, 400);
  const json = isExportName(input.fileName);
  if (json && input.size > largestExport) return c.json({ error: t(c).exportMax }, 400);
  if (!json && input.size > largestSaveZip) return c.json({ error: t(c).zipMax }, 400);
  await abortUploadsUnder(found.prefix).catch(() => undefined);
  await clearStale(found.prefix).catch(() => undefined);
  const key = `${found.prefix}${crypto.randomUUID()}.${json ? "json" : "zip"}`;
  return c.json({ key, uploadId: await startUpload(key), partSize: partSizeFor(input.size) });
});

saveUploads.post("/:number/trainers/:player/upload/part", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, partRequest);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: t(c).notPlayerUpload }, 400);
  const range = partRange(input.size, partSizeFor(input.size), input.part);
  if (!range) return c.json({ error: t(c).noPart }, 400);
  return c.json({ url: await partUrl(input.key, input.uploadId, input.part, range.end - range.start) });
});

saveUploads.delete("/:number/trainers/:player/upload", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, uploadAbort);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: t(c).notPlayerUpload }, 400);
  await abortUpload(input.key, input.uploadId);
  return c.json({});
});

saveUploads.post("/:number/trainers/:player/file", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, saveUploadDone);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: t(c).notPlayerUpload }, 400);
  const parts = [...input.parts].sort((a, b) => a.part - b.part);
  try {
    await completeUpload(input.key, input.uploadId, parts);
  } catch {
    await abortUpload(input.key, input.uploadId).catch(() => undefined);
    return c.json({ error: t(c).refusedParts }, 400);
  }
  const size = await objectSize(input.key);
  if (size === undefined) return c.json({ error: t(c).noReach }, 400);
  const milestones = await milestonesOf(found.row.id);
  try {
    const file = await readObject(input.key);
    if (isExportKey(input.key)) {
      const { sheet, report } = parseExport(file);
      const answer: UploadedSave = { key: input.key, fileName: input.fileName, size, slots: [], export: { pokemon: sheet.pokemon.length, report } };
      return c.json(answer);
    }
    const slots = saveSlots(file).map((slot) => ({ ...slot, suggested: suggestMilestone(milestones, slot) }));
    const answer: UploadedSave = { key: input.key, fileName: input.fileName, size, slots, export: null };
    return c.json(answer);
  } catch (error) {
    await deleteObject(input.key).catch(() => undefined);
    const why = reason(c, error);
    if (why) return c.json({ error: why }, 400);
    throw error;
  }
});

saveUploads.post("/:number/trainers/:player/snapshots", async (c) => {
  const found = await target(c);
  if (found instanceof Response) return found;
  const input = await body(c.req.raw, snapshotRequest);
  if (!input || !input.key.startsWith(found.prefix)) return c.json({ error: t(c).notPlayerUpload }, 400);
  const [chosen] = await db
    .select({ id: milestone.id, name: milestone.name })
    .from(milestone)
    .where(and(eq(milestone.seriesId, found.row.id), eq(milestone.name, input.milestone)));
  if (!chosen) return c.json({ error: t(c).noMilestone }, 400);
  if (isExportKey(input.key) !== (input.slot === null)) return c.json({ error: isExportKey(input.key) ? t(c).exportNoSlot : t(c).pickSlot }, 400);
  if ((await objectSize(input.key)) === undefined) return c.json({ error: t(c).uploadGone }, 400);
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
    const why = reason(c, error);
    if (why) return c.json({ error: why }, 400);
    throw error;
  }
});

saveUploads.get("/:number/trainers/:player/snapshots/:milestone/zip", async (c) => {
  const reader = await viewer(c.req.raw);
  if (!reader) return c.json({ error: t(c).signIn }, 401);
  const row = await findShown(c.req.param("number"), !!reader.admin);
  if (!row) return c.json({ error: t(c).noSeries }, 404);
  const playerId = c.req.param("player");
  if (!reader.admin && reader.id !== playerId) return c.json({ error: t(c).zipDownload }, 403);
  const [found] = await db
    .select({ rolledKey: snapshot.rolledKey, fileName: snapshot.fileName })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, row.id), eq(save.userId, playerId), eq(milestone.name, c.req.param("milestone"))));
  if (!found?.rolledKey) return c.json({ error: t(c).noZip }, 404);
  return c.json({ url: await downloadUrl(found.rolledKey, found.fileName) });
});
