import { readdir, readFile } from "node:fs/promises";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as z from "zod";
import { db, pool } from "../api/_lib/db.js";
import { leagueMatch, leagueRound, milestone, series, seriesPlayer, user } from "../api/_lib/schema.js";
import { played, standings } from "../shared/league.js";
import { createTestPlayer, usernameTaken } from "./accounts.js";
import { localOrPreview } from "./target.js";

const dump = new URL("../saves/league-export/", import.meta.url);

const seriesNumber = 1;

const userMap: Record<string, string> = {
  Vicky: "vicky",
  Dloez: "dloez",
  Javi: "javi",
  Inop: "inop",
  Tole: "tole",
  Elfo: "elfo",
};

const exported = z.object({
  players: z.array(z.object({ id: z.string(), name: z.string() })),
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
      replay_ids: z.array(z.string()),
    }),
  ),
  replays: z.array(z.object({ id: z.string(), type: z.string(), url: z.string().nullable() })),
  standings: z.array(
    z.object({ player_name: z.string(), league_wins: z.int(), league_losses: z.int(), games_won: z.int(), games_lost: z.int() }),
  ),
});

async function findLeagueJson(): Promise<URL> {
  const found = (await readdir(dump, { recursive: true })).filter((path) => path.replaceAll("\\", "/").endsWith("data/league.json")).sort();
  if (!found[0]) throw new Error(`No data/league.json under ${dump.pathname}`);
  return new URL(found[0], dump);
}

async function main() {
  const preview = localOrPreview("LEAGUE_TARGET", "league import");
  const source = await findLeagueJson();
  const data = exported.parse(JSON.parse(await readFile(source, "utf8")));

  for (const player of data.players) {
    const username = userMap[player.name];
    if (!username) throw new Error(`The user map has no site account for ${player.name}`);
    if (await usernameTaken(username)) continue;
    if (username !== player.name.toLowerCase()) throw new Error(`No site account ${username} for ${player.name}`);
    await createTestPlayer(player.name, true);
  }
  const accounts = await db.select({ id: user.id, username: user.username }).from(user).where(inArray(user.username, Object.values(userMap)));
  const siteId = new Map(
    data.players.map((player) => {
      const account = accounts.find((a) => a.username === userMap[player.name]);
      if (!account) throw new Error(`No site account ${userMap[player.name]} for ${player.name}`);
      return [player.id, account.id];
    }),
  );

  const [target] = await db.select({ id: series.id, name: series.name }).from(series).where(eq(series.number, seriesNumber));
  if (!target) throw new Error(`No series ${seriesNumber}`);
  const rounds = await db
    .select({ id: milestone.id, name: milestone.name })
    .from(milestone)
    .where(and(eq(milestone.seriesId, target.id), eq(milestone.mark, "round")))
    .orderBy(asc(milestone.position));
  const matchdays = [...data.matchdays].sort((x, y) => x.n - y.n);
  if (matchdays.length > rounds.length) throw new Error(`${target.name} has ${rounds.length} round milestones for ${matchdays.length} matchdays`);

  const replayUrl = new Map(data.replays.map((r) => [r.id, r.url]));
  const rows = matchdays.map((day) => {
    const roundId = `${target.id}-md${day.n}`;
    return {
      round: { id: roundId, seriesId: target.id, milestoneId: rounds[day.n - 1]!.id, byeId: day.bye_player ? siteId.get(day.bye_player)! : null },
      matches: day.match_ids.map((id, position) => {
        const match = data.matches.find((m) => m.id === id);
        if (!match || match.kind !== "league" || match.matchday !== day.n) throw new Error(`Matchday ${day.n} lists ${id}, which is not one of its league matches`);
        const done = match.status === "played";
        if (done && !played({ gamesA: match.games_a, gamesB: match.games_b })) throw new Error(`Match ${id} is played with ${match.games_a}–${match.games_b}`);
        return {
          id: match.id,
          roundId,
          position,
          playerA: siteId.get(match.player_a)!,
          playerB: siteId.get(match.player_b)!,
          gamesA: done ? match.games_a : null,
          gamesB: done ? match.games_b : null,
          faintedA: done ? match.fainted_a : null,
          faintedB: done ? match.fainted_b : null,
          replays: match.replay_ids.flatMap((replay) => {
            const url = replayUrl.get(replay);
            return url ? [url] : [];
          }),
        };
      }),
    };
  });

  await db.transaction(async (tx) => {
    await tx.delete(leagueRound).where(eq(leagueRound.seriesId, target.id));
    await tx.insert(seriesPlayer).values([...siteId.values()].map((userId) => ({ seriesId: target.id, userId }))).onConflictDoNothing();
    for (const { round, matches } of rows) {
      await tx.insert(leagueRound).values(round);
      if (matches.length > 0) await tx.insert(leagueMatch).values(matches);
    }
  });

  const matches = rows.flatMap((r) => r.matches);
  const nameOf = new Map(data.players.map((p) => [siteId.get(p.id)!, p.name]));
  const table = standings(
    [...siteId.values()],
    matches.map((m) => ({ a: m.playerA, b: m.playerB, gamesA: m.gamesA, gamesB: m.gamesB, faintedA: m.faintedA, faintedB: m.faintedB })),
    target.id,
  );
  const disagreements = table.flatMap((row) => {
    const app = data.standings.find((s) => s.player_name === nameOf.get(row.player));
    if (!app) return [`${nameOf.get(row.player)} is missing from the dump's standings`];
    const ours = `${row.wins}–${row.losses}, games ${row.gamesWon}–${row.gamesLost}`;
    const theirs = `${app.league_wins}–${app.league_losses}, games ${app.games_won}–${app.games_lost}`;
    return ours === theirs ? [] : [`${app.player_name}: ${ours} here, ${theirs} in the app`];
  });
  console.log(
    `Imported ${rows.length} rounds and ${matches.length} matches (${matches.filter((m) => m.gamesA !== null).length} played, ${matches.reduce((n, m) => n + m.replays.length, 0)} replay links) into ${target.name}${preview ? " on the preview" : ""}, with ${[...nameOf.values()].join(", ")} as its players.`,
  );
  console.log(`Standings: ${table.map((row) => `${row.place}. ${nameOf.get(row.player)} ${row.points} (${row.wins}–${row.losses})`).join(", ")}`);
  console.log(disagreements.length ? `Disagrees with the app:\n${disagreements.join("\n")}` : "Every player's wins, losses and games match the app's.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
