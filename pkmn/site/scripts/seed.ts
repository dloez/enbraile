import { readdir, readFile } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { Dex } from "@pkmn/dex";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "../api/_lib/db.js";
import { requireEnv } from "../api/_lib/env.js";
import { saveSlots } from "../api/_lib/export/save-zip.js";
import { abortUpload, completeUpload, partUrl, startUpload } from "../api/_lib/files.js";
import { ingest, savePrefix } from "../api/_lib/ingest.js";
import { game, milestone, save, series, seriesPlayer, snapshot, team, teamSource, user } from "../api/_lib/schema.js";
import { DEFAULT_POOL } from "../shared/pool.js";
import { suggestMilestone } from "../shared/save-upload.js";
import type { MilestoneMark } from "../shared/series.js";
import type { Snapshot } from "../shared/snapshot.js";
import { emptySlots, MOVE_SLOTS } from "../shared/team.js";
import { partSizeFor, uploadParts } from "../shared/upload.js";
import { createAdmin, createTestPlayer, usernameTaken } from "./accounts.js";

const admin = { name: "admin", password: "admin-password" };
const previewBucket = "pkmn-site-preview-enbraile";
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
const finishedSeries = { number: 2, name: "Series 2", players: ["Red", "Blue"], milestone: "Tournament", extraPlayTime: 7200 };

const seedSnapshot = { player: "Red", saves: new URL("../saves/", import.meta.url), fallback: "Post-League" };

const seedTeam = { name: "Seed team", members: 3 };

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
      pool: DEFAULT_POOL,
      state: "running",
      startedAt: new Date(),
    });
    await tx.insert(seriesPlayer).values(players.map((p) => ({ seriesId: id, userId: p.id })));
    await tx.insert(milestone).values(
      seedSeries.milestones.map(([name, mark], position) => ({ id: crypto.randomUUID(), seriesId: id, position, name, mark })),
    );
  });
}

async function seedTheSnapshot(): Promise<string | null> {
  const zips = (await readdir(seedSnapshot.saves).catch(() => [])).filter((name) => name.toLowerCase().endsWith(".zip")).sort();
  if (zips.length === 0) return null;
  const [row] = await db.select({ id: series.id }).from(series).where(eq(series.number, seedSeries.number));
  const [player] = await db.select({ id: user.id }).from(user).where(eq(user.username, seedSnapshot.player.toLowerCase()));
  if (!row || !player) throw new Error(`${seedSeries.name} or ${seedSnapshot.player} is missing`);
  const [taken] = await db
    .select({ id: snapshot.id })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .where(and(eq(save.seriesId, row.id), eq(save.userId, player.id)));
  if (taken) return null;
  const fileName = zips[0];
  const zip = await readFile(new URL(encodeURIComponent(fileName), seedSnapshot.saves));
  const [slot] = saveSlots(zip);
  const milestones = await db.select({ id: milestone.id, name: milestone.name }).from(milestone).where(eq(milestone.seriesId, row.id)).orderBy(asc(milestone.position));
  const name = suggestMilestone(milestones.map((m) => m.name), slot) ?? seedSnapshot.fallback;
  const chosen = milestones.find((m) => m.name === name);
  if (!chosen) throw new Error(`${seedSeries.name} has no milestone ${name}`);
  const key = `${savePrefix(row.id, player.id)}${crypto.randomUUID()}.zip`;
  await uploadZip(key, zip);
  const done = await ingest({ seriesId: row.id, userId: player.id, milestoneId: chosen.id, fileKey: key, fileName, slot: slot.entry, uploadedBy: null });
  const seeded = `${seedSnapshot.player}'s ${chosen.name} snapshot from ${fileName} (${done.pokemon} Pokémon, ${done.fainted} fainted)`;
  const earlier = milestones[milestones.indexOf(chosen) - 1];
  const before = earlier ? await seedTheEarlierSnapshot(row.id, player.id, chosen.id, earlier.id) : null;
  return before ? `${seeded}, and a ${earlier!.name} one before it with ${before} still alive` : seeded;
}

async function seedTheEarlierSnapshot(seriesId: string, userId: string, laterId: string, milestoneId: string): Promise<string | null> {
  const [later] = await db
    .select()
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .where(and(eq(save.seriesId, seriesId), eq(save.userId, userId), eq(snapshot.milestoneId, laterId)));
  if (!later) return null;
  const data = structuredClone(later.snapshot.data);
  const index = data.fainted.findLastIndex((m) => m.personalId !== null && m.species !== null && Dex.species.get(m.species).exists);
  if (index < 0) return null;
  const [member] = data.fainted.splice(index, 1);
  if (!member?.species) return null;
  const species = Dex.species.get(member.species);
  data.pokemon.push({
    species: member.species,
    nickname: member.nickname,
    gender: null,
    shiny: false,
    level: member.level,
    nature: null,
    ability: null,
    abilities: null,
    types: species.types.map((type) => type.toLowerCase()),
    ivs: null,
    evs: null,
    stats: null,
    moves: { current: [], relearner: [], tms: [] },
    personalId: member.personalId,
  });
  data.party = data.party.map((m) => (m.personalId === member.personalId ? { ...m, fainted: false } : m));
  data.playTime = data.playTime === null ? null : Math.max(0, data.playTime - 3600);
  const { id: _id, milestoneId: _later, takenAt: _takenAt, ...kept } = later.snapshot;
  await db.insert(snapshot).values({
    ...kept,
    id: crypto.randomUUID(),
    milestoneId,
    data: data satisfies Snapshot,
    pokemon: data.pokemon.length,
    fainted: data.fainted.length,
  });
  return member.nickname ?? species.name;
}

async function seedTheTeam(): Promise<string | null> {
  const [row] = await db.select({ id: series.id, pool: series.pool }).from(series).where(eq(series.number, seedSeries.number));
  const [player] = await db.select({ id: user.id }).from(user).where(eq(user.username, seedSnapshot.player.toLowerCase()));
  if (!row || !player) throw new Error(`${seedSeries.name} or ${seedSnapshot.player} is missing`);
  const [made] = await db.select({ id: team.id }).from(team).where(eq(team.ownerId, player.id));
  if (made) return null;
  const [latest] = await db
    .select({ id: snapshot.id, data: snapshot.data, milestone: milestone.name })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, row.id), eq(save.userId, player.id)))
    .orderBy(desc(milestone.position))
    .limit(1);
  if (!latest) return null;
  const slots = emptySlots();
  latest.data.pokemon.slice(0, seedTeam.members).forEach((p, index) => {
    slots[index] = {
      source: latest.id,
      index,
      species: p.species,
      item: null,
      ability: null,
      moves: Array.from({ length: MOVE_SLOTS }, (_, at) => p.moves?.current[at] ?? null),
    };
  });
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(team).values({ id, ownerId: player.id, name: seedTeam.name, slots, pool: row.pool });
    await tx.insert(teamSource).values({ teamId: id, snapshotId: latest.id, position: 0 });
  });
  return `${seedSnapshot.player}'s ${seedTeam.name} of ${Math.min(seedTeam.members, latest.data.pokemon.length)} on their ${latest.milestone} snapshot`;
}

async function seedTheFinishedSeries(): Promise<string | null> {
  const [existing] = await db.select({ id: series.id }).from(series).where(eq(series.number, finishedSeries.number));
  if (existing) return null;
  const [first] = await db.select().from(series).where(eq(series.number, seedSeries.number));
  const [player] = await db.select({ id: user.id }).from(user).where(eq(user.username, seedSnapshot.player.toLowerCase()));
  if (!first || !player) throw new Error(`${seedSeries.name} or ${seedSnapshot.player} is missing`);
  const [latest] = await db
    .select({ snapshot })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, first.id), eq(save.userId, player.id)))
    .orderBy(desc(milestone.position))
    .limit(1);
  const players = await db.select({ id: user.id }).from(user).where(inArray(user.username, finishedSeries.players.map((name) => name.toLowerCase())));
  const id = crypto.randomUUID();
  const milestones = seedSeries.milestones.map(([name, mark], position) => ({ id: crypto.randomUUID(), seriesId: id, position, name, mark }));
  const chosen = milestones.find((m) => m.name === finishedSeries.milestone)!;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(series).values({
      id,
      number: finishedSeries.number,
      name: finishedSeries.name,
      gameId: first.gameId,
      scene: "night",
      ingestion: "manual",
      rules: first.rules,
      pool: first.pool,
      state: "finished",
      startedAt: now,
      finishedAt: now,
    });
    await tx.insert(seriesPlayer).values(players.map((p) => ({ seriesId: id, userId: p.id })));
    await tx.insert(milestone).values(milestones);
    if (!latest) return;
    const saveId = crypto.randomUUID();
    await tx.insert(save).values({ id: saveId, seriesId: id, userId: player.id });
    const data = structuredClone(latest.snapshot.data);
    data.playTime = data.playTime === null ? null : data.playTime + finishedSeries.extraPlayTime;
    const { id: _id, saveId: _save, milestoneId: _milestone, takenAt: _takenAt, ...kept } = latest.snapshot;
    await tx.insert(snapshot).values({ ...kept, id: crypto.randomUUID(), saveId, milestoneId: chosen.id, data: data satisfies Snapshot });
  });
  return latest ? `${finishedSeries.name} finished, on the night sky, with ${seedSnapshot.player}'s ${chosen.name} snapshot copied from their latest in ${seedSeries.name}, two hours longer` : `${finishedSeries.name} finished, on the night sky`;
}

async function main() {
  const remote = ["DATABASE_URL", "S3_ENDPOINT"]
    .map((variable) => new URL(requireEnv(variable)).hostname)
    .filter((host) => host !== "localhost" && host !== "127.0.0.1");
  const preview = remote.length > 0;
  if (preview && (process.env.SEED_TARGET !== "preview" || requireEnv("S3_BUCKET") !== previewBucket)) {
    throw new Error(`Refusing to seed ${remote.join(" and ")}: the seed is for the local stack, or for the preview environment with SEED_TARGET=preview and the ${previewBucket} bucket`);
  }
  const adminPassword = preview ? requireEnv("SEED_ADMIN_PASSWORD") : admin.password;

  if (!(await usernameTaken(admin.name))) await createAdmin(admin.name, adminPassword);
  for (const { name, allowed } of testPlayers) {
    if (!(await usernameTaken(name.toLowerCase()))) await createTestPlayer(name, allowed);
  }
  await seedTheGame();
  await seedTheSeries();
  const seededSnapshot = await seedTheSnapshot();
  const seededTeam = await seedTheTeam();
  const seededFinished = await seedTheFinishedSeries();
  console.log(
    `Seeded admin ${admin.name} (password ${preview ? "SEED_ADMIN_PASSWORD" : admin.password}), test players ${testPlayers.map(({ name, allowed }) => (allowed ? name : `${name} (waiting)`)).join(", ")}, the game ${seedGame.name} with a stand-in zip, and ${seedSeries.name} running on it with ${seedSeries.players.join(" and ")}${seededSnapshot ? `, with ${seededSnapshot}` : ""}${seededTeam ? `, and ${seededTeam}` : ""}${seededFinished ? `; and ${seededFinished}` : ""}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
