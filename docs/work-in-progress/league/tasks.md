# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## An opened round gives each player their team once their snapshot exists

A round, once an admin opens it, in either mode, gives each player a team sourced from their snapshot at its milestone, sized by the league's rules, as soon as that snapshot exists; until then their team list names the milestone to reach and upload. Locked and unlocked as a cup team ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] Round teams made when the round is open and the snapshot exists (on opening and on upload), their size named in `shared/league.ts`.
- [ ] The team list's Round kind chip in blue and their To build and Locked states, as the cup teams' entry wires the Cup's; the waiting note (no board draws it); the match shows both teams.
- [ ] Each side's round team state on the newest round's card, Locked, Building or Needs the save, as `league-draw.dc.html` draws it (The pkmn Site → Decisions, the rounds' draw build choices, leave it to this entry).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open round 2 with one test player at Gym 2 and one at Gym 1: the first gets the team, the second the note, and gets it on uploading Gym 2; the round card reads Building and Needs the save, then Locked once the first locks; in an open round, a match's teams show to others once both are locked; in a closed one, once it has a result.
- Human-run: none until a series uses it.
- Reuse: the lock and the team list's marks of the cup teams entry; the round opening (`openRound` in `api/_lib/rounds.ts`).
- Neighbors: the upload flow (`api/_lib/ingest.ts`).
- Forbidden: a team sourced from a snapshot that does not exist.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`

## Series 1's game teams come across from their replays, locked to their rounds

Each imported match gets one team per side, built from its games' replays together: the six brought with every move, item and ability any of them revealed, sourced "Any Pokémon" and locked to the player's round; a match with no replay (round 5's Dloez v Vicky, and Javi's side of the unplayed Elfo v Javi) takes the player's matchday paste instead, the hidden one included ([discovery → Results](discovery.md#results)). Placed here, above the later series' entries, since it brings series 1's league across.

**Do:**
- [ ] Extend the import: one team per side of a match from its replays' logs together (`|poke|` and what each battle revealed; `readLog` reads only the players, winner and faints today), the matchday paste for a match with no replay; show them in the match page's team columns.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, every played series 1 match shows both sides' teams, locked, one per side; a match with replays shows the six of their `|poke|` lines and every move they revealed; round 5's Dloez v Vicky shows the pastes' members.
- Human-run: the owner reads a few matches against their replays.
- Reuse: the replays' games the import already makes (`scripts/league-import.ts`); Showdown paste-in (`readShowdownTeam` in `src/teams/showdown.ts`) for the pastes; the match page's team columns (`src/pages/league-match.tsx`).
- Neighbors: the Pokémon League tries' pasted teams.
- Forbidden: a second Showdown paste parser; a paste overriding a replay.

**Touches:** `pkmn/site/scripts/`, `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** An opened round gives each player their team once their snapshot exists

## A closed round hides a player's pair until they lock their team

In a closed round, a player sees their own pair only once they have locked their round team, and so none of the round's pairs, nor who rests, since the others give their own away; everyone else sees a match's pair once both its players have locked ([discovery → Team Locking](discovery.md#team-locking)). The round's mode is stored on `league_round` (`api/_lib/schema.ts`, set by the admin's round opening in `api/_lib/rounds.ts`), round teams come with [An opened round gives each player their team once their snapshot exists](#an-opened-round-gives-each-player-their-team-once-their-snapshot-exists), and the lock with the cup teams' lock (`POST /api/teams/<id>/lock` and `/unlock`, `api/_lib/teams.ts`).

**Do:**
- [ ] A closed round's pairs hidden from each of its players until they lock, and from everyone else until that match's two players have both locked, enforced by the API wherever the pairs are handed out: the league page's rounds, head-to-head, the reader's rounds and next match, the series page's League summary and the match page.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open a closed round and see a player get no pair of it, by page or route, until they lock; a reader outside the league sees a match's pair only once its two players have locked; an admin, and the players of an open round, always see the pairs.
- Human-run: none until a series uses it.
- Reuse: the round's `mode` (`league_round` in `api/_lib/schema.ts`); the lock of the cup teams entry; the league read (`leagueOf` in `api/_lib/league.ts`).
- Neighbors: the series page's League summary (`src/pages/series.tsx`).
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** An opened round gives each player their team once their snapshot exists

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
**After:** An opened round gives each player their team once their snapshot exists; Players see others' saves only up to their own round

## The player profile shows each series' league record

The profile's league placeholder becomes, per series, the player's place, points, W–L, their best Pokémon League try's pips and how far they went in the cup, as `player-profile.dc.html` and `player-profile-phone.dc.html` draw it ([discovery → Surfaces](discovery.md#surfaces)).

**Do:**
- [ ] Extend `GET /api/profiles/<player>` (`api/_lib/profiles.ts`, `profilePage` in `shared/profile.ts`) and the profile.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a series 1 player's profile matches the standings, their best try and the cup.
- Human-run: none.
- Reuse: `standings` and `bestTries` in `shared/league.ts`, fed as the league read (`leagueOf` in `api/_lib/league.ts`) feeds them.
- Neighbors: the profile's totals (`src/pages/player-profile.tsx`).
- Forbidden: working the standings out a second way.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/profile.ts`, `pkmn/site/src/pages/player-profile.tsx`, `docs/pkmn/site/`

## League refusal messages read their numbers from `shared/league.ts`

The league's refusal messages write the rules' numbers as text ("fainted from 0 to 6", "1, 2, 3", "from 0 to 5", "one to six" in `api/_lib/league.ts`, in English and Spanish, and "Bo3" in `src/pages/league-match.tsx`), while discovery keeps every rule in `shared/league.ts` ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build)); a changed rule would leave them wrong. Found by the mid-run review, 2026-10-29.

**Do:**
- [ ] Build those messages from `FAINTED_PER_GAME`, `MATCH_GAMES`, `LEAGUE_COMBATS`, `PARTY_SIZE` and `GAMES_TO_WIN`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep` finds none of those literals in the messages; through `verify-site`, an admin's bad game and a bad try still show their refusals in English and Spanish.
- Human-run: none.
- Reuse: the constants in `shared/league.ts`.
- Neighbors: the round routes' messages (`api/_lib/rounds.ts`).
- Forbidden: a rule number written into a message.

**Touches:** `pkmn/site/api/_lib/league.ts`, `pkmn/site/src/pages/league-match.tsx`

## The cup starts only with two, four or six entrants

The rulebook draws the cup for six and a plain knockout for four or two, and nothing bigger ([Series 1 Rules → Final Tournament](../../pkmn/series/1/reference/rules.md#final-tournament), owner 2026-10-29). The cup's code starts any even size: powers of two as a plain knockout and every other size through the pattern "The cup's build choices" worked out ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions)).

**Do:**
- [ ] The largest cup named in `shared/league.ts` beside `CUP_MIN`; `startCup` and the start panel refuse more entrants, the refusal in English and Spanish.
- [ ] "The cup's build choices" rewritten to drop the pattern for ten, twelve and fourteen.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, an admin starting a cup with eight entrants is refused, by page and route; six, four and two still start.
- Human-run: none.
- Reuse: `CUP_MIN`, `cupShape` and `startCup` (`shared/league.ts`, `api/_lib/cup.ts`); the start panel's refusals.
- Neighbors: the cup's bracket (`cupSlots`).
- Forbidden: a cup size written as a number outside `shared/league.ts`.

**Touches:** `pkmn/site/shared/league.ts`, `pkmn/site/api/_lib/cup.ts`, `pkmn/site/src/`, `docs/pkmn/site/explanation/site.md`

## Rerunning the league import leaves an admin's hatched count alone

Each run of `npm run league-import` writes every player's hatched count from the app's dump, an admin's own setting included (`scripts/league-import.ts`, the `save` upsert); a rerun leaves an admin's setting alone, and a count still from the app takes the dump's again, timed by the rerun ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs), owner 2026-10-29).

**Do:**
- [ ] The import's hatched upsert skips a player whose count an admin set.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, run the import, set one player's count as the admin, rerun it: that player keeps the admin's count and who set it, and the others read the app's.
- Human-run: none.
- Reuse: the import's `save` upsert; `hatched_set_by` (`api/_lib/schema.ts`).
- Neighbors: the admin's Eggs override (`api/_lib/overrides.ts`).
- Forbidden: none.

**Touches:** `pkmn/site/scripts/league-import.ts`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`
