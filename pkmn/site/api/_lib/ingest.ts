import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { exportZipSlot } from "./export/save-zip.js";
import { deleteObject, readObject } from "./files.js";
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

export type Ingested = { pokemon: number; fainted: number; replaced: boolean };

export function savePrefix(seriesId: string, userId: string): string {
  return `saves/${seriesId}/${userId}/`;
}

async function saveFor(seriesId: string, userId: string): Promise<string> {
  await db.insert(save).values({ id: crypto.randomUUID(), seriesId, userId }).onConflictDoNothing({ target: [save.seriesId, save.userId] });
  const [row] = await db
    .select({ id: save.id })
    .from(save)
    .where(and(eq(save.seriesId, seriesId), eq(save.userId, userId)));
  if (!row) throw new Error("The save could not be stored");
  return row.id;
}

export async function ingest(raw: RawSave): Promise<Ingested> {
  const zip = await readObject(raw.fileKey);
  const { snapshot: data } = exportZipSlot(zip, raw.slot);
  const saveId = await saveFor(raw.seriesId, raw.userId);
  const values = {
    fileKey: raw.fileKey,
    fileName: raw.fileName,
    fileSize: zip.length,
    slot: raw.slot,
    data,
    pokemon: data.pokemon.length,
    fainted: data.fainted.length,
    uploadedBy: raw.uploadedBy,
    takenAt: new Date(),
  };
  const previous = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: snapshot.id, fileKey: snapshot.fileKey })
      .from(snapshot)
      .where(and(eq(snapshot.saveId, saveId), eq(snapshot.milestoneId, raw.milestoneId)))
      .for("update");
    await tx
      .insert(snapshot)
      .values({ id: crypto.randomUUID(), saveId, milestoneId: raw.milestoneId, ...values })
      .onConflictDoUpdate({ target: [snapshot.saveId, snapshot.milestoneId], set: values });
    return existing;
  });
  if (previous && previous.fileKey !== raw.fileKey) {
    const stillUsed = await db.select({ id: snapshot.id }).from(snapshot).where(eq(snapshot.fileKey, previous.fileKey));
    if (stillUsed.length === 0) await deleteObject(previous.fileKey).catch(() => undefined);
  }
  return { pokemon: values.pokemon, fainted: values.fainted, replaced: previous !== undefined };
}
