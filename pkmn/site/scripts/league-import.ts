import { readdir, readFile } from "node:fs/promises";
import { toID } from "@pkmn/dex";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import * as z from "zod";
import { db, pool } from "../api/_lib/db.js";
import { importMatch } from "../api/_lib/match.js";
import { account, leagueRound, leagueTry, milestone, save, series, seriesPlayer, team, user } from "../api/_lib/schema.js";
import { insertTeam } from "../api/_lib/teams.js";
import { giveRoundTeams } from "../api/_lib/rounds.js";
import { bestTries, FAINTED_PER_GAME, fellProblem, PARTY_SIZE, played, standings, tally } from "../shared/league.js";
import { invite } from "../shared/players.js";
import type { TeamSlots } from "../shared/team.js";
import { EVERY_SPECIES, readShowdownTeam } from "../src/teams/showdown.js";
import { createTestPlayer, usernameTaken } from "./accounts.js";
import { localOrPreview } from "./target.js";

const dump = new URL("../saves/league-export/", import.meta.url);

const productionMap = new URL("../saves/league-users.json", import.meta.url);

const seriesNumber = 1;

const userMap: Record<string, string> = {
  Vicky: "vicky",
  Dloez: "dloez",
  Javi: "javi",
  Inop: "inop",
  Tole: "tole",
  Elfo: "elfo",
};

const discordUsers = z.record(z.string(), invite.shape.discordId);

type Player = { id: string; name: string };

async function testAccounts(players: readonly Player[]): Promise<Map<string, string>> {
  for (const player of players) {
    const username = userMap[player.name];
    if (!username) throw new Error(`The user map has no site account for ${player.name}`);
    if (await usernameTaken(username)) continue;
    if (username !== player.name.toLowerCase()) throw new Error(`No site account ${username} for ${player.name}`);
    await createTestPlayer(player.name, true);
  }
  const accounts = await db.select({ id: user.id, username: user.username }).from(user).where(inArray(user.username, Object.values(userMap)));
  return new Map(
    players.map((player) => {
      const found = accounts.find((a) => a.username === userMap[player.name]);
      if (!found) throw new Error(`No site account ${userMap[player.name]} for ${player.name}`);
      return [player.id, found.id];
    }),
  );
}

async function mappedAccounts(players: readonly Player[]): Promise<Map<string, string>> {
  const map = discordUsers.parse(JSON.parse(await readFile(productionMap, "utf8")));
  const discordIds = players.map((player) => {
    const discordId = map[player.name];
    if (!discordId) throw new Error(`The production map ${productionMap.pathname} has no Discord user for ${player.name}`);
    return discordId;
  });
  if (new Set(discordIds).size < discordIds.length) throw new Error(`The production map gives two players the same Discord user`);
  const found = await db
    .select({ userId: account.userId, discordId: account.accountId })
    .from(account)
    .where(and(eq(account.providerId, "discord"), inArray(account.accountId, discordIds)));
  return new Map(
    players.map((player, at) => {
      const owner = found.find((one) => one.discordId === discordIds[at]);
      if (!owner) throw new Error(`No site account has the Discord user ${discordIds[at]} for ${player.name}; invite them at /admin/players and run the import again`);
      return [player.id, owner.userId];
    }),
  );
}

const showdownNames: Record<string, string> = {
  Vicky: "Vicky182",
  Javi: "Pokejavieff TIKTOK",
  Dloez: "dloez",
  Tole: "tolejota",
  Elfo: "ElfNight",
  Inop: "inop123",
};

const exported = z.object({
  players: z.array(z.object({ id: z.string(), name: z.string(), eggs: z.object({ hatched: z.int().min(0) }) })),
  matchdays: z.array(z.object({ n: z.int(), match_ids: z.array(z.string()), bye_player: z.string().nullable() })),
  matches: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      matchday: z.int(),
      player_a: z.string(),
      player_b: z.string(),
      status: z.string(),
      games_a: z.int(),
      games_b: z.int(),
      fainted_a: z.int(),
      fainted_b: z.int(),
      team_a_id: z.string().nullable(),
      team_b_id: z.string().nullable(),
      replay_ids: z.array(z.string()),
    }),
  ),
  teams: z.array(z.object({ id: z.string(), owner_player_id: z.string(), text: z.string(), updated: z.string() })),
  replays: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      url: z.string().nullable(),
      match_id: z.string().nullable(),
      showdown_log_file: z.string().nullable(),
      showdown: z.object({ uploadtime: z.int() }).nullable(),
    }),
  ),
  standings: z.array(
    z.object({ player_name: z.string(), points: z.int(), league_wins: z.int(), league_losses: z.int(), games_won: z.int(), games_lost: z.int() }),
  ),
  pokemon_league: z.object({
    tries: z.array(
      z.object({
        id: z.string(),
        player_id: z.string(),
        try_number: z.int(),
        combats_won: z.int(),
        at: z.string(),
        team_text: z.string(),
        pokemon: z.array(z.object({ species: z.string(), fainted_in_combat: z.int().nullable() })),
      }),
    ),
  }),
});

async function findLeagueJson(): Promise<URL> {
  const found = (await readdir(dump, { recursive: true })).filter((path) => path.replaceAll("\\", "/").endsWith("data/league.json")).sort();
  if (!found[0]) throw new Error(`No data/league.json under ${dump.pathname}`);
  return new URL(found[0], dump);
}

type Side = "p1" | "p2";

type Battle = { replay: string; url: string | null; at: number; sides: Record<Side, string>; fainted: Record<Side, number>; winner: string };

function readLog(replay: string, url: string | null, uploaded: number, log: string): Battle | string {
  const lines = log.split("\n").map((line) => line.split("|"));
  const named = (side: Side) => lines.find((parts) => parts[1] === "player" && parts[2] === side && parts[3])?.[3];
  const p1 = named("p1");
  const p2 = named("p2");
  const winner = lines.find((parts) => parts[1] === "win")?.[2]?.trim();
  if (!p1 || !p2 || !winner) return `${replay} has no players or no winner in its log`;
  const faints = (side: Side) => lines.filter((parts) => parts[1] === "faint" && parts[2]?.startsWith(side)).length;
  const started = lines.find((parts) => parts[1] === "t:");
  return {
    replay,
    url,
    at: started ? Number(started[2]) : uploaded,
    sides: { p1, p2 },
    fainted: { p1: faints("p1"), p2: faints("p2") },
    winner,
  };
}

function pasteTeam(label: string, paste: { text: string; updated: string }, reports: string[]): { slots: TeamSlots; at: Date } {
  const read = readShowdownTeam(paste.text, new Map(), EVERY_SPECIES);
  if (read.left.length > 0) reports.push(`${label}'s paste leaves out ${read.left.join("; ")}`);
  return { slots: read.slots, at: new Date(paste.updated) };
}

async function main() {
  const production = process.env.LEAGUE_TARGET === "production";
  const preview = !production && localOrPreview("LEAGUE_TARGET", "league import");
  const source = await findLeagueJson();
  const data = exported.parse(JSON.parse(await readFile(source, "utf8")));
  const playerOfShowdown = new Map(
    data.players.map((player) => {
      const name = showdownNames[player.name];
      if (!name) throw new Error(`The Showdown names have none for ${player.name}`);
      return [name.toLowerCase(), player.id];
    }),
  );

  const siteId = production ? await mappedAccounts(data.players) : await testAccounts(data.players);

  const [target] = await db.select({ id: series.id, name: series.name, pool: series.pool }).from(series).where(eq(series.number, seriesNumber));
  if (!target) throw new Error(`No series ${seriesNumber}`);
  const rounds = await db
    .select({ id: milestone.id, name: milestone.name })
    .from(milestone)
    .where(and(eq(milestone.seriesId, target.id), eq(milestone.mark, "round")))
    .orderBy(asc(milestone.position));
  const matchdays = [...data.matchdays].sort((x, y) => x.n - y.n);
  if (matchdays.length > rounds.length) throw new Error(`${target.name} has ${rounds.length} round milestones for ${matchdays.length} matchdays`);

  const reports: string[] = [];
  const battles = new Map<string, Battle>();
  for (const replay of data.replays) {
    if (!replay.showdown_log_file) {
      reports.push(`${replay.id} has no Showdown log`);
      continue;
    }
    const read = readLog(replay.id, replay.url, replay.showdown?.uploadtime ?? 0, await readFile(new URL(replay.showdown_log_file, source), "utf8"));
    if (typeof read === "string") reports.push(read);
    else battles.set(replay.id, read);
  }
  const nameOfPlayer = new Map(data.players.map((p) => [p.id, p.name]));
  const rows = matchdays.map((day) => {
    const roundId = `${target.id}-md${day.n}`;
    return {
      round: { id: roundId, seriesId: target.id, milestoneId: rounds[day.n - 1]!.id, mode: "open" as const, byeId: day.bye_player ? siteId.get(day.bye_player)! : null },
      matches: day.match_ids.map((id, position) => {
        const match = data.matches.find((m) => m.id === id);
        if (!match || match.kind !== "league" || match.matchday !== day.n) throw new Error(`Matchday ${day.n} lists ${id}, which is not one of its league matches`);
        const done = match.status === "played";
        if (done && !played({ gamesA: match.games_a, gamesB: match.games_b })) throw new Error(`Match ${id} is played with ${match.games_a}–${match.games_b}`);
        const label = `Round ${day.n}'s ${nameOfPlayer.get(match.player_a)} v ${nameOfPlayer.get(match.player_b)}`;
        const read = match.replay_ids
          .map((replay) => battles.get(replay))
          .filter((battle) => battle !== undefined)
          .sort((x, y) => x.at - y.at)
          .flatMap((battle) => {
            const of = (side: "p1" | "p2") => playerOfShowdown.get(battle.sides[side].toLowerCase());
            const winner = playerOfShowdown.get(battle.winner.toLowerCase());
            const sideA = of("p1") === match.player_a ? "p1" : of("p2") === match.player_a ? "p2" : null;
            const sideB = sideA === "p1" ? "p2" : "p1";
            if (!sideA || of(sideB) !== match.player_b || (winner !== match.player_a && winner !== match.player_b)) {
              reports.push(`${label}: replay ${battle.replay} is ${battle.sides.p1} v ${battle.sides.p2}, won by ${battle.winner}, not this match's players`);
              return [];
            }
            if (Math.max(battle.fainted.p1, battle.fainted.p2) > FAINTED_PER_GAME) {
              reports.push(`${label}: replay ${battle.replay} has more than ${FAINTED_PER_GAME} fainted on a side`);
              return [];
            }
            return [
              {
                winner: siteId.get(winner)!,
                faintedA: battle.fainted[sideA],
                faintedB: battle.fainted[sideB],
                replay: battle.url,
                at: battle.at,
              },
            ];
          });
        const sides = { a: siteId.get(match.player_a)!, b: siteId.get(match.player_b)! };
        const sum = tally(sides, read);
        const whole = done && read.length === match.games_a + match.games_b;
        const agrees = done ? sum.gamesA <= match.games_a && sum.gamesB <= match.games_b && (!whole || (sum.gamesA === match.games_a && sum.gamesB === match.games_b)) : read.length === 0;
        if (!agrees) reports.push(`${label}: its replays make it ${sum.gamesA}–${sum.gamesB}, the app ${done ? `${match.games_a}–${match.games_b}` : "unplayed"}; its games are left out`);
        const games = agrees
          ? read.map((game, index) => ({
              id: `${match.id}-g${index + 1}`,
              matchId: match.id,
              number: index + 1,
              winnerId: game.winner,
              faintedA: game.faintedA,
              faintedB: game.faintedB,
              replay: game.replay,
              recordedAt: new Date(game.at * 1000),
            }))
          : [];
        const fainted = whole && agrees ? { faintedA: sum.faintedA, faintedB: sum.faintedB } : { faintedA: match.fainted_a, faintedB: match.fainted_b };
        if (whole && agrees && (fainted.faintedA !== match.fainted_a || fainted.faintedB !== match.fainted_b)) {
          reports.push(`${label}: fainted ${fainted.faintedA}–${fainted.faintedB} from its replays, ${match.fainted_a}–${match.fainted_b} in the app`);
        }
        const teamOf = (key: "a" | "b") => {
          const owner = key === "a" ? match.player_a : match.player_b;
          const side = `${label}, ${nameOfPlayer.get(owner)}'s side`;
          const pasteId = key === "a" ? match.team_a_id : match.team_b_id;
          const paste = pasteId ? data.teams.find((one) => one.id === pasteId) : undefined;
          if (pasteId && (!paste || paste.owner_player_id !== owner)) throw new Error(`${side} names team ${pasteId}, which is not one of its player's in the dump`);
          if (!paste && done) reports.push(`${side} has no matchday paste; it is left without a team`);
          return paste ? pasteTeam(side, paste, reports) : null;
        };
        const teams = (["a", "b"] as const).flatMap((key) => {
          const built = teamOf(key);
          return built
            ? [
                {
                  team: {
                    id: `${match.id}-team-${key}`,
                    ownerId: sides[key],
                    name: `${rounds[day.n - 1]!.name} team`,
                    anyPokemon: true,
                    slots: built.slots,
                    pool: target.pool,
                    sources: [],
                    matchId: match.id,
                    locked: { at: built.at, by: null },
                  },
                },
              ]
            : [];
        });
        return {
          teams,
          match: {
            id: match.id,
            roundId,
            position,
            playerA: sides.a,
            playerB: sides.b,
            gamesA: done ? match.games_a : null,
            gamesB: done ? match.games_b : null,
            faintedA: done ? fainted.faintedA : null,
            faintedB: done ? fainted.faintedB : null,
          },
          games,
        };
      }),
    };
  });

  const tried = data.pokemon_league.tries.flatMap((one) => {
    const label = `${nameOfPlayer.get(one.player_id)}'s Pokémon League try ${one.try_number}`;
    const owner = siteId.get(one.player_id);
    if (!owner) throw new Error(`${label} belongs to no player of the dump`);
    const read = readShowdownTeam(one.team_text, new Map(), EVERY_SPECIES);
    if (read.left.length > 0) reports.push(`${label}'s team leaves out ${read.left.join("; ")}`);
    const fell = one.pokemon.map((p) => p.fainted_in_combat);
    const members = read.slots.filter((member) => member !== null);
    const same = members.length === one.pokemon.length && members.every((member, at) => member.species === toID(one.pokemon[at]!.species));
    if (!same || members.length > PARTY_SIZE || fellProblem(one.combats_won, fell)) {
      reports.push(`${label}: its paste does not read as the dump's ${one.pokemon.length} members in their order, or a Pokémon fell past its combats; it is left out`);
      return [];
    }
    const teamId = `${one.id}-team`;
    return [
      {
        team: {
          id: teamId,
          ownerId: owner,
          name: `Pokémon League try ${one.try_number}`,
          anyPokemon: true,
          slots: read.slots,
          pool: target.pool,
          sources: [],
          locked: { at: new Date(one.at), by: null },
          private: false,
        },
        row: {
          id: one.id,
          seriesId: target.id,
          playerId: owner,
          teamId,
          combatsWon: one.combats_won,
          members: members.map((member, at) => ({ species: member.species, fell: fell[at] ?? null })),
          loggedAt: new Date(one.at),
        },
      },
    ];
  });

  const importedAt = new Date();
  const hatched = data.players.map((player) => ({ player: siteId.get(player.id)!, name: player.name, count: player.eggs.hatched }));

  const written = await db.transaction(async (tx) => {
    await tx.delete(leagueTry).where(eq(leagueTry.seriesId, target.id));
    if (tried.length > 0) await tx.delete(team).where(inArray(team.id, tried.map((one) => one.team.id)));
    await tx.delete(leagueRound).where(eq(leagueRound.seriesId, target.id));
    await tx.insert(seriesPlayer).values([...siteId.values()].map((userId) => ({ seriesId: target.id, userId }))).onConflictDoNothing();
    for (const { round, matches } of rows) {
      await tx.insert(leagueRound).values(round);
      for (const { match, games } of matches) {
        const loaded = await importMatch(tx, match, games);
        if (!loaded.done) throw new Error(`Match ${match.id} was refused: ${loaded.refused}`);
      }
    }
    for (const one of rows.flatMap((r) => r.matches.flatMap((m) => m.teams))) await insertTeam(tx, one.team);
    await giveRoundTeams(tx, target.id);
    for (const one of tried) {
      await insertTeam(tx, one.team);
      await tx.insert(leagueTry).values(one.row);
    }
    return tx
      .insert(save)
      .values(
        hatched.map((one) => ({
          id: crypto.randomUUID(),
          seriesId: target.id,
          userId: one.player,
          hatchedSet: one.count,
          hatchedSetBy: null,
          hatchedSetAt: importedAt,
          hatchedImported: true,
        })),
      )
      .onConflictDoUpdate({
        target: [save.seriesId, save.userId],
        set: { hatchedSet: sql`excluded.hatched_set`, hatchedSetBy: null, hatchedSetAt: importedAt, hatchedImported: true },
        setWhere: isNull(save.hatchedSetBy),
      })
      .returning({ player: save.userId });
  });
  const fromApp = new Set(written.map((one) => one.player));
  const kept = hatched.filter((one) => !fromApp.has(one.player));

  const matches = rows.flatMap((r) => r.matches.map((m) => m.match));
  const games = rows.flatMap((r) => r.matches.flatMap((m) => m.games));
  const teams = rows.flatMap((r) => r.matches.flatMap((m) => m.teams));
  const nameOf = new Map(data.players.map((p) => [siteId.get(p.id)!, p.name]));
  const best = bestTries(tried.map((one) => ({ player: one.row.playerId, combatsWon: one.row.combatsWon, at: one.row.loggedAt })).sort((x, y) => x.at.getTime() - y.at.getTime()));
  const table = standings(
    [...siteId.values()],
    matches.map((m) => ({ a: m.playerA, b: m.playerB, gamesA: m.gamesA, gamesB: m.gamesB, faintedA: m.faintedA, faintedB: m.faintedB })),
    new Map([...best].map(([player, one]) => [player, one.combatsWon])),
    target.id,
  );
  const disagreements = table.flatMap((row) => {
    const app = data.standings.find((s) => s.player_name === nameOf.get(row.player));
    if (!app) return [`${nameOf.get(row.player)} is missing from the dump's standings`];
    const ours = `${row.points} points, ${row.wins}–${row.losses}, games ${row.gamesWon}–${row.gamesLost}`;
    const theirs = `${app.points} points, ${app.league_wins}–${app.league_losses}, games ${app.games_won}–${app.games_lost}`;
    return ours === theirs ? [] : [`${app.player_name}: ${ours} here, ${theirs} in the app`];
  });
  console.log(
    `Imported ${rows.length} rounds and ${matches.length} matches (${matches.filter((m) => m.gamesA !== null).length} played, ${games.length} games from their replays), ${teams.length} match teams from their matchday pastes and ${tried.length} Pokémon League tries, each with its team, into ${target.name}${preview ? " on the preview" : production ? " through the production map" : ""}, with ${[...nameOf.values()].join(", ")} as its players.`,
  );
  console.log(`Hatched eggs, from the app until a later save: ${hatched.filter((one) => fromApp.has(one.player)).map((one) => `${one.name} ${one.count}`).join(", ") || "none"}`);
  if (kept.length > 0) console.log(`Hatched eggs an admin set, kept: ${kept.map((one) => one.name).join(", ")}`);
  console.log(`Standings: ${table.map((row) => `${row.place}. ${nameOf.get(row.player)} ${row.points} (${row.wins}–${row.losses})`).join(", ")}`);
  console.log(disagreements.length ? `Disagrees with the app:\n${disagreements.join("\n")}` : "Every player's points, wins, losses and games match the app's.");
  console.log(reports.length ? `From the replays and the tries:\n${reports.join("\n")}` : "Every replay and try agrees with the app.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
