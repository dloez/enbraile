import { and, eq, isNotNull, or } from "drizzle-orm";
import { EXPORT_REFUSALS, type ExportReport, readExport, type Sheet, type Snapshot } from "../../shared/snapshot.js";
import { db } from "./db.js";
import { ExportError, itemFromShowdown, type TmRolls, type World } from "./export/export.js";
import { exportZipSlot } from "./export/save-zip.js";
import { deleteObject, putObject, readObject } from "./files.js";
import { save, seriesPlayer, snapshot } from "./schema.js";

export type RawSave = {
  seriesId: string;
  userId: string;
  milestoneId: string;
  fileKey: string;
  fileName: string;
  slot: string | null;
  uploadedBy: string | null;
};

export type Ingested = {
  pokemon: number;
  fainted: number;
  replaced: boolean;
  rolled: number | null;
  sideFile: string | null;
  missing: ExportReport | null;
};

export function isExportKey(key: string): boolean {
  return key.endsWith(".json");
}

export function parseExport(file: Uint8Array): { sheet: Sheet; report: ExportReport } {
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file));
  } catch {
    throw new ExportError({ en: "This file is not JSON", es: "Este archivo no es JSON" });
  }
  const read = readExport(data, itemFromShowdown);
  if ("refused" in read) throw new ExportError({ en: EXPORT_REFUSALS.en[read.refused], es: EXPORT_REFUSALS.es[read.refused] });
  return read;
}

function fromExport(sheet: Sheet): Snapshot {
  return {
    ...sheet,
    fainted: [],
    bag: [],
    trainer: { name: null, id: null, publicId: null, money: null, badges: [] },
    playTime: null,
    pokedex: { seen: null, owned: null },
    records: { trainerBattlesWon: null, trainerBattlesLost: null, wildBattlesWon: null, wildBattlesLost: null, blackouts: null },
    hallOfFame: null,
    usedEncounters: [],
    saveSlot: null,
    randomlockeVersion: null,
    notices: [],
  };
}

type Read = { data: Snapshot; world: World | null; tmRolls: TmRolls | null; rolledKey: string | null; rolled: number | null; sideFile: string | null; missing: ExportReport | null };

async function read(raw: RawSave, file: Uint8Array): Promise<Read> {
  if (isExportKey(raw.fileKey)) {
    const { sheet, report } = parseExport(file);
    return { data: fromExport(sheet), world: null, tmRolls: null, rolledKey: null, rolled: null, sideFile: null, missing: report };
  }
  if (!raw.slot) throw new ExportError({ en: "Pick a slot of the zip", es: "Elige una partida del zip" });
  const exported = exportZipSlot(file, raw.slot, await keptRolls(raw.fileKey, raw.slot));
  const rolledKey = `${savePrefix(raw.seriesId, raw.userId)}${crypto.randomUUID()}-rolled.zip`;
  await putObject(rolledKey, exported.rolledZip);
  return { data: exported.snapshot, world: exported.world, tmRolls: exported.tmRolls, rolledKey, rolled: exported.rolled, sideFile: exported.sideFile, missing: null };
}

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
  const file = await readObject(raw.fileKey);
  const { data, world, tmRolls, rolledKey, rolled, sideFile, missing } = await read(raw, file);
  const saveId = await saveFor(raw.seriesId, raw.userId);
  const values = {
    fileKey: raw.fileKey,
    fileName: raw.fileName,
    fileSize: file.length,
    slot: isExportKey(raw.fileKey) ? null : raw.slot,
    data,
    world,
    tmRolls,
    rolledKey,
    missing,
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
      await tx
        .update(seriesPlayer)
        .set({ needsSave: false })
        .where(and(eq(seriesPlayer.seriesId, raw.seriesId), eq(seriesPlayer.userId, raw.userId), eq(seriesPlayer.needsSave, true)));
      return existing;
    });
  } catch (error) {
    if (rolledKey) await deleteObject(rolledKey).catch(() => undefined);
    throw error;
  }
  if (previous && previous.fileKey !== raw.fileKey) await dropIfUnused(previous.fileKey);
  await dropIfUnused(previous?.rolledKey);
  return {
    pokemon: values.pokemon,
    fainted: values.fainted,
    replaced: previous !== undefined,
    rolled,
    sideFile,
    missing,
  };
}
