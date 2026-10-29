# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## A Pokémon League try's team and members follow the save rule

A try's team is never private but follows the save rule as a milestone's PC does: a player sees another's try team, and on the league page its members and the combat each fell in, only once they have reached the Pokémon League themselves; someone outside the series once every player has; admins always ([discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). Today a try's team is made public when its try locks it (`lockTryTeam` in `api/_lib/teams.ts`, The Team Builder → Decisions, "The locked teams' visibility build choices"), and the Pokémon League view lists every try's members to every reader (`src/league/tries.tsx`, fed by `leagueOf` in `api/_lib/league.ts`).

**Do:**
- [ ] A try's team, by `GET /api/teams` and `GET /api/teams/<id>`, and a try's members and falls in the league read, held back from a reader the save rule does not yet let see the Pokémon League, its combats won and pips still shown; the try's team never marked private.
- [ ] The Team Builder's and The pkmn Site's visibility decisions rewritten to say so.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with Red's try logged and Blue short of the Pokémon League, Blue sees Red's combats won but not the try's members or its team, by page or route, and does once Blue reaches it; an admin always sees them; the try's team shows no Private tag.
- Human-run: none.
- Reuse: the save rule (`savesSeen` in `shared/league.ts`, `savesSeenBy` in `api/_lib/series-data.ts`; [The pkmn Site → Snapshots](../../pkmn/site/explanation/site.md#snapshots), "Whose saves a reader sees"); `lockTryTeam` (`api/_lib/teams.ts`); `leagueOf` (`api/_lib/league.ts`).
- Neighbors: the profile's league record, which shows the best try's pips.
- Forbidden: hiding in the browser only; a try's team marked private.

**Touches:** `pkmn/site/api/_lib/teams.ts`, `pkmn/site/api/_lib/league.ts`, `pkmn/site/shared/`, `pkmn/site/src/league/tries.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`

## A closed round hides its snapshots until the match has a result

In a closed round, each player's snapshot at the round's milestone is seen only by its owner and admins until their match has a result: their PC at that snapshot, the abilities search, and as a source in others' team builds. While that match is unplayed, each player's later saves stay hidden from the other too. An open round leaves them to the series' save rule ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] The hidden round snapshot, and the opponents' later saves, on the save rule's routes.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in a closed round, a second test player cannot open the first's round snapshot, find its Pokémon in the abilities search, or add it as a team source, by page or route, until the match has a result, nor the first's later saves once both have moved on; in an open round they can.
- Human-run: none until a series uses it.
- Reuse: the save rule (`savesSeen` in `shared/league.ts`, `savesSeenBy` in `api/_lib/series-data.ts`; [The pkmn Site → Snapshots](../../pkmn/site/explanation/site.md#snapshots), "Whose saves a reader sees"); the reveal of the league teams' reveal (`revealed()` in `api/_lib/series-data.ts`).
- Neighbors: the PC and abilities routes.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`

## A league team whose snapshot an admin moves off its milestone is copied and starts over

A round team is sourced from its player's snapshot at the round's milestone, and a cup team from their Tournament snapshot ([discovery → Team Locking](discovery.md#team-locking), [The Cup](discovery.md#the-cup)). The passes that make them (`giveRoundTeams` in `api/_lib/rounds.ts`, `giveCupTeams` in `api/_lib/cup.ts`) give a source only to a team that has none, so when an admin moves that snapshot to another milestone (`POST …/trainers/<player>/snapshots/<milestone>/move`, `api/_lib/overrides.ts`) the team keeps the moved snapshot. The owner settled it: when the team's match has no result, locked or not, its members are copied into a new "Any Pokémon" team of the player's own, and the round or cup team starts over, unlocked and empty, on the snapshot now at its milestone, or waits for the player's upload; a team whose match has a result keeps its snapshot ([discovery → Team Locking](discovery.md#team-locking), owner 2026-10-29). Found by the round teams' validator, 2026-10-29.

**Do:**
- [ ] On an admin's snapshot move, in the move's transaction: each round or cup team sourced from it on a match without a result copied to a new Any Pokémon team of its owner (members kept, unlocked, private), then emptied, unlocked and stripped of that source, the passes then giving it the milestone's current snapshot or leaving it waiting.
- [ ] Its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, an admin moves a player's round snapshot to another milestone: the player finds an Any Pokémon copy of their round team in their list, and the round team is empty and unlocked, waiting on the save; they upload at the round's milestone and the team takes that snapshot; a team on a played match keeps its snapshot; the same for a cup team and the Tournament snapshot.
- Human-run: none.
- Reuse: `giveRoundTeams` and `giveCupTeams`; the snapshot move (`api/_lib/overrides.ts`); a team's Clone (`POST /api/teams/<id>/clone`, `api/_lib/teams.ts`).
- Neighbors: the cup pass's deletion of a team moved out of its match (`giveCupTeams`).
- Forbidden: a team pointing at a snapshot that does not exist; a team on a match with a result changed.

**Touches:** `pkmn/site/api/_lib/rounds.ts`, `pkmn/site/api/_lib/cup.ts`, `pkmn/site/api/_lib/overrides.ts`, `pkmn/site/api/_lib/teams.ts`, `docs/pkmn/site/explanation/site.md`

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

**Touches:** `pkmn/site/api/_lib/match.ts`, `pkmn/site/api/_lib/teams.ts`, `pkmn/site/shared/team.ts`, `pkmn/site/src/pages/league-match.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/explanation/team-builder.md`

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

**Touches:** `pkmn/site/src/pages/league.tsx`, `docs/pkmn/site/explanation/site.md`
