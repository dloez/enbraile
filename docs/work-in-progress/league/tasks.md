# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## Design the league on the canvas

Owner-run. Every screen of the league is designed anew on the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas, desktop and phone, on League pages of its own placed by the canvas's page rules ([The pkmn Site → Look](../../pkmn/site/explanation/site.md#look)), not after the old app ([discovery → Goal and Scope](discovery.md#goal-and-scope), [Surfaces](discovery.md#surfaces)): the league page's Standings, Rounds, Pokémon League and Cup, each with its admin tools in place; the series page's League summary; the Teams tab's flag and the locked badge on a round or cup team; logging a Pokémon League try (pick a team or paste one); the player profile's league record.

**Do:**
- [ ] Owner-run: design the boards and sign them off.
- [ ] Freeze the signed-off boards into `pkmn/site/design/` and name them in [The pkmn Site → Look](../../pkmn/site/explanation/site.md#look).

**Acceptance:**
- Claude-run: the frozen boards are in `pkmn/site/design/`, each named in the site doc.
- Human-run: the owner signs off every board.
- Reuse: the site's design system ([Site Design System](../../pkmn/site/reference/design-system.md)) and the series page's boards.
- Neighbors: `series.dc.html`, `teams-list.dc.html`, `player-profile.dc.html`.
- Forbidden: copying the Trainer League app's look; editing a frozen board by hand.

**Touches:** `pkmn/site/design/`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** the design and its sign-off.

## Write the cup's new rules into Series 1 Rules

Docs only. The cup is now eight Pokémon with a ban, replacing "No bans", and each player's sheet is their snapshot at the Tournament milestone, replacing the Open Sheet export made when they are done ([discovery → The Cup](discovery.md#the-cup)). The ban's details stay open, said so in the rule, until [Decide and build the cup's ban](#decide-and-build-the-cups-ban).

**Do:**
- [ ] Rewrite [Series 1 Rules → Final Tournament](../../pkmn/series/1/reference/rules.md#final-tournament)'s open-sheet rule and add the eight-with-a-ban rule, dated.
- [ ] Record both in [Competition Format → Decisions](../../pkmn/series/1/explanation/competition-format.md#decisions) and fix its Final Tournament section.

**Acceptance:**
- Claude-run: `grep -rn "Open Sheet export\|No bans" docs/pkmn/series/1/` finds nothing stale.
- Human-run: none.
- Reuse: none.
- Neighbors: the 2026-10-22 rule changes entry in Competition Format.
- Forbidden: settling what the ban is.

**Touches:** `docs/pkmn/series/1/`

## Series 1's rounds and standings come across from the app

The thinnest league end to end: the tables for a series' rounds and matches (pairs, the Bo3 score, each side's fainted, replay links), the one-off import of the app's rounds, matches and replays from the dump ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build)), `/series/<n>/league`'s Standings and Rounds, and the series page's League summary in place of its placeholder. Standings follow the rulebook's tie-breaks ([discovery → Standings](discovery.md#standings-the-pokémon-league-and-eggs)), from the league rules in `shared/league.ts`; Pokémon League points join them in [their entry](#players-log-their-pokémon-league-tries).

**Do:**
- [ ] Schema and migration for rounds and matches, round N tied to the Nth `round` milestone; seed rows for series 1.
- [ ] `shared/league.ts`: the league's rules as named values, and the standings worked out from them.
- [ ] The import script, reading the dump from `pkmn/site/saves/` with its user map, rerunnable.
- [ ] The read route and the page's Standings and Rounds; the series page's summary.

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack, import the dump (or, before it arrives, the public `/api/state` saved to `saves/`), and read through `verify-site` the 14 results, their replay links and a table whose order matches the rulebook's tie-breaks; run the import twice and see the same rows.
- Human-run: the owner reads series 1's standings against the app.
- Reuse: `seriesPlayer` and `milestone` in `api/_lib/schema.ts`; `MILESTONE_MARKS` in `shared/series.ts`; the series page's frame (`src/pages/series.tsx`).
- Neighbors: `api/_lib/teams.ts` for a read route; `scripts/seed.ts`.
- Forbidden: the app's tie-breaks (game and Pokémon difference); league constants anywhere but `shared/league.ts`; a pipeline beyond one script.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Design the league on the canvas

## An admin enters and fixes a match's result

On the Rounds view, an admin sets or corrects any match's Bo3 score, each side's fainted Pokémon and its replay links, in place; standings follow at once. Series 1's last league match gets its result this way ([discovery → Results](discovery.md#results)).

**Do:**
- [ ] The admin route and the in-place editor on a match.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, as admin, enter round 5's missing result with a replay link and see the standings move; as a player, see no editor and get 403 from the route.
- Human-run: the owner enters a real result on production.
- Reuse: the site's admin checks (`api/_lib/access.ts`).
- Neighbors: the series page's admin overrides (`src/pages/series.tsx`).
- Forbidden: a player report or confirm flow.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Series 1's rounds and standings come across from the app

## Players log their Pokémon League tries

The Pokémon League view lists each player's tries and their best; a player adds a try (combats won, the combat each member fainted in) with a team picked from theirs or pasted from Showdown, the paste creating a team sourced "Any Pokémon" and linked to the try; an admin edits or deletes any; the best try's points join the standings. The import brings series 1's tries, each paste as such a team ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs)).

**Do:**
- [ ] Schema for tries and their team; the import extended.
- [ ] The view, the add and edit flow, and the best try's points in the standings.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, see the imported tries; as a test player, log a try by paste and one by picking a team, and see the team made and the points move; as admin, edit one.
- Human-run: a player logs a real try on production.
- Reuse: Showdown paste-in (`src/teams/showdown.ts`) and team creation (`api/_lib/teams.ts`).
- Neighbors: the team list's new-team flow.
- Forbidden: a second Showdown parser.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Series 1's rounds and standings come across from the app

## The standings count eggs won and hatched

Eggs won from the rulebook (league wins, the best try's combats), hatched counted from each player's latest snapshot, with an admin override that keeps who set it and when; the import brings the app's hatched counts as overrides ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs)).

**Do:**
- [ ] Count hatched Pokémon from the snapshot (`obtained.hatchedAt`, living and fainted).
- [ ] The override, its admin editor, and the eggs columns.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a seeded snapshot with hatched Pokémon gives its count, an admin override wins over it and shows its source.
- Human-run: the owner reads series 1's eggs against the app.
- Reuse: the site's admin overrides (`api/_lib/`, The pkmn Site → Admin overrides).
- Neighbors: the snapshot fainted count's override.
- Forbidden: eggs for cup wins.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Players log their Pokémon League tries

## An admin runs the cup from its bracket to its champion

An admin starts the cup and picks who enters; the bracket is drawn from the standings in the rulebook's pattern for any size, the losers' group with its own tie-breaks; the admin enters each cup match's result as a league match's; winners move on to the champion ([discovery → The Cup](discovery.md#the-cup)). Teams join in the next entry.

**Do:**
- [ ] Schema for the cup and its matches; the bracket, group and seeding in `shared/league.ts`.
- [ ] The Cup view, starting it, and results in place.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, start series 1's cup with six and see 1–6, 2–5, 3–4, the triangular and the rulebook's semifinals; a 1–1–1 triangular broken by its tie-breaks; also a four-player cup as a plain knockout.
- Human-run: the owner starts series 1's real cup.
- Reuse: the result editor of [An admin enters and fixes a match's result](#an-admin-enters-and-fixes-a-matchs-result); the app's `buildBracket`, `losersTable` and `settleBracket` as reference only.
- Neighbors: the series page's tournament milestone.
- Forbidden: the app's semifinal pairing (1–6 with the triangular).

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** The standings count eggs won and hatched

## Each cup match gives its players a locked team to build

A cup match gives each of its players a team of eight sourced from their Tournament snapshot, flagged in their Teams tab until it is locked; Lock in freezes the whole build, an admin unlocks it, and the team list and page mark it locked; the match shows both teams, open to all ([discovery → Team Locking](discovery.md#team-locking), [The Cup](discovery.md#the-cup)). A player with no Tournament snapshot is told to upload it.

**Do:**
- [ ] The lock on a team, its admin unlock, and the frozen editor.
- [ ] Cup teams made per match and player; the Teams tab's flag.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, as a test player with a Tournament snapshot, build and lock a cup team and see every editor refuse; without one, see the upload prompt; as admin, unlock it.
- Human-run: a player builds and locks a real cup team on production.
- Reuse: team sources and size (`shared/team.ts`, `api/_lib/teams.ts`), the team page (`src/pages/team.tsx`).
- Neighbors: the team page's read-only view of another's team.
- Forbidden: an "Any Pokémon" source on a cup team; hiding teams.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** An admin runs the cup from its bracket to its champion

## Decide and build the cup's ban

Cup teams are eight with a ban; what can be banned, by whom and in what order is open ([discovery → The Cup](discovery.md#the-cup)). Once settled: the rule into Series 1 Rules, and the ban built on the cup match.

**Do:**
- [ ] Settle the ban with the owner; record it in the rules and in `discovery.md`.
- [ ] Build it on the cup match.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, play a cup match's ban as the rule says.
- Human-run: the owner reads the rule.
- Reuse: the cup teams of the entry above.
- Neighbors: the team page's pick of six.
- Forbidden: a ban rule the owner did not give.

**Touches:** `docs/pkmn/series/1/`, `pkmn/site/`, `docs/pkmn/site/`
**After:** Each cup match gives its players a locked team to build
**Needs the author:**
- What can be banned (a Pokémon, a move, an item), how many, and whether each side bans or one.
- In what order: before or after team preview, and whether bans are blind.

## An admin opens a round and draws its pairs

For a later series: an admin opens the next round, which draws pairs at random among players who have not met, with a bye on an odd count; the admin can redraw it or set the pairs by hand ([discovery → Rounds](discovery.md#rounds)).

**Do:**
- [ ] Opening, the draw, redraw and hand-set pairs, in place on the Rounds view.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, on a seeded series of five players, open rounds until each pair has met once, with byes, never repeating a pair; redraw one; set one by hand.
- Human-run: none until a series uses it.
- Reuse: the round tables of the first code entry.
- Neighbors: the admin result editor.
- Forbidden: rounds opening by themselves.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Series 1's rounds and standings come across from the app

## Each open round gives a player their team once their snapshot exists

An open round gives each player a team sourced from their snapshot at its milestone, sized by the league's rules, as soon as that snapshot exists; until then their Teams tab names the milestone to reach and upload. Locked and unlocked as a cup team ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] Round teams made when the round is open and the snapshot exists (on opening and on upload).
- [ ] The Teams tab's flag and waiting note; the match shows both teams.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open round 2 with one test player at Gym 2 and one at Gym 1: the first gets the team, the second the note, and gets it on uploading Gym 2.
- Human-run: none until a series uses it.
- Reuse: the lock of the cup teams entry.
- Neighbors: the upload flow (`api/_lib/ingest.ts`).
- Forbidden: a team sourced from a snapshot that does not exist.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** An admin opens a round and draws its pairs; Each cup match gives its players a locked team to build

## Series 1's matchday teams come across, locked to their rounds

The import brings the app's matchday teams, hidden one included, as site teams sourced "Any Pokémon", each locked to its player's round ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build)).

**Do:**
- [ ] Extend the import; show them on their matches.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, every series 1 match shows both teams, locked, members as in the paste.
- Human-run: none.
- Reuse: Showdown paste-in (`src/teams/showdown.ts`).
- Neighbors: the Pokémon League tries' pasted teams.
- Forbidden: a second Showdown parser.

**Touches:** `pkmn/site/scripts/`, `pkmn/site/api/`, `docs/pkmn/site/`
**After:** Each open round gives a player their team once their snapshot exists

## The player profile shows each series' league record

The profile's league placeholder becomes, per series, the player's place, points, W–L and how far they went in the cup ([discovery → Surfaces](discovery.md#surfaces)).

**Do:**
- [ ] Extend `GET /api/profiles/<player>` and the profile.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a series 1 player's profile matches the standings and the cup.
- Human-run: none.
- Reuse: the standings in `shared/league.ts`.
- Neighbors: the profile's totals (`src/pages/player-profile.tsx`).
- Forbidden: working the standings out a second way.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/pages/player-profile.tsx`, `docs/pkmn/site/`
**After:** An admin runs the cup from its bracket to its champion

## Retire the Trainer League app

Owner-run. With the full dump imported on production and read against the app, the group moves to the site and the app is switched off.

**Do:**
- [ ] Owner-run: get the full dump from the person who runs the app; run the import on production.
- [ ] Owner-run: read the league against the app; tell the group; switch it off.

**Acceptance:**
- Claude-run: none.
- Human-run: the owner's read-through on production.
- Reuse: the import script.
- Neighbors: none.
- Forbidden: none.

**Touches:** none
**After:** Series 1's matchday teams come across, locked to their rounds
**Needs the author:** the dump and the switch-off.
