import { readdir, readFile } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { Dex } from "@pkmn/dex";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "../api/_lib/db.js";
import { requireEnv } from "../api/_lib/env.js";
import { readSave } from "../api/_lib/export/export.js";
import { RubyObject } from "../api/_lib/export/marshal.js";
import { saveSlots } from "../api/_lib/export/save-zip.js";
import { readEntry, zipEntries } from "../api/_lib/export/zip.js";
import { abortUpload, completeUpload, partUrl, startUpload } from "../api/_lib/files.js";
import { ingest, savePrefix } from "../api/_lib/ingest.js";
import { refreshItemIcons } from "../api/_lib/item-icons.js";
import { giveCupTeams, startCup } from "../api/_lib/cup.js";
import { banIn, pickSix, recordGame } from "../api/_lib/match.js";
import { cup, game, gameSide, leagueMatch, leagueRound, leagueTry, milestone, save, series, seriesPlayer, snapshot, team, teamSource, user } from "../api/_lib/schema.js";
import { CUP_BROUGHT, CUP_TEAM_SIZE, standings } from "../shared/league.js";
import { DEFAULT_POOL } from "../shared/pool.js";
import { suggestMilestone } from "../shared/save-upload.js";
import type { MilestoneMark } from "../shared/series.js";
import type { Snapshot } from "../shared/snapshot.js";
import { emptySlots, MOVE_SLOTS } from "../shared/team.js";
import { partSizeFor, uploadParts } from "../shared/upload.js";
import { createAdmin, createTestPlayer, usernameTaken } from "./accounts.js";
import { localOrPreview } from "./target.js";

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
const finishedSeries = { number: 2, name: "Series 2", players: ["Red", "Blue"], milestone: "Tournament", extraPlayTime: 7200 };

const seedSnapshot = { player: "Red", saves: new URL("../saves/", import.meta.url), fallback: "Post-League" };

const seedTeam = { name: "Seed team", members: 3 };

const seedLeague = [
  {
    milestone: "Gym 1",
    a: "Red",
    b: "Blue",
    games: [
      { winner: "Red", faintedA: 1, faintedB: 6 },
      { winner: "Blue", faintedA: 6, faintedB: 3 },
      { winner: "Red", faintedA: 2, faintedB: 6 },
    ],
  },
  { milestone: "Gym 2", a: "Blue", b: "Red", games: [] },
];

const seedCupGame = { winner: "Red", faintedA: 3, faintedB: 6, bans: { Red: 0, Blue: 1 } };

const seedTry = { player: "Red", team: seedTeam.name, combatsWon: 2, fell: [2, 3, 3], species: ["snorlax", "venusaur", "staraptor"] };

const gameItems = new URL("../../games/anil/game/base/es-v4.14/Graphics/Items/", import.meta.url);

async function standInFiles(): Promise<{ name: string; data: Buffer }[]> {
  const files = [{ name: "stand-in.txt", data: Buffer.from("A stand-in for the game's files on the local stack.\n") }];
  const icons = (await readdir(gameItems).catch(() => [])).filter((name) => name.toLowerCase().endsWith(".png")).sort();
  for (const name of icons) files.push({ name: `Graphics/Items/${name}`, data: await readFile(new URL(encodeURIComponent(name), gameItems)) });
  return files;
}

function standInZip(files: { name: string; data: Buffer }[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, file.data);
    centrals.push(central, name);
    offset += local.length + name.length + file.data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
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
  const zip = standInZip(await standInFiles());
  await uploadZip(key, zip);
  await db.insert(game).values({
    id,
    name: seedGame.name,
    fileKey: key,
    fileName: seedGame.fileName,
    fileSize: zip.length,
    uploadedAt: new Date(),
  });
  await refreshItemIcons(id, key, null);
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

async function seedParty(): Promise<number[]> {
  const [first] = (await readdir(seedSnapshot.saves).catch(() => [])).filter((name) => name.toLowerCase().endsWith(".zip")).sort();
  if (!first) return [];
  const zip = new Uint8Array(await readFile(new URL(encodeURIComponent(first), seedSnapshot.saves)));
  const [slot] = saveSlots(zip);
  const entry = zipEntries(zip).find((candidate) => candidate.name === slot.entry);
  if (!entry) return [];
  const trainer = readSave(readEntry(zip, entry), entry.name).get("player") as RubyObject;
  const party = trainer.get("party");
  return Array.isArray(party) ? party.flatMap((pokemon) => (pokemon instanceof RubyObject && typeof pokemon.get("personalID") === "number" ? [pokemon.get("personalID") as number] : [])) : [];
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
  const { gameSpecies: _gameSpecies, ...alive } = member;
  data.pokemon.push({ ...alive, species: member.species });
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
  return member.nickname ?? Dex.species.get(member.species).name;
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
  const party = await seedParty();
  const rank = (personalId: number | null | undefined) => {
    const at = party.indexOf(personalId ?? -1);
    return at < 0 ? party.length : at;
  };
  const picked = latest.data.pokemon
    .map((p, index) => ({ p, index }))
    .sort((a, b) => rank(a.p.personalId) - rank(b.p.personalId))
    .slice(0, seedTeam.members);
  const slots = emptySlots();
  picked.forEach(({ p, index }, slot) => {
    slots[slot] = {
      source: latest.id,
      index,
      species: p.species,
      item: null,
      ability: null,
      nature: null,
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

async function seedTheLeague(): Promise<string | null> {
  const [row] = await db.select({ id: series.id }).from(series).where(eq(series.number, seedSeries.number));
  if (!row) throw new Error(`${seedSeries.name} is missing`);
  const [opened] = await db.select({ id: leagueRound.id }).from(leagueRound).where(eq(leagueRound.seriesId, row.id));
  if (opened) return null;
  const milestones = await db.select({ id: milestone.id, name: milestone.name }).from(milestone).where(eq(milestone.seriesId, row.id));
  const players = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.username, seedSeries.players.map((name) => name.toLowerCase())));
  const idOf = (name: string) => players.find((p) => p.name === name)?.id;
  const played: { matchId: string; games: { winner: string; faintedA: number; faintedB: number }[] }[] = [];
  await db.transaction(async (tx) => {
    for (const round of seedLeague) {
      const at = milestones.find((m) => m.name === round.milestone);
      const a = idOf(round.a);
      const b = idOf(round.b);
      if (!at || !a || !b) throw new Error(`${seedSeries.name} has no ${round.milestone}, ${round.a} or ${round.b}`);
      const roundId = crypto.randomUUID();
      const matchId = crypto.randomUUID();
      await tx.insert(leagueRound).values({ id: roundId, seriesId: row.id, milestoneId: at.id, mode: "open" });
      await tx.insert(leagueMatch).values({ id: matchId, roundId, position: 0, playerA: a, playerB: b });
      played.push({ matchId, games: round.games.map((game) => ({ ...game, winner: idOf(game.winner)! })) });
    }
  });
  for (const { matchId, games } of played) {
    for (const game of games) {
      const moved = await recordGame(matchId, { ...game, replay: null }, null);
      if (!moved.done) throw new Error(`The seed's game was refused: ${moved.refused}`);
    }
  }
  const score = (games: { winner: string }[], a: string, b: string) =>
    games.length === 0 ? "to play" : `${games.filter((g) => g.winner === a).length}–${games.filter((g) => g.winner === b).length} in ${games.length} games`;
  return `its league's rounds at ${seedLeague.map((r) => `${r.milestone} (${r.a} v ${r.b}, ${score(r.games, r.a, r.b)})`).join(" and ")}`;
}

async function seedTheTry(): Promise<string | null> {
  const [row] = await db.select({ id: series.id }).from(series).where(eq(series.number, seedSeries.number));
  const [player] = await db.select({ id: user.id }).from(user).where(eq(user.username, seedTry.player.toLowerCase()));
  if (!row || !player) throw new Error(`${seedSeries.name} or ${seedTry.player} is missing`);
  const [logged] = await db.select({ id: leagueTry.id }).from(leagueTry).where(and(eq(leagueTry.seriesId, row.id), eq(leagueTry.playerId, player.id)));
  if (logged) return null;
  const [made] = await db.select({ id: team.id, slots: team.slots }).from(team).where(and(eq(team.ownerId, player.id), eq(team.name, seedTry.team)));
  const species = made ? made.slots.flatMap((member) => (member ? [member.species] : [])) : seedTry.species;
  const members = species.map((one, at) => ({ species: one, fell: seedTry.fell[at] ?? null }));
  await db.insert(leagueTry).values({ id: crypto.randomUUID(), seriesId: row.id, playerId: player.id, teamId: made?.id ?? null, combatsWon: seedTry.combatsWon, members, loggedBy: player.id });
  return `a Pokémon League try of ${seedTry.player}'s${made ? ` with the ${seedTry.team}` : ""}, ${seedTry.combatsWon} combats won`;
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
      rulesEs: first.rulesEs,
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

async function seedTheCup(): Promise<string | null> {
  const [row] = await db.select({ id: series.id }).from(series).where(eq(series.number, finishedSeries.number));
  if (!row) throw new Error(`${finishedSeries.name} is missing`);
  const [held] = await db.select({ id: cup.id }).from(cup).where(eq(cup.seriesId, row.id));
  if (held) return null;
  const players = await db.select({ id: seriesPlayer.userId }).from(seriesPlayer).where(eq(seriesPlayer.seriesId, row.id));
  const order = standings(players.map((p) => p.id), [], new Map(), row.id).map((s) => s.player);
  const started = await startCup(row.id, order, order, "open", null);
  if (!started.done) throw new Error(`The seed's cup was refused: ${started.refused}`);
  return `its cup started with ${finishedSeries.players.join(" and ")}, their final to play`;
}

async function seedTheCupGame(): Promise<string | null> {
  const [row] = await db.select({ id: series.id }).from(series).where(eq(series.number, finishedSeries.number));
  if (!row) throw new Error(`${finishedSeries.name} is missing`);
  const [final] = await db.select().from(leagueMatch).innerJoin(cup, eq(cup.id, leagueMatch.cupId)).where(eq(cup.seriesId, row.id));
  if (!final) return null;
  const match = final.league_match;
  const [sided] = await db.select({ number: gameSide.number }).from(gameSide).where(eq(gameSide.matchId, match.id)).limit(1);
  if (sided) return null;
  const players = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [match.playerA, match.playerB]));
  const idOf = (name: string) => players.find((p) => p.name === name)?.id;
  const sheets = await db
    .select({ owner: save.userId, snapshot })
    .from(snapshot)
    .innerJoin(save, eq(save.id, snapshot.saveId))
    .innerJoin(milestone, eq(milestone.id, snapshot.milestoneId))
    .where(and(eq(save.seriesId, row.id), eq(milestone.name, finishedSeries.milestone)));
  const [held] = sheets;
  if (!held || held.snapshot.data.pokemon.length < CUP_TEAM_SIZE) return null;
  await db.transaction(async (tx) => {
    for (const player of [match.playerA, match.playerB]) {
      if (sheets.some((sheet) => sheet.owner === player)) continue;
      const saveId = crypto.randomUUID();
      await tx.insert(save).values({ id: saveId, seriesId: row.id, userId: player });
      const { id: _id, saveId: _save, takenAt: _takenAt, ...kept } = held.snapshot;
      await tx.insert(snapshot).values({ ...kept, id: crypto.randomUUID(), saveId });
    }
    await giveCupTeams(tx, row.id);
    const made = await tx.select({ id: team.id, source: teamSource.snapshotId }).from(team).innerJoin(teamSource, eq(teamSource.teamId, team.id)).where(eq(team.matchId, match.id));
    for (const one of made) {
      const [sheet] = await tx.select({ data: snapshot.data }).from(snapshot).where(eq(snapshot.id, one.source));
      const slots = sheet!.data.pokemon.slice(0, CUP_TEAM_SIZE).map((p, index) => ({
        source: one.source,
        index,
        species: p.species,
        item: null,
        ability: null,
        nature: null,
        moves: Array.from({ length: MOVE_SLOTS }, (_, at) => p.moves?.current[at] ?? null),
      }));
      await tx.update(team).set({ slots, lockedAt: new Date() }).where(eq(team.id, one.id));
    }
  });
  const red = idOf(seedCupGame.winner);
  const sides = players.map((p) => ({ ...p, ban: seedCupGame.bans[p.name as keyof typeof seedCupGame.bans] }));
  if (!red || sides.some((side) => side.ban === undefined)) throw new Error(`${finishedSeries.name}'s final is not ${finishedSeries.players.join(" v ")}`);
  for (const side of sides) {
    const banned = await banIn(match.id, 1, side.id, side.ban, side.id);
    if (!banned.done) throw new Error(`The seed's ban was refused: ${banned.refused}`);
  }
  for (const side of sides) {
    const against = sides.find((other) => other.id !== side.id)!.ban;
    const six = Array.from({ length: CUP_TEAM_SIZE }, (_, at) => at).filter((at) => at !== against).slice(0, CUP_BROUGHT);
    const picked = await pickSix(match.id, 1, side.id, six, side.id);
    if (!picked.done) throw new Error(`The seed's pick was refused: ${picked.refused}`);
  }
  const recorded = await recordGame(match.id, { winner: red, faintedA: seedCupGame.faintedA, faintedB: seedCupGame.faintedB, replay: null }, null);
  if (!recorded.done) throw new Error(`The seed's cup game was refused: ${recorded.refused}`);
  return `the final's teams of eight locked, game 1 banned, picked and won by ${seedCupGame.winner}, game 2's bans open`;
}

async function main() {
  const preview = localOrPreview("SEED_TARGET", "seed");
  const adminPassword = preview ? requireEnv("SEED_ADMIN_PASSWORD") : admin.password;

  if (!(await usernameTaken(admin.name))) await createAdmin(admin.name, adminPassword);
  for (const { name, allowed } of testPlayers) {
    if (!(await usernameTaken(name.toLowerCase()))) await createTestPlayer(name, allowed);
  }
  await seedTheGame();
  await seedTheSeries();
  const seededSnapshot = await seedTheSnapshot();
  const seededTeam = await seedTheTeam();
  const seededLeague = await seedTheLeague();
  const seededTry = await seedTheTry();
  const seededFinished = await seedTheFinishedSeries();
  const seededCup = await seedTheCup();
  const seededCupGame = await seedTheCupGame();
  console.log(
    `Seeded admin ${admin.name} (password ${preview ? "SEED_ADMIN_PASSWORD" : admin.password}), test players ${testPlayers.map(({ name, allowed }) => (allowed ? name : `${name} (waiting)`)).join(", ")}, the game ${seedGame.name} with a stand-in zip, and ${seedSeries.name} running on it with ${seedSeries.players.join(" and ")}${seededLeague ? ` and ${seededLeague}` : ""}${seededSnapshot ? `, with ${seededSnapshot}` : ""}${seededTeam ? `, and ${seededTeam}` : ""}${seededTry ? `, and ${seededTry}` : ""}${seededFinished ? `; and ${seededFinished}` : ""}${seededCup ? (seededFinished ? `, with ${seededCup}` : `; and ${finishedSeries.name} with ${seededCup}`) : ""}${seededCupGame ? `, ${seededCupGame}` : ""}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
