# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## An admin's snapshot move mid-draft or snapshot delete under a league team follows the owner's answer

An admin's snapshot move copies a round or cup team on a match without a result into an Any Pokémon team of its owner and deletes it, for the passes to make it again on the snapshot now at its milestone (`startOver` in `api/_lib/teams.ts`, landed 2026-10-29; [discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). Two admin overrides on that snapshot are left unsettled. A move of a player's Tournament snapshot while a game of their cup match without a result has a ban or a six in: `startOver` leaves that cup team as it stands for now, since an admin cannot unlock a cup team then, since a ban names a place in the other's locked team and a six places in the player's own ([discovery → The Match Page](discovery.md#the-match-page), owner 2026-10-29; the refusal in `POST /api/teams/<id>/unlock`, `api/_lib/teams.ts`, landed 2026-10-29). And a delete of the snapshot (`DELETE …/trainers/<player>/snapshots/<milestone>`, `api/_lib/overrides.ts`): `team_source` cascades on the snapshot (`api/_lib/schema.ts`), so the team loses its source while its members still name the deleted snapshot (each member's `source`); the route runs neither `giveRoundTeams` nor `giveCupTeams`, and the player's next upload at that milestone gives the team, which now has no source, the new snapshot beside members naming the old one; on a match with a result, the played team loses the snapshot discovery says it keeps. And a move under a cup match whose game 1 is played but which has no result yet starts the cup team over, while game 1's bans and sixes, stored as places in the team (`league_game_side.ban`, `picks`), now point into the team made again rather than the one game 1 was played with. Found by the mid-run gardener and the snapshot move's pass, 2026-10-29.

**Do:**
- [ ] Per the author's answers, in the snapshot move's and delete's own transactions, through `giveRoundTeams` and `giveCupTeams`.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, from a reset with `MIRAMEEE-save.zip` and both of Series 2's game 2 bans in, an admin moves Red's Tournament snapshot and the answered behaviour holds, no ban or six left on a team that was emptied or unlocked; an admin deletes a player's round snapshot under a round team on a match without a result and on one with a result, and the answered behaviour holds, no member naming a snapshot that does not exist.
- Human-run: none.
- Reuse: the snapshot move and delete (`api/_lib/overrides.ts`); the unlock's refusal (`api/_lib/teams.ts`); `fixGame`'s clearing of a match's sides (`api/_lib/match.ts`); `giveRoundTeams` and `giveCupTeams`.
- Neighbors: the snapshot move's copy and start over (`startOver`, `api/_lib/teams.ts`).
- Forbidden: a ban or a six left naming a place in a team that was emptied or unlocked; a team on a match with a result changed other than as the author answers.

**Touches:** `pkmn/site/api/_lib/overrides.ts`, `pkmn/site/api/_lib/rounds.ts`, `pkmn/site/api/_lib/cup.ts`, `pkmn/site/api/_lib/teams.ts`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`
**Needs the author:**
- When an admin moves a player's Tournament snapshot while a game of their cup match without a result has a ban or a six in, is the move refused, as the unlock is, or does it clear that game's bans and sixes and start the cup team over as a move otherwise does?
- When an admin deletes a snapshot a round or cup team rests on and the team's match has no result, does the team start over as on a move (its members copied into an Any Pokémon team, the team deleted and made again by the passes, waiting on the upload)?
- When that match has a result, is the delete refused, or does the played team lose its source?
- When an admin moves the Tournament snapshot under a cup match with a game played but no result, is the move refused, does the match count as having a result so the team keeps its snapshot, or does the team start over with the played games' bans and sixes cleared?

## A round team still unlocked when its match is decided locks as it stands

An admin can record a round match's games whatever its teams' state: `recordGame` (`api/_lib/match.ts`) checks only the winner and the games' order, and both teams locked gates only a cup game's bans and picks (`started`, same file). Once the match is decided, the team list's waiting line drops it (`GET /api/teams/waiting` keeps only matches without a result, `api/_lib/teams.ts`), but an unlocked round team on it stays "To build" for good: `teamState` (`shared/team.ts`) reads only the lock, so the Teams tab's count (`GET /api/teams/to-build`) and the list's mark keep flagging it, and the lock route still locks it. The owner settled it: such a team is locked as it stands when its match is decided ([discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). Its reveal at the result (`revealed()` in `api/_lib/series-data.ts`) shows it while its owner can still change it. A cup game opens only on two locked teams, so only round matches reach this; series 1's round 5 Elfo v Javi does if its result is recorded on the site before Elfo locks. Found by the end-of-run gardener, 2026-10-29.

**Do:**
- [ ] The match module's move that decides a round match locking each unlocked team on it as it stands, by no one, in the same transaction; a team still missing stays missing.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, an admin records both games of a round match on the local stack while one of its teams is unlocked: the team is locked by no one once the match is decided, the match page shows it locked, and the Teams tab's count and the list's mark no longer flag it.
- Human-run: none.
- Reuse: `recordGame` and `started` (`api/_lib/match.ts`); `teamState` (`shared/team.ts`); the to-build route (`api/_lib/teams.ts`).
- Neighbors: a cup game's gate on two locked teams (`started`).
- Forbidden: a lock written outside the match module's move; the Teams tab's count and the list's mark disagreeing.

**Touches:** `pkmn/site/api/_lib/match.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/shared/team.ts`, `pkmn/site/src/pages/league-match.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`, `docs/pkmn/site/how-to/verify-the-site.md`

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

## The Rounds view puts fewer, wider round cards on a wide screen

From `lg` the league page's Rounds view lays every round out five to a row (`lg:grid-cols-5`, `src/pages/league.tsx`) inside the page's `readPage` column, capped at 86rem (`max-w-344`, `src/components/page.ts`), so on a wide screen each round card is about 250px wide; the owner finds it very small on a 1440p screen. The owner settled it: past the 1440 width the boards are drawn at, the rounds sit fewer to a row, the column, the type sizes and every other page left as they are ([discovery → Rounds](discovery.md#rounds), owner 2026-10-29). The cards keep the same type sizes, so they get wider, not larger.

**Do:**
- [ ] The Rounds view's grid putting fewer rounds to a row from `2xl` (1536px), so `league-rounds.dc.html` still reads as drawn at its own 1440 width; how many to a row is a build choice, recorded with its reason.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions), and the Rounds view's description in the League section if it names five to a row.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, the seed's Series 1 league on the Rounds view at 2560×1440 shows the rounds fewer to a row, each card's matches and states laid out as before, and at 1440×900 and 1024×768 shows them five to a row as today; a screenshot at each width.
- Human-run: the owner looks at series 1's Rounds view on their 1440p screen and says whether it still reads small; if the type is what is small, that is a new decision, not this entry.
- Reuse: the `readPage` column (`src/components/page.ts`); `RoundCard`, `PairsCard` and `UnopenedCard` (`src/pages/league.tsx`).
- Neighbors: the standings and head-to-head under the rounds, which keep their layout.
- Forbidden: changing `readPage`, `listPage` or any token; editing a board in `pkmn/site/design/`.

**Touches:** `pkmn/site/src/pages/league.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`

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
