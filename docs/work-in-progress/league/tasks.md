# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, checks its flow through the `verify-site` skill (in the browser when it changes a page, by its routes and the database when it changes only the API or shared logic; `pkmn/site/CLAUDE.md`), builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## An admin's snapshot move or delete never changes a league team its games stand on

An admin's snapshot move copies a round or cup team on a match without a result into an Any Pokémon team of its owner and deletes it, for the passes to make it again on the snapshot now at its milestone (`startOver` in `api/_lib/teams.ts`, landed 2026-10-29), and leaves a cup team mid-draft as it stands. The snapshot delete (`DELETE …/trainers/<player>/snapshots/<milestone>`, `api/_lib/overrides.ts`) runs neither `giveRoundTeams` nor `giveCupTeams`, and `team_source` cascades on the snapshot (`api/_lib/schema.ts`), so a team loses its source while its members still name the deleted snapshot, and a played team loses the snapshot discovery says it keeps. And a move under a match with a game played but no result starts the team over, while that game's bans and sixes, stored as places in the team (`league_game_side.ban`, `picks`), then point into the team made again. The owner settled all of it: a move or delete is refused while a team built on the snapshot sits on a match without a result that has a game recorded or a ban or a six in; a delete is refused under a team whose match has a result; a delete under a team on a match not yet under way starts the team over as a move does ([discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). Found by the mid-run gardener and the snapshot move's pass, 2026-10-29.

**Do:**
- [ ] The move and the delete refusing (409, in English and Spanish) while a round or cup team sourced from the snapshot is on a match without a result that has a `league_game` row or a `league_game_side` with a ban or a six; `startOver` no longer leaving a mid-draft team as it stands, since the move is now refused first.
- [ ] The delete refusing (409, in English and Spanish) while a team sourced from the snapshot is on a match with a result.
- [ ] Otherwise, the delete running `startOver` on the snapshot's teams, then `giveRoundTeams` and `giveCupTeams`, in one transaction with the delete, taking the series and cup rows first as the move does (`holdLeague`).
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions), and the admin overrides paragraph.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, by its routes (no page changes): from a reset with `MIRAMEEE-save.zip`, with Series 2's game 2 bans in, an admin's move and delete of Red's Tournament snapshot answer 409 and nothing changes; with game 1 recorded and game 2's bans cleared, both still answer 409; on round 1's decided match, a delete of the snapshot under its team answers 409 and a move leaves the team on it; on a round match not yet under way, a delete copies the round team into an Any Pokémon team, the round team waits on the upload, and no `team_source` or member names a snapshot that does not exist.
- Human-run: none.
- Reuse: `startOver`, `holdLeague` and `drafting` (`api/_lib/teams.ts`); the move and delete (`api/_lib/overrides.ts`); `giveRoundTeams` and `giveCupTeams`.
- Neighbors: the unlock's refusal mid-draft (`POST /api/teams/<id>/unlock`).
- Forbidden: a ban or a six left naming a place in a team that changed; a team on a match with a result changed; a member naming a snapshot that does not exist.

**Touches:** `pkmn/site/api/_lib/overrides.ts`, `pkmn/site/api/_lib/teams.ts`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`

## An admin enters a Pokémon League try and fixes a locked league team as the owner answers

The Goal has an admin able to "enter and fix any of it (rounds, results, replays, standings, Pokémon League tries, eggs, every matchday team)" ([discovery → Goal](discovery.md#goal)). Two of those an admin cannot do today. `POST /api/series/<n>/league/tries` answers 403 to an admin (`api/_lib/league.ts`, the `notPlayer` refusal), and Edit opens a try without its team section ([The pkmn Site → League](../../pkmn/site/explanation/site.md#league), "Pokémon League tries"), so an admin can neither log a try for a player nor change the team a try was logged with. And a team page gives editing to its owner alone (`canEdit: mine && !locked && …`, `GET /api/teams/<id>` in `api/_lib/teams.ts`), so an admin fixes a locked matchday, round, cup or try team only by unlocking it for its owner to edit. Discovery settles that the player records a try and an admin edits or deletes any ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs), owner 2026-10-27); whether that is all the Goal's "enter and fix" means is not settled. Found by the mid-run gardener against the Goal, 2026-10-29.

**Do:**
- [ ] Per the author's answers.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions), and in [Team Builder](../../pkmn/site/explanation/team-builder.md#decisions) if a team's editing changes.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, signed in as `admin` on series 1's imported league, each answered move goes through by page and route, and a player's own moves are unchanged.
- Human-run: none.
- Reuse: the try routes (`api/_lib/league.ts`) and the log dialog (`src/league/try-dialog.tsx`); the team page's editor and `PUT /api/teams/<id>` (`api/_lib/teams.ts`); `lockTryTeam`.
- Neighbors: the Eggs cell's admin override, which records who set it and when.
- Forbidden: a control hidden in the browser only; an admin's write skipping a check the player's own write goes through.

**Touches:** `pkmn/site/api/_lib/league.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/src/league/`, `pkmn/site/src/pages/team.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`, `docs/pkmn/site/how-to/verify-the-site.md`
**Needs the author:**
- Does an admin log a Pokémon League try on a player's behalf, or do tries stay the player's to log, an admin only editing and deleting them?
- Does an admin change the team a logged try was played with?
- Does an admin edit a locked league team's members themselves (an imported matchday team, a round, cup or try team), or is unlocking it for its owner to fix, as today, the fix?

## Others' Pokémon League tries show from the milestone the owner names

A try's members and team show to another player "only once they have reached the Pokémon League themselves" ([discovery → Team Locking](discovery.md#team-locking), "Who decides a locked team's visibility?", owner 2026-10-29). No milestone marks the Pokémon League (`MILESTONE_MARKS` is `none`, `round` and `tournament`, `shared/series.ts`), and the try teams' pass of 2026-10-29 placed it at the series' last round: `leagueSeen` (`shared/league.ts`) answers `last <= upTo`, so a player whose latest snapshot is at series 1's Gym 7, with Gym 8 still to beat, sees every try, as `verify-the-site.md` checks ("moved to Gym 7, the last round milestone, both tries show"). [The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions) records it as a delegated build choice ("The try teams' save rule, build choices"). The reading agrees with the save rule, which already shows others' Post-League and Tournament PCs from round 5 (`savesSeen`), but when another's tries show is a product choice with more than one workable answer. Found by the mid-run gardener, 2026-10-29.

**Do:**
- [ ] Per the author's answer, `leagueSeen` and its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions), recorded as the owner's rather than a build choice, and the Pokémon League view's held-back line if what it names changes.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with Red's try logged and Blue's latest snapshot moved through Gym 7, Gym 8 and Post-League in step 3's `psql`, Blue sees the try's members and its team from exactly the milestone the author names, by page and route; an admin and Red always.
- Human-run: none.
- Reuse: `leagueSeen` and `savesSeen` (`shared/league.ts`); `leaguesSeenBy` and `seriesSaves` (`api/_lib/series-data.ts`).
- Neighbors: the save rule's reach (`reach` in `shared/league.ts`).
- Forbidden: hiding in the browser only; a new milestone mark or setting the author's answer does not ask for.

**Touches:** `pkmn/site/shared/league.ts`, `pkmn/site/api/_lib/series-data.ts`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`, `docs/pkmn/site/how-to/verify-the-site.md`
**Needs the author:**
- Has a player reached the Pokémon League, for seeing others' tries, once they have a snapshot in the series' last round (series 1's Gym 7, as built), or only from a later milestone (series 1's Gym 8, or Post-League)?
- If later: since the save rule already shows others' Post-League and Tournament PCs from round 5, does a try stay hidden from a Gym 7 player who can open the PC holding its Pokémon?

## Series 1's league goes live on pkmn.enbraile.vip

The Goal is met "on `pkmn.enbraile.vip`", with the Trainer League app retired ([discovery → Goal](discovery.md#goal)). Today the league lives on its own branch, never pushed to `main`, so neither its tables nor its data reach production until the owner says so ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build), "Where is the league built and tried?", owner 2026-10-28), and `npm run league-import` refuses any database off the local stack but the preview's (`localOrPreview` in `scripts/target.ts`, with `LEAGUE_TARGET=preview`), making the six players as test accounts where they are missing (`createTestPlayer`, `scripts/league-import.ts`). Discovery settles the rest: production gets the import once the owner has invited the real players so their accounts exist, the user map (`userMap`, `scripts/league-import.ts`) then pointing at those ("The import's first target?", owner 2026-10-28); and Elfo v Javi is played in the app, the owner saying when to rerun the import ([discovery → Results](discovery.md#results), owner 2026-10-29). No entry and no landed code reaches production. Found by the mid-run gardener against the Goal, 2026-10-29.

**Do:**
- [ ] The import run against production once the owner says so: the user map pointing at the real players' accounts, making no account there and stopping on a player the map names with no account; the preview's run unchanged.
- [ ] How to run it against production in [How to Run and Deploy the Site → Import series 1's league](../../pkmn/site/how-to/run-and-deploy-the-site.md#import-series-1s-league), and its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack, the import in its production mode with the map pointing at accounts made by hand writes series 1's league and makes no account, and stops, naming the player, when one is missing; the preview's run prints what it printed before.
- Human-run: the owner merges `league` into `main`, which deploys the league's migrations to production, runs the import against production with the real map, checks series 1's league against the app (rounds, results, replays, standings, Pokémon League tries, eggs, every matchday team) as each real player, then retires the Trainer League app.
- Reuse: `localOrPreview` (`scripts/target.ts`); `userMap` and the import's account checks (`scripts/league-import.ts`).
- Neighbors: the seed's refusal of production (`scripts/seed.ts`).
- Forbidden: the import writing to production without the owner's word; a test account made in production; a pass pushing to `main`.

**Touches:** `pkmn/site/scripts/league-import.ts`, `pkmn/site/scripts/target.ts`, `docs/pkmn/site/how-to/run-and-deploy-the-site.md`, `docs/pkmn/site/explanation/site.md`
**Needs the author:**
- Which production account is each of the app's six players (Vicky, Dloez, Javi, Inop, Tole, Elfo), and have they all been invited?
- Which of the entries above must land before the league goes to production, and when is `league` merged into `main`?
- Is production's import run once Elfo v Javi is played in the app and a fresh dump handed over, or before, with a rerun after?

## A closed cup hides its players' Tournament snapshots until their match has a result

Discovery's closed mode shows "a match's two teams and both players' snapshots for it" once the match has its result ([discovery → Team Locking](discovery.md#team-locking)), and a cup team is built from its player's Tournament snapshot ([The Cup](discovery.md#the-cup)). The closed round's hold in the save rule (`roundHolds` in `shared/league.ts`, fed by `seriesSaves` in `api/_lib/series-data.ts`) covers round matches only, so in a closed cup every cup player who has reached the Tournament still sees the others' Tournament snapshots. A cup player plays several matches on that one snapshot, so when it shows is not settled. Found by the closed round snapshots' validator, 2026-10-29.

**Do:**
- [ ] The closed cup's hold on its players' Tournament snapshots, in the save rule, once settled.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in a closed cup, a cup player cannot open another's Tournament snapshot, find its Pokémon in the abilities search or add it as a team source, by page or route, while the settled rule hides it; in an open cup they can.
- Human-run: none until a series uses a closed cup.
- Reuse: `savesSeen` and `roundHolds` (`shared/league.ts`); `seriesSaves` (`api/_lib/series-data.ts`); the cup's reveal in `revealed()`.
- Neighbors: the closed round's hold.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/shared/league.ts`, `pkmn/site/api/_lib/series-data.ts`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`
**Needs the author:**
- In a closed cup, is a player's Tournament snapshot hidden from everyone but its owner and admins until their first cup match has a result, until their last, or from each opponent only until their match together has a result?
- Does a closed cup also hide each cup player's saves later than the Tournament from the players they still have to meet?
