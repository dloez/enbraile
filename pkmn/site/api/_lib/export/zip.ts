import { inflateRawSync } from "node:zlib";

export class ZipError extends Error {}

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
  modified: string;
};

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

export function zipEntries(data: Uint8Array): ZipEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.byteLength < 22) throw new ZipError("not a zip");
  const end = endRecord(view);
  let count = view.getUint16(end + 10, true);
  let start = view.getUint32(end + 16, true);
  if ((count === 0xffff || start === 0xffffffff) && end >= 20 && view.getUint32(end - 20, true) === 0x07064b50) {
    const record = Number(view.getBigUint64(end - 12, true));
    if (record + 56 <= data.byteLength && view.getUint32(record, true) === 0x06064b50) {
      count = Number(view.getBigUint64(record + 32, true));
      start = Number(view.getBigUint64(record + 48, true));
    }
  }
  const entries: ZipEntry[] = [];
  let at = start;
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

export function readEntry(data: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (entry.offset + 30 > data.byteLength || view.getUint32(entry.offset, true) !== 0x04034b50) throw new ZipError(`a broken entry ${entry.name}`);
  const begin = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const stored = data.subarray(begin, begin + entry.compressedSize);
  if (stored.length !== entry.compressedSize) throw new ZipError(`a broken entry ${entry.name}`);
  if (entry.method === 0) return stored;
  if (entry.method !== 8) throw new ZipError(`${entry.name} is compressed in a way the site cannot read`);
  try {
    return inflateRawSync(stored, { maxOutputLength: largestEntry });
  } catch {
    throw new ZipError(`a broken entry ${entry.name}`);
  }
}
