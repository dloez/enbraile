# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` before [Retire the Trainer League app](#retire-the-trainer-league-app), so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill, builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## The series page's League summary shows the cup once it starts

Discovery's series page summary holds "the standings' top, the current round, the cup once it starts" ([discovery → Surfaces](discovery.md#surfaces)); the landed `LeagueSummary` (`src/pages/series.tsx`) shows the first two, and no signed-off board draws the third: `series.dc.html` and `series-phone.dc.html` hold no cup.

**Do:**
- [ ] The cup in the series page's League summary, as the signed-off board draws it.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with series 1's cup started, the series page's League section shows it and links to the Cup view; before it starts, it shows none.
- Human-run: none.
- Reuse: the cup of the entry above; `LeagueSummary` (`src/pages/series.tsx`).
- Neighbors: the league page's Cup view.
- Forbidden: none.

**Touches:** `pkmn/site/src/pages/series.tsx`, `pkmn/site/api/`, `pkmn/site/design/`, `docs/pkmn/site/`
**Needs the author:** the sign-off of the summary's cup, which Claude draws on the Site v2 Screens canvas (owner, 2026-10-29).

## A Pokémon League try locks its team, and a locked team can be cloned

Logging a try locks the team it uses, picked or pasted, and editing a try leaves it locked; series 1's imported try teams are locked too. A locked team, a try's or a round or cup team, shows Clone on its page, which copies it into a new editable team of the reader's own: a player clones only their own, an admin any ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs)). The lock, its admin unlock and the frozen editor come with the cup teams' lock (`POST /api/teams/<id>/lock` and `/unlock`, `api/_lib/teams.ts`).

**Do:**
- [ ] Lock a try's team when the try is logged, and on the import's try teams.
- [ ] Clone on a locked team's page, a new editable team with its members, sources and size, named "<name> (copy)".

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, a try logged by pasting and one by picking a team both leave their team locked, its editors refusing, the Teams list reading Locked; Clone on it makes an editable team of the reader's with the same members; a player gets no Clone on another's locked team, by page or route; after `npm run league-import` every try team is locked.
- Human-run: the owner clones a try's team on the preview.
- Reuse: the lock of the cup teams entry; team creation (`insertTeam`, `api/_lib/teams.ts`); the try routes (`api/_lib/league.ts`).
- Neighbors: the team page's locked state (`team-locked.dc.html`).
- Forbidden: a clone carrying EVs or IVs the reader may not see.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/scripts/league-import.ts`, `docs/pkmn/site/`

## League teams stay hidden until their mode reveals them

The cup gets its mode when an admin starts it. A round or cup team is seen only by its owner and admins until its reveal: in an open cup, once every cup player has locked; in a closed one, once its match has a result. The API enforces it on every route that hands out a team: the team list, the team page, the match page and Compare ([discovery → Team Locking](discovery.md#team-locking)). The modes already exist: `LEAGUE_MODES` and `leagueMode` in `shared/league.ts`, stored on each round as `league_round.mode` (`api/_lib/schema.ts`).

**Do:**
- [ ] The cup's mode, stored on the cup as a round's is, picked by the admin on starting it and prefilled with the newest round's.
- [ ] The reveal enforced by the team routes and the match page.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, in an open cup, a second test player gets neither page nor route for the first's locked cup team until every cup player has locked, then sees it; in a closed cup, sees it only once the match has a result; the owner and an admin always see it.
- Human-run: the owner starts series 1's cup open on the preview and checks a team's reveal.
- Reuse: `leagueMode` and `league_mode` (`shared/league.ts`, `api/_lib/schema.ts`); the team routes (`api/_lib/teams.ts`) and the match read (`matchOf` in `api/_lib/league.ts`); the lock of the entry above.
- Neighbors: the round opening's Mode picker (`src/league/round-admin.tsx`); the start-the-cup board (`design/league-cup-start.dc.html`).
- Forbidden: hiding in the browser only; a mode hard-coded rather than read from the round or cup.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`

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

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `pkmn/site/scripts/seed.ts`, `docs/pkmn/site/`
**After:** League teams stay hidden until their mode reveals them

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
**After:** League teams stay hidden until their mode reveals them

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
- Reuse: the save rule of [Players see others' saves only up to their own round](#players-see-others-saves-only-up-to-their-own-round); the reveal of [League teams stay hidden until their mode reveals them](#league-teams-stay-hidden-until-their-mode-reveals-them).
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
