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

## A closed round hides a player's pair until they lock their team

In a closed round, a player sees their own pair only once they have locked their round team, and so none of the round's pairs, nor who rests, since the others give their own away; everyone else sees a match's pair once both its players have locked ([discovery → Team Locking](discovery.md#team-locking)). The round's mode is stored on `league_round` (`api/_lib/schema.ts`, set by the admin's round opening in `api/_lib/rounds.ts`), round teams are made by `giveRoundTeams` (`api/_lib/rounds.ts`), and the lock with the cup teams' lock (`POST /api/teams/<id>/lock` and `/unlock`, `api/_lib/teams.ts`).

**Do:**
- [ ] A closed round's pairs hidden from each of its players until they lock, and from everyone else until that match's two players have both locked, enforced by the API wherever the pairs are handed out: the league page's rounds, head-to-head, the reader's rounds and next match, the series page's League summary, the match page, the team list's waiting note (`GET /api/teams/waiting`) and a round team's opponent in `GET /api/teams` (`api/_lib/teams.ts`).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open a closed round and see a player get no pair of it, by page or route, until they lock; a reader outside the league sees a match's pair only once its two players have locked; an admin, and the players of an open round, always see the pairs.
- Human-run: none until a series uses it.
- Reuse: the round's `mode` (`league_round` in `api/_lib/schema.ts`); the team lock (`POST /api/teams/<id>/lock`, `api/_lib/teams.ts`); the league read (`leagueOf` in `api/_lib/league.ts`).
- Neighbors: the series page's League summary (`src/pages/series.tsx`).
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`

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
**After:** Players see others' saves only up to their own round

## A round team's lock counts only the Pokémon its player may field

A round team may lock with fewer than six when its snapshot holds fewer living Pokémon (`lockNeeds` in `shared/league.ts`). The count it takes is every Pokémon in the snapshot's `pokemon`, legendaries and mythicals included (`livingOn` in `api/_lib/teams.ts`, `page.sources[0]?.snapshot.pokemon.length` in `src/pages/team.tsx`). But the rulebook bars legendaries and mythicals from every pokepaste ([Series 1 Rules → Rules in Every Battle](../../pkmn/series/1/reference/rules.md#rules-in-every-battle)) and lets a player with fewer alive bring what they have ([The League](../../pkmn/series/1/reference/rules.md#the-league)). So a player with five usable Pokémon and a legendary cannot lock without fielding the legendary. Found by the round teams' validator, 2026-10-29.

**Do:**
- [ ] `lockNeeds` fed the count of the snapshot's living Pokémon that are neither legendary nor mythical, by Showdown's tags (Restricted Legendary, Sub-Legendary, Mythical), on the lock route and on the team page alike.
- [ ] The round teams' build choice and the lock route's refusal in the site docs say so.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a round team on a snapshot with fewer than six usable Pokémon and a legendary locks with just the usable ones, by page and route; "Fill <n> slots" names that count; a cup team still needs all eight.
- Human-run: none.
- Reuse: `lockNeeds` (`shared/league.ts`); the species tags as `src/teams/dex.ts` reads them, through `dexFor` (`shared/dex.ts`), which the API can load.
- Neighbors: the team pool's no-legendaries rule (`src/teams/dex.ts`).
- Forbidden: a second count worked out apart from `lockNeeds`; the rule written outside `shared/league.ts`.

**Touches:** `pkmn/site/shared/league.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/src/pages/team.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`

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

## League refusal messages read their numbers from `shared/league.ts`

The league's refusal messages write the rules' numbers as text ("fainted from 0 to 6", "1, 2, 3", "from 0 to 5", "one to six" in `api/_lib/league.ts`, in English and Spanish, and "Bo3" in `src/pages/league-match.tsx`), while discovery keeps every rule in `shared/league.ts` ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build)); a changed rule would leave them wrong. Found by the mid-run review, 2026-10-29.

**Do:**
- [ ] Build those messages from `FAINTED_PER_GAME`, `MATCH_GAMES`, `LEAGUE_COMBATS`, `PARTY_SIZE` and `GAMES_TO_WIN`.
- [ ] The cup's ban and pick refusals that landed since (84ac5ff) too: "one of the other's eight" / "uno de los ocho del otro" (`badBan`) from `CUP_TEAM_SIZE`, and "Your six for this game are in" / "Tus seis para esta partida ya están" (`picked`) from `CUP_BROUGHT`, in `api/_lib/league.ts`. Found by the gardener, 2026-10-29.

**Acceptance:**
- Claude-run: `npm run gate`; `grep` finds none of those literals in the messages, the cup's "eight" and "six" included; through `verify-site`, an admin's bad game and a bad try still show their refusals in English and Spanish, and so do a cup ban sent twice and a six sent twice.
- Human-run: none.
- Reuse: the constants in `shared/league.ts`.
- Neighbors: the round routes' messages (`api/_lib/rounds.ts`).
- Forbidden: a rule number written into a message.

**Touches:** `pkmn/site/api/_lib/league.ts`, `pkmn/site/src/pages/league-match.tsx`
