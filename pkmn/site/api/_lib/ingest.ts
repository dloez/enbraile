import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "./db.js";
import { exportZipSlot } from "./export/save-zip.js";
import { deleteObject, putObject, readObject } from "./files.js";
import { save, snapshot } from "./schema.js";

export type RawSave = {
  seriesId: string;
  userId: string;
  milestoneId: string;
  fileKey: string;
  fileName: string;
  slot: string;
  uploadedBy: string | null;
};

export type Ingested = { pokemon: number; fainted: number; replaced: boolean; rolled: number; sideFile: string };

export function savePrefix(seriesId: string, userId: string): string {
  return `saves/${seriesId}/${userId}/`;
}

export async function saveFor(seriesId: string, userId: string): Promise<string> {
  await db.insert(save).values({ id: crypto.randomUUID(), seriesId, userId }).onConflictDoNothing({ target: [save.seriesId, save.userId] });
  const [row] = await db
    .select({ id: save.id })
    .from(save)
    .where(and(eq(save.seriesId, seriesId), eq(save.userId, userId)));
  if (!row) throw new Error("The save could not be stored");
  return row.id;
}

async function keptRolls(fileKey: string, slot: string) {
  const [row] = await db
    .select({ tmRolls: snapshot.tmRolls })
    .from(snapshot)
    .where(and(eq(snapshot.fileKey, fileKey), eq(snapshot.slot, slot), isNotNull(snapshot.tmRolls)))
    .limit(1);
  return row?.tmRolls ?? null;
}

export async function stillUsed(key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: snapshot.id })
    .from(snapshot)
    .where(or(eq(snapshot.fileKey, key), eq(snapshot.rolledKey, key)))
    .limit(1);
  return row !== undefined;
}

export async function dropIfUnused(key: string | null | undefined) {
  if (key && !(await stillUsed(key))) await deleteObject(key).catch(() => undefined);
}

export async function ingest(raw: RawSave): Promise<Ingested> {
  const zip = await readObject(raw.fileKey);
  const exported = exportZipSlot(zip, raw.slot, await keptRolls(raw.fileKey, raw.slot));
  const data = exported.snapshot;
  const saveId = await saveFor(raw.seriesId, raw.userId);
  const rolledKey = `${savePrefix(raw.seriesId, raw.userId)}${crypto.randomUUID()}-rolled.zip`;
  await putObject(rolledKey, exported.rolledZip);
  const values = {
    fileKey: raw.fileKey,
    fileName: raw.fileName,
    fileSize: zip.length,
    slot: raw.slot,
    data,
    tmRolls: exported.tmRolls,
    rolledKey,
    pokemon: data.pokemon.length,
    fainted: data.fainted.length,
    uploadedBy: raw.uploadedBy,
    movedBy: null,
    movedAt: null,
    takenAt: new Date(),
  };
  let previous: { fileKey: string; rolledKey: string | null } | undefined;
  try {
    previous = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ fileKey: snapshot.fileKey, rolledKey: snapshot.rolledKey })
        .from(snapshot)
        .where(and(eq(snapshot.saveId, saveId), eq(snapshot.milestoneId, raw.milestoneId)))
        .for("update");
      await tx
        .insert(snapshot)
        .values({ id: crypto.randomUUID(), saveId, milestoneId: raw.milestoneId, ...values })
        .onConflictDoUpdate({ target: [snapshot.saveId, snapshot.milestoneId], set: values });
      return existing;
    });
  } catch (error) {
    await deleteObject(rolledKey).catch(() => undefined);
    throw error;
  }
  if (previous && previous.fileKey !== raw.fileKey) await dropIfUnused(previous.fileKey);
  await dropIfUnused(previous?.rolledKey);
  return {
    pokemon: values.pokemon,
    fainted: values.fainted,
    replaced: previous !== undefined,
    rolled: exported.rolled,
    sideFile: exported.sideFile,
  };
}
