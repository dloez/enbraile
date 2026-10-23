import { crc32 } from "node:zlib";
import { eq } from "drizzle-orm";
import { db, pool } from "../api/_lib/db.js";
import { requireEnv } from "../api/_lib/env.js";
import { abortUpload, completeUpload, partUrl, startUpload } from "../api/_lib/files.js";
import { game } from "../api/_lib/schema.js";
import { partSizeFor, uploadParts } from "../shared/upload.js";
import { createAdmin, createTestPlayer, usernameTaken } from "./accounts.js";

const admin = { name: "admin", password: "admin-password" };
const testPlayers = [
  { name: "Red", allowed: true },
  { name: "Blue", allowed: true },
  { name: "Leaf", allowed: false },
];
const seedGame = { name: "Pokémon Añil + Randomlocke", fileName: "anil-stand-in.zip" };

function standInZip(): Uint8Array {
  const name = Buffer.from("stand-in.txt");
  const data = Buffer.from("A stand-in for the game's files on the local stack.\n");
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const centralOffset = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

async function uploadZip(key: string, zip: Uint8Array) {
  const uploadId = await startUpload(key);
  try {
    const parts = await uploadParts(zip.length, partSizeFor(zip.length), async (part, start, end, _onProgress, signal) => {
      const response = await fetch(await partUrl(key, uploadId, part, end - start), {
        method: "PUT",
        body: zip.subarray(start, end),
        signal,
      });
      const etag = response.headers.get("etag");
      if (!response.ok || !etag) throw new Error(`The file store refused part ${part} (${response.status})`);
      return etag;
    });
    await completeUpload(key, uploadId, parts);
  } catch (error) {
    await abortUpload(key, uploadId).catch(() => undefined);
    throw error;
  }
}

async function seedTheGame() {
  const [existing] = await db.select({ id: game.id }).from(game).where(eq(game.name, seedGame.name));
  if (existing) return;
  const id = crypto.randomUUID();
  const key = `games/${id}/${crypto.randomUUID()}.zip`;
  const zip = standInZip();
  await uploadZip(key, zip);
  await db.insert(game).values({
    id,
    name: seedGame.name,
    fileKey: key,
    fileName: seedGame.fileName,
    fileSize: zip.length,
    uploadedAt: new Date(),
  });
}

async function main() {
  for (const variable of ["DATABASE_URL", "S3_ENDPOINT"]) {
    const host = new URL(requireEnv(variable)).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`Refusing to seed ${host}: the seed is for the local stack only`);
  }

  if (!(await usernameTaken(admin.name))) await createAdmin(admin.name, admin.password);
  for (const { name, allowed } of testPlayers) {
    if (!(await usernameTaken(name.toLowerCase()))) await createTestPlayer(name, allowed);
  }
  await seedTheGame();
  console.log(
    `Seeded admin ${admin.name} (password ${admin.password}), test players ${testPlayers.map(({ name, allowed }) => (allowed ? name : `${name} (waiting)`)).join(", ")} and the game ${seedGame.name} with a stand-in zip`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
