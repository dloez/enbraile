# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` before [Retire the Trainer League app](#retire-the-trainer-league-app), so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## Sign off the Teams list's league marks and filters

The frozen teams-list boards flag a round team and filter nothing; league teams need their kind, series and state shown, and the list filters by series, kind, state and owner ([discovery → Surfaces](discovery.md#surfaces)). Drawn on the Site v2 Screens canvas, desktop and phone, then frozen into `pkmn/site/design/`.

**Do:**
- [ ] Draw the boards on the canvas; freeze them once signed off.

**Acceptance:**
- Claude-run: none.
- Human-run: the owner signs off the boards.
- Reuse: the frozen `teams-list.dc.html` and `teams-list-phone.dc.html`.
- Neighbors: the league boards' filters, if any.
- Forbidden: building before sign-off.

**Touches:** `pkmn/site/design/`
**Needs the author:** the sign-off.

## The Teams list marks league teams and filters them

Each team shows its kind and, for a league team, its series, round or cup match and state; the list filters by series, kind, state and owner, as the signed-off boards draw them ([discovery → Surfaces](discovery.md#surfaces)). A league team files under its league's series, "Any Pokémon" or not.

**Do:**
- [ ] The kind, series and state on each team; the filters, kept in the URL as `?player=` is.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with imported tries and a free team, filter by each of series, kind, state and owner and see only the matching teams; reload and keep the filters.
- Human-run: the owner finds a player's league teams on the preview.
- Reuse: the team list (`src/pages/teams.tsx`, `sourceLine`), `GET /api/teams`.
- Neighbors: the owner filter (`?player=`).
- Forbidden: a league team without its series.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Sign off the Teams list's league marks and filters

## Players make their free teams public or private

Every team that is not a round or cup team gets a public/private toggle, private by default, the site's existing teams included; a private team is seen only by its owner and admins, by page and route ([discovery → Team Locking](discovery.md#team-locking)). Lands with the league's branch, so production's teams turn private only when the league ships.

**Do:**
- [ ] The toggle on the team page, its column with private as the default, and every team route honouring it.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a new team is private, a second test player cannot see it in the list, by page or route, until it is made public; a round team shows no toggle.
- Human-run: the owner flips a team on the preview.
- Reuse: the team routes (`api/_lib/teams.ts`), the Teams list's filters.
- Neighbors: the team page's read-only view of another's team.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** The Teams list marks league teams and filters them

## Are stats worked out from hidden EVs and IVs hidden too?

**Needs the author:** others' EVs and IVs are hidden on teams and in the PC ([discovery → Team Locking](discovery.md#team-locking)), but the stats worked out from them (the team analysis's Speed Tiers, Compare's damage calc) let a viewer read them back. Are others' stats worked out without their EVs and IVs, or hidden?

## Others' EVs and IVs are hidden

A team's EVs and IVs reach only its owner and admins, on every team, league or free, and so do a PC summary's, by page and route; everyone else gets the rest of the build, and Showdown copy without them. Worked-out stats as the author answers above.

**Do:**
- [ ] EVs and IVs left out of every team and PC summary the API hands to someone else, and wherever the answer above reaches.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a second test player opening the first's team sees no EVs or IVs on the page, in the route's JSON or in Copy for Showdown, nor in the first's PC summaries; the owner and an admin see them.
- Human-run: the owner checks a team as two players on the preview.
- Reuse: the team routes (`api/_lib/teams.ts`), Showdown copy (`src/teams/showdown.ts`).
- Neighbors: the free teams' public/private toggle.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Players make their free teams public or private; Are stats worked out from hidden EVs and IVs hidden too?

## Sign off the hatched eggs override

The frozen league boards show eggs won and hatched on the desktop standings, eggs won alone on the phone, and no way to set a hatched count ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs)). The admin's in-place override on the Eggs cell, showing who set it and when, is drawn on the Site v2 Screens canvas, desktop and phone, then frozen into `pkmn/site/design/`.

**Do:**
- [ ] Draw the override on the league boards; freeze them once signed off.

**Acceptance:**
- Claude-run: none.
- Human-run: the owner signs off the boards.
- Reuse: the frozen `league.dc.html` and `league-phone.dc.html`; the series page's admin overrides (`series.dc.html`).
- Neighbors: none.
- Forbidden: building before sign-off.

**Touches:** `pkmn/site/design/`
**Needs the author:** the sign-off.

## The standings count eggs won and hatched

Eggs won from the rulebook (league wins, the best try's combats), hatched counted from each player's latest snapshot, with an admin override that keeps who set it and when; the import brings the app's hatched counts as overrides ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs)).

**Do:**
- [ ] Count hatched Pokémon from the snapshot (`obtained.hatchedAt`, living and fainted).
- [ ] The override, its in-place editor on the Eggs cell, and the eggs columns, as the signed-off boards draw them.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a seeded snapshot with hatched Pokémon gives its count, an admin override wins over it and shows its source.
- Human-run: the owner reads series 1's eggs against the app.
- Reuse: the site's admin overrides (`api/_lib/`, The pkmn Site → Admin overrides).
- Neighbors: the snapshot fainted count's override.
- Forbidden: eggs for cup wins.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Sign off the hatched eggs override

## An admin runs the cup from its bracket to its champion

An admin starts the cup and picks who enters; the bracket is drawn from the standings in the rulebook's pattern for any size, the losers' group with its own tie-breaks; the admin enters each cup match's result as a league match's; winners move on to the champion ([discovery → The Cup](discovery.md#the-cup)). Teams join in the next entry.

**Do:**
- [ ] Schema for the cup and its matches; the bracket, group and seeding in `shared/league.ts`.
- [ ] The Cup view, starting it, and results in place.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, start series 1's cup with six and see 1–6, 2–5, 3–4, the triangular and the rulebook's semifinals; a 1–1–1 triangular broken by its tie-breaks; also a four-player cup as a plain knockout.
- Human-run: the owner starts series 1's real cup.
- Reuse: the match page (`src/pages/league-match.tsx`) and its moves (`api/_lib/match.ts`); the app's `buildBracket`, `losersTable` and `settleBracket` as reference only.
- Neighbors: the series page's tournament milestone.
- Forbidden: the app's semifinal pairing (1–6 with the triangular).

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**Needs the author:** a cup with an odd number of entrants (5 or 7): how its first round pairs, since the rulebook's pattern leaves one player without an opponent; the start-the-cup board keeps Start off for an odd count (raised in the design, 2026-10-28).

## Each cup match gives its players a locked team to build

A cup match gives each of its players a team of eight sourced from their Tournament snapshot, flagged in their Teams tab until it is locked; Lock in freezes the whole build, an admin unlocks it, and the team list and page mark it locked; the match page shows both teams to their owners and admins, and to everyone once the cup's mode reveals them, in [their own entry](#league-teams-stay-hidden-until-their-mode-reveals-them) ([discovery → Team Locking](discovery.md#team-locking), [The Cup](discovery.md#the-cup)). A player with no Tournament snapshot is told to upload it.

**Do:**
- [ ] The lock on a team, its admin unlock, and the frozen editor.
- [ ] Cup teams made per match and player; the Teams tab's flag.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, as a test player with a Tournament snapshot, build and lock a cup team and see every editor refuse; without one, see the upload prompt; as admin, unlock it.
- Human-run: the owner builds and locks a cup team on the preview.
- Reuse: team sources and size (`shared/team.ts`, `api/_lib/teams.ts`), the team page (`src/pages/team.tsx`).
- Neighbors: the team page's read-only view of another's team.
- Forbidden: an "Any Pokémon" source on a cup team.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** An admin runs the cup from its bracket to its champion

## League teams stay hidden until their mode reveals them

The cup gets its mode when an admin starts it. A round or cup team is seen only by its owner and admins until its reveal: in an open cup, once every cup player has locked; in a closed one, once its match has a result. The API enforces it on every route that hands out a team: the team list, the team page, the match page and Compare ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] The modes in `shared/league.ts`; the cup's mode, picked by the admin on starting it.
- [ ] The reveal enforced by the team routes and the match page.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in an open cup, a second test player gets neither page nor route for the first's locked cup team until every cup player has locked, then sees it; in a closed cup, sees it only once the match has a result; the owner and an admin always see it.
- Human-run: the owner starts series 1's cup open on the preview and checks a team's reveal.
- Reuse: `api/_lib/access.ts`; the lock of the entry above.
- Neighbors: the start-the-cup board (`design/league-cup-start.dc.html`).
- Forbidden: hiding in the browser only; a mode hard-coded rather than read from the round or cup.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Each cup match gives its players a locked team to build

## Players ban blind and pick their six on a cup match's page

An open cup has bans and a closed one none; in an open cup, each cup game opens with both players' bans once the game before it has its result: each bans one of the other's eight, sees only whether the opponent has banned, and both bans show once both are in; the winner of the last game cannot repeat their ban; each then picks six of their seven left, kept with the game and copied for Showdown; the admin's result opens the next game ([discovery → The Cup](discovery.md#the-cup), [The Match Page](discovery.md#the-match-page)). The page refreshes itself while it waits on the other side.

**Do:**
- [ ] Bans and picks on a match's games, as moves of the match module, the ban rule in `shared/league.ts`.
- [ ] The ban and pick steps on the match page, and its refresh while waiting.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, two test players in two browsers: the first to ban sees "waiting" and not the other's ban until both are in; the game 1 winner is refused their game 1 ban in game 2 and the loser is not; a pick of other than six of the seven is refused; Copy for Showdown gives the six; a ban sent for the other player, or after the bans close, gets 403 or 409; a closed cup goes straight to the pick of six.
- Human-run: the owner, as two players, bans and picks for a cup match on the preview.
- Reuse: the cup teams of the entry above; the team page's pick of six (`src/teams/pick.ts`) and Copy for Showdown.
- Neighbors: the admin game editor on the match page.
- Forbidden: showing a ban before both are in, to anyone; a ban or pick written outside the match module.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** League teams stay hidden until their mode reveals them

## An admin opens a round and draws its pairs

For a later series: an admin opens the next round in the mode they pick, prefilled with the previous round's, which draws pairs at random among players who have not met, with a bye on an odd count; the admin can redraw it or set the pairs by hand ([discovery → Rounds](discovery.md#rounds)). In a closed round, a player sees their pair only once they have locked their team ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] Opening with its mode, the draw, redraw and hand-set pairs, in place on the Rounds view.
- [ ] A closed round's pairs hidden from each player until they lock, enforced by the API.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, on a seeded series of five players, open rounds until each pair has met once, with byes, never repeating a pair; redraw one; set one by hand; open a closed round and see a player get no pair, by page or route, until they lock.
- Human-run: none until a series uses it.
- Reuse: the round tables of the first code entry.
- Neighbors: the admin result editor.
- Forbidden: rounds opening by themselves.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`

## Each open round gives a player their team once their snapshot exists

An open round gives each player a team sourced from their snapshot at its milestone, sized by the league's rules, as soon as that snapshot exists; until then their Teams tab names the milestone to reach and upload. Locked and unlocked as a cup team ([discovery → Team Locking](discovery.md#team-locking)).

**Do:**
- [ ] Round teams made when the round is open and the snapshot exists (on opening and on upload).
- [ ] The Teams tab's flag and waiting note; the match shows both teams.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open round 2 with one test player at Gym 2 and one at Gym 1: the first gets the team, the second the note, and gets it on uploading Gym 2; in an open round, a match's teams show to others once both are locked; in a closed one, once it has a result.
- Human-run: none until a series uses it.
- Reuse: the lock of the cup teams entry.
- Neighbors: the upload flow (`api/_lib/ingest.ts`).
- Forbidden: a team sourced from a snapshot that does not exist.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** An admin opens a round and draws its pairs; League teams stay hidden until their mode reveals them

## Players see others' saves only up to their own round

A player sees another's snapshots only from their own round or older; someone outside the series only once every player has reached the snapshot's round; admins all ([discovery → Team Locking](discovery.md#team-locking)). Enforced wherever a snapshot is handed out: the PC, the player's series page, the abilities search and team sources.

**Do:**
- [ ] A player's and a snapshot's round from the round milestones.
- [ ] The rule on every snapshot route.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with Red at Gym 3 and Blue at Gym 2, Blue cannot open Red's Gym 3 or Gym 4 PC, find it in the abilities search or add it as a source, by page or route, and can once Blue uploads Gym 3; a player of another series sees it only once every player is at Gym 3; a series without round milestones hides nothing.
- Human-run: the owner checks it on the preview as two of series 1's players.
- Reuse: `MILESTONE_MARKS` (`shared/series.ts`), `api/_lib/access.ts`.
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
- Reuse: the save rule of [Players see others' saves only up to their own round](#players-see-others-saves-only-up-to-their-own-round); the reveal of [League teams stay hidden until their mode reveals them](#league-teams-stay-hidden-until-their-mode-reveals-them).
- Neighbors: the PC and abilities routes.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Each open round gives a player their team once their snapshot exists; Players see others' saves only up to their own round

## Do pasted "Any Pokémon" teams keep a randomized ability?

**Needs the author:** series 1 randomizes abilities, but an "Any Pokémon" member may only hold one of its species' own (the paste reader's `notItsAbility`, `src/teams/showdown.ts`), so every pasted Pokémon League try, the six imported ones included, falls back to its species' first ability, and so would series 1's game teams built from the replays and pastes. Does an "Any Pokémon" member accept any ability, only a pasted or imported team does, or is the fallback fine?

## Series 1's game teams come across from their replays, locked to their rounds

Each imported game with a replay gets each side's team built from the replay: the six brought with the moves, items and abilities it revealed, sourced "Any Pokémon" and locked to the player's round; a game with no replay shows the player's matchday paste instead, the hidden one included ([discovery → Results](discovery.md#results)).

**Do:**
- [ ] Extend the import: teams from the replays' logs, the matchday pastes for games without one; show them on their matches and games.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, every series 1 match shows both sides' teams, locked; a game with a replay shows the six of its `|poke|` lines and the moves its log revealed; a game without one shows the paste's members.
- Human-run: the owner reads a few matches against their replays.
- Reuse: the replays' games the import already makes (`scripts/league-import.ts`); Showdown paste-in (`src/teams/showdown.ts`) for the pastes.
- Neighbors: the Pokémon League tries' pasted teams.
- Forbidden: a second Showdown paste parser; a paste overriding a replay.

**Touches:** `pkmn/site/scripts/`, `pkmn/site/api/`, `docs/pkmn/site/`
**After:** Each open round gives a player their team once their snapshot exists; Do pasted "Any Pokémon" teams keep a randomized ability?

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

Owner-run. The league branch goes to `main` only now, on the owner's word; with the real players invited, the dump is imported on production and read against the app, the group moves to the site and the app is switched off ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build)).

**Do:**
- [ ] Owner-run: invite the real players; merge the league branch to `main`; run the import on production with the map pointed at their accounts.
- [ ] Owner-run: read the league against the app; tell the group; switch it off.

**Acceptance:**
- Claude-run: none.
- Human-run: the owner's read-through on production.
- Reuse: the import script.
- Neighbors: none.
- Forbidden: none.

**Touches:** none
**After:** Series 1's game teams come across from their replays, locked to their rounds
**Needs the author:** the go for production, the invites and the switch-off.
