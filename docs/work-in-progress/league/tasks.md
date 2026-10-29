# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## What becomes of a cup game's bans and picks when what they rest on changes?

A ban is stored as a place in the other player's locked team of eight, and a six as places in the player's own (`league_game_side`; The pkmn Site → Decisions, the bans and picks' build choices). Whether a ban is barred follows from who won the game before (`barredBan` in `shared/league.ts`). Two admin moves change what these rest on and leave them standing:
- `fixGame` (`api/_lib/match.ts`) rewriting an earlier game's winner after the next game's bans are in. That can leave a ban the rule now bars, or keep barring one it no longer should.
- `POST /api/teams/<id>/unlock` (`api/_lib/teams.ts`) on a cup team after bans or sixes are in. Its owner may then move or swap the Pokémon that a stored place points at.

Only a pairing that `settleCup` changes clears them (`api/_lib/cup.ts`). Series 1's cup is open, so it has bans. Found by the gardener, 2026-10-29.

**Do:**
- [ ] Once answered, the chosen handling in the match module and the team unlock, with its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, from the seed's Series 2 final at game 2's bans, the answered behaviour after an admin fixes game 1's winner and after an admin unlocks a final team.
- Human-run: none.
- Reuse: `fixGame` and `banIn` (`api/_lib/match.ts`); `barredBan` (`shared/league.ts`); the unlock route (`api/_lib/teams.ts`).
- Neighbors: `settleCup`'s clearing of a changed match's sides (`api/_lib/cup.ts`).
- Forbidden: settling either case without the owner's answer.

**Touches:** `pkmn/site/api/_lib/match.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/shared/league.ts`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** when an admin fixes a cup game's winner after the next game's bans are in, do that game's bans and sixes stand, or are they cleared so it is banned again? And when an admin unlocks a cup team whose match already has bans or sixes, are they cleared, kept as places, or is the unlock refused while they stand?

## Players see others' saves only up to their own round

A player sees another's snapshots only from their own round or older; someone outside the series only once every player has reached the snapshot's round; admins all ([discovery → Team Locking](discovery.md#team-locking)). Enforced wherever a snapshot is handed out: the PC, the player's series page and its journey, the abilities search and team sources.

**Do:**
- [ ] A player's and a snapshot's round from the round milestones.
- [ ] The rule on every snapshot route: the PC (`GET …/trainers/<player>/pc`), the journey (`GET …/trainers/<player>/journey`) and the abilities search (`GET …/abilities`) in `api/_lib/series.ts`, the series page's trainer rows (`api/_lib/series-data.ts`), and the snapshots a team starts from and its sources (`GET /api/teams/snapshots`, `GET /api/teams/<id>` in `api/_lib/teams.ts`).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with Red at Gym 3 and Blue at Gym 2, Blue cannot open Red's Gym 3 or Gym 4 PC, find it in the abilities search or add it as a source, by page or route, and can once Blue uploads Gym 3; a player of another series sees it only once every player is at Gym 3; a series without round milestones hides nothing.
- Human-run: the owner checks it on the preview as two of series 1's players.
- Reuse: `MILESTONE_MARKS` (`shared/series.ts`); `findShown`, `plays` and `viewer` (`api/_lib/series-data.ts`). `api/_lib/access.ts` is only the signed-in and allowed gate on every route, not a per-snapshot check.
- Neighbors: the PC and abilities routes.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**Attempted once:** 2026-10-29, the work kept on branch `wq/saves-up-to-own-round`; its validator failed round two: the PC's "Add to team" (`src/teams/components/add-to-team.tsx`) `PUT`s a team whose hidden source `GET /api/teams/<id>` cut down, and `PUT /api/teams/<id>` refuses only new hidden `sources`, not `slots`, so the write repoints members; the fix left is refusing `slots` on a team holding a source the writer may not see, and leaving such teams out of "Add to team".
**Needs the author:** a player's round counts only their snapshots at round milestones (`savesSeen` on the branch), so a player who uploaded no round milestone, only their Tournament save, is at round 0 and sees no one's Tournament snapshot, while the rulebook's open sheet has each cup player know the other's full sheet ([Series 1 Rules → Final Tournament](../../pkmn/series/1/reference/rules.md#final-tournament)). Does a snapshot at a later milestone (the Tournament included) count as reaching every round before it, or does the open cup's sheet override the save rule, or does it stand as written?

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

## A closed round tells a player still without their round team to upload, not to lock

In a closed round, `pairsHidden` (`shared/league.ts`) holds back every pair from a player of the round whose match has no result and who has not locked, and marks it as their own lock (`hidden.yours`) whether or not they have a team. So a player still waiting on their snapshot at the round's milestone, with no team to lock (`GET /api/teams/waiting`), reads "Lock your round team to see who you meet" in place of their next match (`LockToSee` in `src/pages/league.tsx`) and "Lock your round team to see this round's pairs" on the round's card (`RoundCard` there, `CurrentRound` in `src/pages/series.tsx`). Their own match page answers 404 while it is hidden (`matchOf` over `leagueOf`, `api/_lib/league.ts`), though [The pkmn Site → League](../../pkmn/site/explanation/site.md#league)'s round teams paragraph says the match page tells a waiting player which milestone to reach. The same doc's match page paragraph still calls a played round match with no team "an imported one until imported teams land with their entry", which landed (the imported game teams, 2026-10-29), and its decisions leave "No team on the site yet" (the match page's build choices) and the closed round's hidden pairs (the rounds' draw build choices) to entries that have landed. Found by the end-of-run gardener, 2026-10-29.

**Do:**
- [ ] The round's `hidden` (`leagueRound` in `shared/league.ts`) says when the reader's own team is still missing, with its milestone, worked out in `leagueOf` from the round teams it already loads; the next-match slot and the round card then read the team list's waiting line ("Reach <milestone> and upload its snapshot to get your team", `waiting` in `src/pages/teams.tsx`), in English and Spanish, on the league page and the series page's summary, and the lock prompts only to a player who has a team to lock.
- [ ] The pkmn Site → League says so, and its round teams paragraph says a closed round's waiting player is told on the team list and the league page, not on the match page.
- [ ] In passing, the match page paragraph's "an imported one until imported teams land with their entry" and the two decisions pointing at landed entries say what is true now.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in a closed round, a player with no snapshot at its milestone reads the upload line on Overview, on the round card and on the series page's League summary, and still sees no pair, opponent or who rests; once they upload it and before they lock, the lock prompts; once locked, their match. `grep -n "until imported teams land" docs/pkmn/site/explanation/site.md` finds nothing.
- Human-run: none until a series uses a closed round.
- Reuse: `pairsHidden` and the round's `hidden` (`shared/league.ts`); the round teams `leagueOf` loads (`api/_lib/league.ts`); `LockToSee`; the team list's `waiting` line.
- Neighbors: the match page's "Upload your <milestone> snapshot to get your round team" (`src/pages/league-match.tsx`).
- Forbidden: showing the waiting player any pair, their opponent or who rests; a second hiding rule apart from `pairsHidden`; hiding in the browser only.

**Touches:** `pkmn/site/shared/league.ts`, `pkmn/site/api/_lib/league.ts`, `pkmn/site/src/pages/league.tsx`, `pkmn/site/src/pages/series.tsx`, `docs/pkmn/site/explanation/site.md`

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
