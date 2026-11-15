export const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof imageTypes)[number];

export const maxImageBytes = 4 * 1024 * 1024;

export type ImageFacts = { type: ImageType; width: number; height: number };

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));

function png(bytes: Uint8Array, view: DataView): ImageFacts | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || ascii(bytes, 1, 7) !== "PNG\r\n\x1a\n" || ascii(bytes, 12, 4) !== "IHDR") return null;
  return { type: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
}

function jpeg(bytes: Uint8Array, view: DataView): ImageFacts | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { type: "image/jpeg", width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    offset += 2 + length;
  }
  return null;
}

function webp(bytes: Uint8Array, view: DataView): ImageFacts | null {
  if (bytes.length < 31 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") return { type: "image/webp", width: 1 + (view.getUint32(24, true) & 0xffffff), height: 1 + (view.getUint32(27, true) & 0xffffff) };
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return { type: "image/webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === "VP8 ") return { type: "image/webp", width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  return null;
}

export function imageFacts(bytes: Uint8Array): ImageFacts | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const facts = png(bytes, view) ?? jpeg(bytes, view) ?? webp(bytes, view);
  return facts && facts.width > 0 && facts.height > 0 ? facts : null;
}

export const imagePath = (digest: string) => `/api/images/${digest}`;
