# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, checks its flow through the `verify-site` skill (in the browser when it changes a page, by its routes and the database when it changes only the API or shared logic; `pkmn/site/CLAUDE.md`), builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## An admin logs a player's try, changes a try's team and fixes a locked league team in place

The Goal has an admin able to "enter and fix any of it (rounds, results, replays, standings, Pokémon League tries, eggs, every matchday team)" ([discovery → Goal](discovery.md#goal)). Today `POST /api/series/<n>/league/tries` answers 403 to an admin (`api/_lib/league.ts`, the `notPlayer` refusal), Edit opens a try without its team section ([The pkmn Site → League](../../pkmn/site/explanation/site.md#league), "Pokémon League tries"), and a team page gives editing to its owner alone (`canEdit: mine && !locked && …`, `GET /api/teams/<id>` in `api/_lib/teams.ts`), so an admin fixes a locked team only by unlocking it, which does nothing for an imported team whose player has no real account yet. The owner settled it: an admin logs a try on any player's behalf, changes a logged try's team, and edits a locked league team's members in place, each through the same checks as the player's own write, with who last fixed a team and when kept and shown, as the Eggs override is ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs), owner 2026-10-29). Found by the mid-run gardener against the Goal, 2026-10-29.

**Do:**
- [ ] An admin logging a try for any player of the series: the log dialog's player picker for an admin, the route taking the player, the team picked from that player's teams or pasted, through the player's own checks.
- [ ] An admin's Edit of a try with its team section: another team of the try's player or a paste, the new try team locked as logging locks it, the old one unlocked back into its owner's list.
- [ ] An admin editing a locked league team's members on its page, through `PUT /api/teams/<id>`'s checks, the team staying locked; who last fixed it and when stored on the team (a migration, and the seed giving one fixed team) and shown on its page, as the Eggs override shows its own.
- [ ] Its decisions in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions) and [Team Builder](../../pkmn/site/explanation/team-builder.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in the browser since the dialog and the team page change: signed in as `admin` on the seed's Series 1, an admin logs a try for Blue with one of Blue's teams and with a paste, changes Red's try's team and finds the old one unlocked in Red's list, and fixes a member of a locked round team, which stays locked and shows the admin and the time; a player's own log, edit and team edit are unchanged, and a player still cannot edit a locked team.
- Human-run: none.
- Reuse: the try routes (`api/_lib/league.ts`) and the log dialog (`src/league/try-dialog.tsx`); the team page's editor and `PUT /api/teams/<id>` (`api/_lib/teams.ts`); `lockTryTeam`; the Eggs cell's admin override, which records who set it and when.
- Neighbors: the unlock route, unchanged.
- Forbidden: a control hidden in the browser only; an admin's write skipping a check the player's own write goes through.

**Touches:** `pkmn/site/api/_lib/league.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/api/_lib/schema.ts`, `pkmn/site/drizzle/`, `pkmn/site/scripts/seed.ts`, `pkmn/site/shared/`, `pkmn/site/src/league/`, `pkmn/site/src/pages/team.tsx`, `pkmn/site/src/teams/`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`, `docs/pkmn/site/how-to/verify-the-site.md`

## A `league` milestone mark sets when others' tries and later saves show

A try's members and team show to another player "only once they have reached the Pokémon League themselves" ([discovery → Team Locking](discovery.md#team-locking)). No milestone marks the Pokémon League (`MILESTONE_MARKS` is `none`, `round` and `tournament`, `shared/series.ts`), so the try teams' pass placed it at the series' last round (`leagueSeen` answers `last <= upTo`, `shared/league.ts`), and the save rule lets a Gym 7 player open others' saves past it, which hold those tries' Pokémon. The owner settled it: a fourth mark, `league`, set by an admin on the milestone at the League's door; series 1's become Victory Road (marked `league`) and Hall of Fame (replacing Post-League); others' tries show from a save at the `league` milestone or later, and the mark is one more step of the save rule, so others' saves at it or later show only from there; a series without the mark keeps its last round ([discovery → Team Locking](discovery.md#team-locking), "When has a player reached the Pokémon League?", owner 2026-10-29). The upload suggests a save with a Hall of Fame entry the milestone whose name holds "league" (`suggestMilestone`, `shared/save-upload.ts`), which Hall of Fame does not. Found by the mid-run gardener, 2026-10-29.

**Do:**
- [ ] `league` in `MILESTONE_MARKS` (a migration if the column needs one), offered in the admin series form's mark picker in English and Spanish, at most one milestone per series.
- [ ] `leagueSeen` and the save rule's reach (`reach`, `savesSeen`, `shared/league.ts`) reading the `league` milestone as one more step after the last round, and the last round when a series has none.
- [ ] `suggestMilestone` suggesting a save with a Hall of Fame entry the milestone after the `league` one, falling back to today's name match.
- [ ] The seed's series 1 and 2 milestones ending Gym 8, Victory Road (`league`), Hall of Fame, Tournament, and its fallback milestone Hall of Fame; the league import's milestone mapping if it names Post-League.
- [ ] The decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions), replacing "The try teams' save rule, build choices"' last-round reading, and the held-back line's wording if it names the League.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, by its routes, except the series form's mark picker in the browser: on the seed's Series 1 with Red's try logged and Red's snapshots at Victory Road and Hall of Fame, Blue at Gym 7 sees neither the try's members and team nor Red's Victory Road or Hall of Fame PC, abilities or team sources; at Victory Road Blue sees both; Leaf, outside the series, once every player has a Victory Road save; with the mark removed, Blue sees them from Gym 7 as before; an upload of a save with a Hall of Fame entry suggests Hall of Fame.
- Human-run: the owner adds Victory Road and renames Post-League to Hall of Fame in series 1's form on the preview and on production once the league is live.
- Reuse: `leagueSeen`, `reach` and `savesSeen` (`shared/league.ts`); `leaguesSeenBy` and `seriesSaves` (`api/_lib/series-data.ts`); the series form's mark picker; `suggestMilestone`.
- Neighbors: the `tournament` mark, at most one per series.
- Forbidden: hiding in the browser only; matching the milestone by its name.

**Touches:** `pkmn/site/shared/series.ts`, `pkmn/site/shared/league.ts`, `pkmn/site/shared/save-upload.ts`, `pkmn/site/api/_lib/series-data.ts`, `pkmn/site/api/_lib/schema.ts`, `pkmn/site/drizzle/`, `pkmn/site/scripts/seed.ts`, `pkmn/site/scripts/league-import.ts`, `pkmn/site/src/pages/admin-series.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/run-and-deploy-the-site.md`, `docs/pkmn/site/how-to/verify-the-site.md`

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
