# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## An admin's fix or unlock never leaves a cup game's bans and picks standing on what changed

A ban is stored as a place in the other player's locked team of eight, and a six as places in the player's own (`league_game_side`; The pkmn Site → Decisions, the bans and picks' build choices); whether a ban is barred follows from who won the game before (`barredBan` in `shared/league.ts`). Two admin moves leave them standing today: `fixGame` (`api/_lib/match.ts`) rewriting an earlier game's winner after the next game's bans are in, and `POST /api/teams/<id>/unlock` (`api/_lib/teams.ts`) on a cup team after bans or sixes are in. The owner settled both: a changed winner clears the bans and picks of the match's next game without a result, games with a result keeping theirs, and a cup team cannot be unlocked while a game of its match without a result has bans or picks in ([discovery → The Match Page](discovery.md#the-match-page), owner 2026-10-29). Found by the gardener, 2026-10-29.

**Do:**
- [ ] `fixGame` clearing the next unplayed game's sides when the winner it rewrites changes, in the same transaction.
- [ ] The unlock route refusing (409) a cup team whose match has an unplayed game with a ban or a six in, in English and Spanish.
- [ ] Their decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, from the seed's Series 2 final at game 2's bans: an admin fixing game 1's winner clears game 2's bans and both ban again; a fix that keeps the winner clears nothing; an admin's unlock of a final team is refused while game 2 has a ban in, and goes through once the match has no unplayed game with one.
- Human-run: none.
- Reuse: `fixGame` and `banIn` (`api/_lib/match.ts`); `barredBan` (`shared/league.ts`); the unlock route (`api/_lib/teams.ts`).
- Neighbors: `settleCup`'s clearing of a changed match's sides (`api/_lib/cup.ts`).
- Forbidden: a game's sides cleared outside the match module.

**Touches:** `pkmn/site/api/_lib/match.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/shared/league.ts`, `docs/pkmn/site/explanation/site.md`

## Players see others' saves only up to their own round

A player sees another's snapshots only from their own round or older; someone outside the series only once every player has reached the snapshot's round; admins all ([discovery → Team Locking](discovery.md#team-locking)). Enforced wherever a snapshot is handed out: the PC, the player's series page and its journey, the abilities search and team sources.

**Do:**
- [ ] A player's and a snapshot's round from the round milestones: a player's round is the round of their latest snapshot at any milestone, not only at a round milestone, so a Tournament save alone reaches every round ([discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). The kept branch `wq/saves-up-to-own-round` reads only round-milestone snapshots in `savesSeen`; change that, and refuse `slots` on a `PUT` of a team holding a source the writer may not see, as its **Attempted once:** line says.
- [ ] The rule on every snapshot route: the PC (`GET …/trainers/<player>/pc`), the journey (`GET …/trainers/<player>/journey`) and the abilities search (`GET …/abilities`) in `api/_lib/series.ts`, the series page's trainer rows (`api/_lib/series-data.ts`), and the snapshots a team starts from and its sources (`GET /api/teams/snapshots`, `GET /api/teams/<id>` in `api/_lib/teams.ts`).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with Red at Gym 3 and Blue at Gym 2, Blue cannot open Red's Gym 3 or Gym 4 PC, find it in the abilities search or add it as a source, by page or route, and can once Blue uploads Gym 3; a player of another series sees it only once every player is at Gym 3; a series without round milestones hides nothing.
- Human-run: the owner checks it on the preview as two of series 1's players.
- Reuse: `MILESTONE_MARKS` (`shared/series.ts`); `findShown`, `plays` and `viewer` (`api/_lib/series-data.ts`). `api/_lib/access.ts` is only the signed-in and allowed gate on every route, not a per-snapshot check.
- Neighbors: the PC and abilities routes.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**Attempted once:** 2026-10-29, the work kept on branch `wq/saves-up-to-own-round`; its validator failed round two: the PC's "Add to team" (`src/teams/components/add-to-team.tsx`) `PUT`s a team whose hidden source `GET /api/teams/<id>` cut down, and `PUT /api/teams/<id>` refuses only new hidden `sources`, not `slots`, so the write repoints members; the fix left is refusing `slots` on a team holding a source the writer may not see, and leaving such teams out of "Add to team".

## A Pokémon League try's team and members follow the save rule

A try's team is never private but follows the save rule as a milestone's PC does: a player sees another's try team, and on the league page its members and the combat each fell in, only once they have reached the Pokémon League themselves; someone outside the series once every player has; admins always ([discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). Today a try's team is made public when its try locks it (`lockTryTeam` in `api/_lib/teams.ts`, The Team Builder → Decisions, "The locked teams' visibility build choices"), and the Pokémon League view lists every try's members to every reader (`src/league/tries.tsx`, fed by `leagueOf` in `api/_lib/league.ts`).

**Do:**
- [ ] A try's team, by `GET /api/teams` and `GET /api/teams/<id>`, and a try's members and falls in the league read, held back from a reader the save rule does not yet let see the Pokémon League, its combats won and pips still shown; the try's team never marked private.
- [ ] The Team Builder's and The pkmn Site's visibility decisions rewritten to say so.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with Red's try logged and Blue short of the Pokémon League, Blue sees Red's combats won but not the try's members or its team, by page or route, and does once Blue reaches it; an admin always sees them; the try's team shows no Private tag.
- Human-run: none.
- Reuse: the save rule of [Players see others' saves only up to their own round](#players-see-others-saves-only-up-to-their-own-round); `lockTryTeam` (`api/_lib/teams.ts`); `leagueOf` (`api/_lib/league.ts`).
- Neighbors: the profile's league record, which shows the best try's pips.
- Forbidden: hiding in the browser only; a try's team marked private.

**Touches:** `pkmn/site/api/_lib/teams.ts`, `pkmn/site/api/_lib/league.ts`, `pkmn/site/shared/`, `pkmn/site/src/league/tries.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`
**After:** Players see others' saves only up to their own round

## Do a closed round's standings hide the matches its pairs hide?

A closed round hides a match's pair from a player who has not locked, and from everyone else until both its players have locked or it has a result (`pairsHidden` in `shared/league.ts`, The pkmn Site → Decisions, "The closed round's pairs, build choices"). The standings are still worked out from every match (`standings(…)` in `leagueOf`, `api/_lib/league.ts`), so a hidden match that already has a result moves its players' W–L and points, and a tie's note ("Beat <name>") can name its other side ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] As the author decides.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in a closed round with one match decided and hidden from a reader, the reader's standings follow the decision.
- Human-run: none.
- Reuse: `pairsHidden` (`shared/league.ts`); `standings` and `leagueOf`.
- Neighbors: the series page's League summary and the profile's league record, which read the same standings.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/_lib/league.ts`, `pkmn/site/shared/league.ts`, `pkmn/site/src/`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** in a closed round, does a reader's standings leave out a match whose pair is hidden from them, results and tie notes included, or do the standings count every result as they do now?

## A closed round hides its snapshots until the match has a result

In a closed round, each player's snapshot at the round's milestone is seen only by its owner and admins until their match has a result: their PC at that snapshot, the abilities search, and as a source in others' team builds. While that match is unplayed, each player's later saves stay hidden from the other too. An open round leaves them to the series' save rule ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] The hidden round snapshot, and the opponents' later saves, on the save rule's routes.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in a closed round, a second test player cannot open the first's round snapshot, find its Pokémon in the abilities search, or add it as a team source, by page or route, until the match has a result, nor the first's later saves once both have moved on; in an open round they can.
- Human-run: none until a series uses it.
- Reuse: the save rule of [Players see others' saves only up to their own round](#players-see-others-saves-only-up-to-their-own-round); the reveal of the league teams' reveal (`revealed()` in `api/_lib/series-data.ts`).
- Neighbors: the PC and abilities routes.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Players see others' saves only up to their own round

## What becomes of a league team whose snapshot an admin moves off its milestone?

A round team is sourced from its player's snapshot at the round's milestone, and a cup team from their Tournament snapshot ([discovery → Team Locking](discovery.md#team-locking), [The Cup](discovery.md#the-cup)). The passes that make them (`giveRoundTeams` in `api/_lib/rounds.ts`, `giveCupTeams` in `api/_lib/cup.ts`) give a source only to a team that has none. So when an admin moves that snapshot to another milestone (`POST …/trainers/<player>/snapshots/<milestone>/move`, `api/_lib/overrides.ts`), the team keeps the moved snapshot as its source, and a snapshot uploaded at the right milestone afterwards never becomes it. Found by the round teams' validator, 2026-10-29.

**Do:**
- [ ] Once answered, both passes follow the answer on an admin's move and on an upload, with its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, an admin moves a player's round snapshot to another milestone and the player uploads a new one at the round's milestone: their round team and cup team show the answered source.
- Human-run: none.
- Reuse: `giveRoundTeams` and `giveCupTeams`; the snapshot move (`api/_lib/overrides.ts`).
- Neighbors: the cup pass's deletion of a team moved out of its match (`giveCupTeams`).
- Forbidden: settling it without the owner's answer; a team pointing at a snapshot that does not exist.

**Touches:** `pkmn/site/api/_lib/rounds.ts`, `pkmn/site/api/_lib/cup.ts`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** when an admin moves a round or cup team's snapshot off its milestone, does the team keep it, move to whichever snapshot is now at the milestone (dropping the members picked from the old one), or go back to waiting on the save until one is there?

## What becomes of a round team whose match gets its result before it is locked?

An admin can record a round match's games whatever its teams' state: `recordGame` (`api/_lib/match.ts`) checks only the winner and the games' order, and both teams locked gates only a cup game's bans and picks (`started`, same file). Once the match is decided, the team list's waiting line drops it (`GET /api/teams/waiting` keeps only matches without a result, `api/_lib/teams.ts`), but an unlocked round team on it stays "To build" for good: `teamState` (`shared/team.ts`) reads only the lock, so the Teams tab's count (`GET /api/teams/to-build`) and the list's mark keep flagging it, and the lock route still locks it. Its reveal at the result (`revealed()` in `api/_lib/series-data.ts`) shows it while its owner can still change it. A cup game opens only on two locked teams, so only round matches reach this; series 1's round 5 Elfo v Javi does if its result is recorded on the site before Elfo locks. Found by the end-of-run gardener, 2026-10-29.

**Do:**
- [ ] Once answered, the chosen handling in the match module or the team routes, with its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, an admin records both games of a round match on the local stack while one of its teams is unlocked: the answered behaviour on the match page, the Teams tab's count and the team list.
- Human-run: none.
- Reuse: `recordGame` and `started` (`api/_lib/match.ts`); `teamState` (`shared/team.ts`); the to-build route (`api/_lib/teams.ts`).
- Neighbors: a cup game's gate on two locked teams (`started`).
- Forbidden: settling it without the owner's answer; the Teams tab's count and the list's mark disagreeing.

**Touches:** `pkmn/site/api/_lib/match.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/shared/team.ts`, `pkmn/site/src/pages/league-match.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`
**Needs the author:** when an admin records a round match's result while a player's round team is unlocked or still missing, is the result refused until both teams are locked (as a cup game opens only then), are the teams locked at the result, or do they stay unlocked and stop counting as to build?
