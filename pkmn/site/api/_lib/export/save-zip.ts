import { ExportError, type Exported, exportSave, progressOf, readSave, sideFileName } from "./export.js";
import { readEntry, ZipError, type ZipEntry, zipEntries } from "./zip.js";

const SLOT = /^Partida (\d+)\.rxdata$/;

export type SaveSlot = { entry: string; name: string; savedAt: string; badges: number | null; hallOfFame: number | null };

function baseName(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1];
}

function folderOf(name: string): string {
  return name.slice(0, name.length - baseName(name).length);
}

function entriesOf(zip: Uint8Array): ZipEntry[] {
  try {
    return zipEntries(zip);
  } catch (error) {
    throw new ExportError(error instanceof ZipError ? `The file is ${error.message}.` : "The file is not a zip.");
  }
}

function slotEntries(entries: ZipEntry[]): ZipEntry[] {
  return entries
    .filter((entry) => !entry.name.endsWith("/") && SLOT.test(baseName(entry.name)))
    .sort((a, b) => {
      const folder = folderOf(a.name) < folderOf(b.name) ? -1 : folderOf(a.name) > folderOf(b.name) ? 1 : 0;
      if (folder !== 0) return folder;
      return Number(SLOT.exec(baseName(a.name))?.[1]) - Number(SLOT.exec(baseName(b.name))?.[1]);
    });
}

function read(zip: Uint8Array, entry: ZipEntry): Uint8Array {
  try {
    return readEntry(zip, entry);
  } catch (error) {
    throw new ExportError(error instanceof ZipError ? `The zip holds ${error.message}.` : `Could not unpack ${entry.name}.`);
  }
}

export function saveSlots(zip: Uint8Array): SaveSlot[] {
  const slots = slotEntries(entriesOf(zip));
  if (slots.length === 0) throw new ExportError("No Partida save in this zip");
  return slots.map((entry) => {
    let progress: { badges: number; hallOfFame: number } | null = null;
    try {
      progress = progressOf(readSave(read(zip, entry), entry.name));
    } catch {
      progress = null;
    }
    return {
      entry: entry.name,
      name: baseName(entry.name).replace(/\.rxdata$/, ""),
      savedAt: entry.modified,
      badges: progress?.badges ?? null,
      hallOfFame: progress?.hallOfFame ?? null,
    };
  });
}

export function exportZipSlot(zip: Uint8Array, slot: string): Exported {
  const entries = entriesOf(zip);
  const entry = slotEntries(entries).find((candidate) => candidate.name === slot);
  if (!entry) throw new ExportError(`${slot} is not a Partida save in this zip.`);
  const save = readSave(read(zip, entry), entry.name);
  const sideName = folderOf(entry.name) + sideFileName(save);
  const side = entries.find((candidate) => candidate.name === sideName);
  return exportSave(save, side ? read(zip, side) : null, sideName);
}
