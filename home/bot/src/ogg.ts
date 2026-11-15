const table = Array.from({ length: 256 }, (_, index) => {
  let value = index << 24;
  for (let bit = 0; bit < 8; bit++) value = value & 0x80000000 ? (value << 1) ^ 0x04c11db7 : value << 1;
  return value >>> 0;
});

function crc(bytes: Buffer): number {
  let value = 0;
  for (const byte of bytes) value = ((value << 8) ^ table[((value >>> 24) ^ byte) & 0xff]!) >>> 0;
  return value;
}

export function oggOpus(packets: Buffer[]): Buffer {
  const serial = Math.floor(Math.random() * 2 ** 31);
  const pages: Buffer[] = [];
  const page = (data: Buffer, flags: number, granule: number, sequence: number) => {
    const lacing: number[] = [];
    let left = data.length;
    while (left >= 255) {
      lacing.push(255);
      left -= 255;
    }
    lacing.push(left);
    const header = Buffer.alloc(27 + lacing.length);
    header.write("OggS", 0);
    header[5] = flags;
    header.writeBigInt64LE(BigInt(granule), 6);
    header.writeUInt32LE(serial, 14);
    header.writeUInt32LE(sequence, 18);
    header[26] = lacing.length;
    Buffer.from(lacing).copy(header, 27);
    const whole = Buffer.concat([header, data]);
    whole.writeUInt32LE(crc(whole), 22);
    pages.push(whole);
  };
  const head = Buffer.alloc(19);
  head.write("OpusHead", 0);
  head[8] = 1;
  head[9] = 2;
  head.writeUInt32LE(48000, 12);
  page(head, 2, 0, 0);
  const tags = Buffer.alloc(16);
  tags.write("OpusTags", 0);
  tags.writeUInt32LE(4, 8);
  tags.write("bot!", 12);
  page(tags, 0, 0, 1);
  packets.forEach((packet, index) => page(packet, index === packets.length - 1 ? 4 : 0, (index + 1) * 960, index + 2));
  return Buffer.concat(pages);
}
