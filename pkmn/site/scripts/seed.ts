import { readFile } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../api/_lib/db.js";
import { requireEnv } from "../api/_lib/env.js";
import { abortUpload, completeUpload, partUrl, startUpload } from "../api/_lib/files.js";
import { game, milestone, series, seriesPlayer, user } from "../api/_lib/schema.js";
import type { MilestoneMark } from "../shared/series.js";
import { partSizeFor, uploadParts } from "../shared/upload.js";
import { createAdmin, createTestPlayer, usernameTaken } from "./accounts.js";

const admin = { name: "admin", password: "admin-password" };
const testPlayers = [
  { name: "Red", allowed: true },
  { name: "Blue", allowed: true },
  { name: "Leaf", allowed: false },
];
const seedGame = { name: "Pokémon Añil + Randomlocke", fileName: "anil-stand-in.zip" };
const seedSeries = {
  number: 1,
  name: "Series 1",
  players: ["Red", "Blue"],
  rules: new URL("../../../docs/pkmn/series/1/reference/rules.md", import.meta.url),
  milestones: [
    ["Gym 1", "round"],
    ["Gym 2", "round"],
    ["Gym 3", "round"],
    ["Gym 4", "none"],
    ["Gym 5", "round"],
    ["Gym 6", "none"],
    ["Gym 7", "round"],
    ["Gym 8", "none"],
    ["Post-League", "none"],
    ["Tournament", "tournament"],
  ] satisfies [string, MilestoneMark][],
};

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

async function seedTheSeries() {
  const [existing] = await db.select({ id: series.id }).from(series).where(eq(series.number, seedSeries.number));
  if (existing) return;
  const [seeded] = await db.select({ id: game.id }).from(game).where(eq(game.name, seedGame.name));
  if (!seeded) throw new Error(`The game ${seedGame.name} is missing`);
  const players = await db.select({ id: user.id }).from(user).where(inArray(user.username, seedSeries.players.map((name) => name.toLowerCase())));
  const rules = await readFile(seedSeries.rules, "utf8");
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(series).values({
      id,
      number: seedSeries.number,
      name: seedSeries.name,
      gameId: seeded.id,
      scene: "route",
      ingestion: "manual",
      rules,
      state: "running",
      startedAt: new Date(),
    });
    await tx.insert(seriesPlayer).values(players.map((p) => ({ seriesId: id, userId: p.id })));
    await tx.insert(milestone).values(
      seedSeries.milestones.map(([name, mark], position) => ({ id: crypto.randomUUID(), seriesId: id, position, name, mark })),
    );
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
  await seedTheSeries();
  console.log(
    `Seeded admin ${admin.name} (password ${admin.password}), test players ${testPlayers.map(({ name, allowed }) => (allowed ? name : `${name} (waiting)`)).join(", ")}, the game ${seedGame.name} with a stand-in zip, and ${seedSeries.name} running on it with ${seedSeries.players.join(" and ")}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
