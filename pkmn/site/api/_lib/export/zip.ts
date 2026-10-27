import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

export class ZipError extends Error {}

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
  modified: string;
  nameBytes: Uint8Array;
  flags: number;
  crc: number;
  time: number;
  date: number;
  madeBy: number;
  external: number;
};

export type NewEntry = { nameBytes: Uint8Array; utf8: boolean; data: Uint8Array };

const largestEntry = 256 * 1024 * 1024;

const utf8 = new TextDecoder("utf-8");

const latin1 = new TextDecoder("latin1");

function dosTime(date: number, time: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = 1980 + (date >> 9);
  return `${year}-${pad((date >> 5) & 15)}-${pad(date & 31)}T${pad(time >> 11)}:${pad((time >> 5) & 63)}:${pad((time & 31) * 2)}`;
}

function zip64(view: DataView, extraStart: number, extraEnd: number, entry: ZipEntry, needs: { size: boolean; compressed: boolean; offset: boolean }) {
  let at = extraStart;
  while (at + 4 <= extraEnd) {
    const id = view.getUint16(at, true);
    const length = view.getUint16(at + 2, true);
    if (id === 1) {
      let field = at + 4;
      const next = () => {
        const value = Number(view.getBigUint64(field, true));
        field += 8;
        return value;
      };
      if (needs.size) entry.size = next();
      if (needs.compressed) entry.compressedSize = next();
      if (needs.offset) entry.offset = next();
      return;
    }
    at += 4 + length;
  }
}

function endRecord(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) return at;
  }
  throw new ZipError("not a zip");
}

export type ZipDirectory = { start: number; size: number; count: number };

export type Zip64Locator = { record: number };

export function zipDirectory(tail: Uint8Array, tailStart: number, zip64Record?: Uint8Array): ZipDirectory | Zip64Locator {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  if (tail.byteLength < 22) throw new ZipError("not a zip");
  const end = endRecord(view);
  const directory = { count: view.getUint16(end + 10, true), size: view.getUint32(end + 12, true), start: view.getUint32(end + 16, true) };
  if ((directory.count === 0xffff || directory.start === 0xffffffff || directory.size === 0xffffffff) && end >= 20 && view.getUint32(end - 20, true) === 0x07064b50) {
    const record = Number(view.getBigUint64(end - 12, true));
    const local = record - tailStart;
    const bytes = zip64Record ?? (local >= 0 && local + 56 <= tail.byteLength ? tail.subarray(local, local + 56) : undefined);
    if (!bytes) return { record };
    const recordView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength >= 56 && recordView.getUint32(0, true) === 0x06064b50) {
      directory.count = Number(recordView.getBigUint64(32, true));
      directory.size = Number(recordView.getBigUint64(40, true));
      directory.start = Number(recordView.getBigUint64(48, true));
    }
  }
  return directory;
}

export function zipEntries(data: Uint8Array): ZipEntry[] {
  const directory = zipDirectory(data, 0);
  if ("record" in directory) throw new ZipError("a broken zip");
  return directoryEntries(data.subarray(directory.start), directory.count);
}

export function directoryEntries(data: Uint8Array, count: number): ZipEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const entries: ZipEntry[] = [];
  let at = 0;
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > data.byteLength || view.getUint32(at, true) !== 0x02014b50) throw new ZipError("a broken zip");
    const flags = view.getUint16(at + 8, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const nameBytes = data.subarray(at + 46, at + 46 + nameLength);
    const entry: ZipEntry = {
      name: (flags & 0x800 ? utf8 : latin1).decode(nameBytes),
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      offset: view.getUint32(at + 42, true),
      modified: dosTime(view.getUint16(at + 14, true), view.getUint16(at + 12, true)),
      nameBytes,
      flags,
      crc: view.getUint32(at + 16, true),
      time: view.getUint16(at + 12, true),
      date: view.getUint16(at + 14, true),
      madeBy: view.getUint16(at + 4, true),
      external: view.getUint32(at + 38, true),
    };
    zip64(view, at + 46 + nameLength, at + 46 + nameLength + extraLength, entry, {
      size: entry.size === 0xffffffff,
      compressed: entry.compressedSize === 0xffffffff,
      offset: entry.offset === 0xffffffff,
    });
    entries.push(entry);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function storedBytes(data: Uint8Array, entry: ZipEntry, dataStart = 0): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const offset = entry.offset - dataStart;
  if (offset < 0 || offset + 30 > data.byteLength || view.getUint32(offset, true) !== 0x04034b50) throw new ZipError(`a broken entry ${entry.name}`);
  const begin = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
  const stored = data.subarray(begin, begin + entry.compressedSize);
  if (stored.length !== entry.compressedSize) throw new ZipError(`a broken entry ${entry.name}`);
  return stored;
}

export function readEntry(data: Uint8Array, entry: ZipEntry, dataStart = 0): Uint8Array {
  const stored = storedBytes(data, entry, dataStart);
  if (entry.method === 0) return stored;
  if (entry.method !== 8) throw new ZipError(`${entry.name} is compressed in a way the site cannot read`);
  try {
    return inflateRawSync(stored, { maxOutputLength: largestEntry });
  } catch {
    throw new ZipError(`a broken entry ${entry.name}`);
  }
}

type Written = {
  nameBytes: Uint8Array;
  flags: number;
  method: number;
  time: number;
  date: number;
  crc: number;
  compressedSize: number;
  size: number;
  madeBy: number;
  external: number;
  stored: Uint8Array;
};

function dosNow(): { time: number; date: number } {
  const now = new Date();
  return {
    time: (now.getUTCHours() << 11) | (now.getUTCMinutes() << 5) | Math.floor(now.getUTCSeconds() / 2),
    date: ((now.getUTCFullYear() - 1980) << 9) | ((now.getUTCMonth() + 1) << 5) | now.getUTCDate(),
  };
}

function written(entry: NewEntry, like: ZipEntry | undefined): Written {
  const stored = deflateRawSync(entry.data);
  const { time, date } = dosNow();
  return {
    nameBytes: entry.nameBytes,
    flags: entry.utf8 ? 0x800 : 0,
    method: 8,
    time,
    date,
    crc: crc32(entry.data),
    compressedSize: stored.length,
    size: entry.data.length,
    madeBy: like?.madeBy ?? 20,
    external: like?.external ?? 0,
    stored,
  };
}

function sameName(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

export function replaceEntry(data: Uint8Array, entries: ZipEntry[], replacement: NewEntry): Uint8Array {
  const kept: Written[] = [];
  let replaced = false;
  for (const entry of entries) {
    if (sameName(entry.nameBytes, replacement.nameBytes)) {
      kept.push(written(replacement, entry));
      replaced = true;
      continue;
    }
    kept.push({ ...entry, flags: entry.flags & 0x806, stored: storedBytes(data, entry) });
  }
  if (!replaced) kept.push(written(replacement, undefined));
  if (kept.length > 0xffff) throw new ZipError("too many files to write back");
  const total = kept.reduce((sum, entry) => sum + 76 + 2 * entry.nameBytes.length + entry.stored.length, 22);
  if (total > 0xffffffff) throw new ZipError("too large to write back");
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let at = 0;
  const offsets: number[] = [];
  for (const entry of kept) {
    offsets.push(at);
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, entry.flags, true);
    view.setUint16(at + 8, entry.method, true);
    view.setUint16(at + 10, entry.time, true);
    view.setUint16(at + 12, entry.date, true);
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.compressedSize, true);
    view.setUint32(at + 22, entry.size, true);
    view.setUint16(at + 26, entry.nameBytes.length, true);
    view.setUint16(at + 28, 0, true);
    out.set(entry.nameBytes, at + 30);
    out.set(entry.stored, at + 30 + entry.nameBytes.length);
    at += 30 + entry.nameBytes.length + entry.stored.length;
  }
  const directory = at;
  kept.forEach((entry, i) => {
    view.setUint32(at, 0x02014b50, true);
    view.setUint16(at + 4, entry.madeBy, true);
    view.setUint16(at + 6, 20, true);
    view.setUint16(at + 8, entry.flags, true);
    view.setUint16(at + 10, entry.method, true);
    view.setUint16(at + 12, entry.time, true);
    view.setUint16(at + 14, entry.date, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.compressedSize, true);
    view.setUint32(at + 24, entry.size, true);
    view.setUint16(at + 28, entry.nameBytes.length, true);
    view.setUint32(at + 38, entry.external, true);
    view.setUint32(at + 42, offsets[i], true);
    out.set(entry.nameBytes, at + 46);
    at += 46 + entry.nameBytes.length;
  });
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, kept.length, true);
  view.setUint16(at + 10, kept.length, true);
  view.setUint32(at + 12, at - directory, true);
  view.setUint32(at + 16, directory, true);
  return out;
}
