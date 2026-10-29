# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, checks its flow through the `verify-site` skill (in the browser when it changes a page, by its routes and the database when it changes only the API or shared logic; `pkmn/site/CLAUDE.md`), builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## Series 1's league goes live on pkmn.enbraile.vip

The Goal is met "on `pkmn.enbraile.vip`", with the Trainer League app retired ([discovery → Goal](discovery.md#goal)). Today the league lives on its own branch, never pushed to `main`, so neither its tables nor its data reach production until the owner says so ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build), "Where is the league built and tried?", owner 2026-10-28), and `npm run league-import` refuses any database off the local stack but the preview's (`localOrPreview` in `scripts/target.ts`, with `LEAGUE_TARGET=preview`), making the six players as test accounts where they are missing (`createTestPlayer`, `scripts/league-import.ts`). Discovery settles the rest: production gets the import once the owner has invited the real players so their accounts exist, the user map (`userMap`, `scripts/league-import.ts`) then pointing at those ("The import's first target?", owner 2026-10-28); and Elfo v Javi is played in the app, the owner saying when to rerun the import ([discovery → Results](discovery.md#results), owner 2026-10-29). No entry and no landed code reaches production. The owner settled the rest: `league` merges into `main` as soon as this entry lands; the six players already have production accounts; production data a migration or the import trips on may be deleted; the import runs once the merge has deployed and again when the owner says the app holds Elfo v Javi ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build), "When does the league go to production, and how?", owner 2026-10-29). Found by the mid-run gardener against the Goal, 2026-10-29.

**Do:**
- [ ] The import's production mode: the user map pointing at the six players' existing production accounts, making no account there and stopping on a player the map names with no account; the preview's run unchanged.
- [ ] How to run it against production in [How to Run and Deploy the Site → Import series 1's league](../../pkmn/site/how-to/run-and-deploy-the-site.md#import-series-1s-league), and its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack, the import in its production mode with the map pointing at accounts made by hand writes series 1's league and makes no account, and stops, naming the player, when one is missing; the preview's run prints what it printed before.
- Human-run: once this entry lands, `league` is merged into `main` (the orchestrator, on the owner's 2026-10-29 word), which deploys the league's migrations to production, deleting production data they trip on; the owner runs the import against production with the real map, checks series 1's league against the app (rounds, results, replays, standings, Pokémon League tries, eggs, every matchday team), reruns it when the app holds Elfo v Javi, then retires the Trainer League app.
- Reuse: `localOrPreview` (`scripts/target.ts`); `userMap` and the import's account checks (`scripts/league-import.ts`).
- Neighbors: the seed's refusal of production (`scripts/seed.ts`).
- Forbidden: a test account made in production; a pass pushing to `main` or writing to production.

**Touches:** `pkmn/site/scripts/league-import.ts`, `pkmn/site/scripts/target.ts`, `docs/pkmn/site/how-to/run-and-deploy-the-site.md`, `docs/pkmn/site/explanation/site.md`

## A closed cup hides a cup player's saves until their cup run ends

Discovery's closed mode shows "a match's two teams and both players' snapshots for it" once the match has its result ([discovery → Team Locking](discovery.md#team-locking)), and a cup team is built from its player's Tournament snapshot ([The Cup](discovery.md#the-cup)). The closed round's hold in the save rule (`roundHolds` in `shared/league.ts`, fed by `seriesSaves` in `api/_lib/series-data.ts`) covers round matches only, so in a closed cup every cup player who has reached the Tournament still sees the others' Tournament snapshots. The owner settled it: a cup player's Tournament snapshot and any later save of theirs are seen only by them and admins until their last cup match has a result ([discovery → Team Locking](discovery.md#team-locking), "In a closed cup, when do its players' saves show?", owner 2026-10-29). Found by the closed round snapshots' validator, 2026-10-29.

**Do:**
- [ ] The closed cup's hold in the save rule: each cup entrant's Tournament snapshot and later saves held from every reader but them and admins while the cup is closed and the entrant has a cup match without a result still ahead of them, fed by `seriesSaves`.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, by its routes: in a closed cup, Blue cannot open Red's Tournament snapshot or a later save, find its Pokémon in the abilities search or add it as a team source while Red has a cup match to play, nor can Leaf; once Red's last cup match has a result they can; in an open cup they can throughout.
- Human-run: none until a series uses a closed cup.
- Reuse: `savesSeen` and `roundHolds` (`shared/league.ts`); `seriesSaves` (`api/_lib/series-data.ts`); the cup's reveal in `revealed()`.
- Neighbors: the closed round's hold.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/shared/league.ts`, `pkmn/site/api/_lib/series-data.ts`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`
