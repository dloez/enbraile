# The League: Discovery

Scoped with the owner on 2026-10-27, while site v2 closed its last entries; the owner lifted the earlier wait for it (2026-10-27).

## Goal

The site holds the group's league and cup, integrated with its teams and snapshots, and the group's Trainer League app (`https://raspi.tail3e36c9.ts.net:10000/`, also `pbe.unlit.me`) is retired. Series 1 moves across whole: everything the app holds is imported once, and series 1's cup is played on the site.

Done when, on `pkmn.enbraile.vip`: series 1's league reads as it does in the app (rounds, results, replays, standings, Pokémon League tries, eggs, every matchday team), an admin can enter and fix any of it, the cup runs from its bracket to its champion with each cup team built from the player's Tournament snapshot and locked, and a later series opens its rounds, draws them and has its players build and lock their round teams.

## Decisions

### Goal and Scope

- **Q: When does the site take over?** A: For series 1 itself: the app's whole data is imported once, league-related or not, and the cup is played on the site. **Why:** the owner. _(owner, 2026-10-27)_
- **Q: Where does the import read from?** A: The old site's whole database dump, which the owner hands over, read by a one-off script. No pipeline: it runs once. Only the features matter; the dump will hold hidden teams and pending reports that the app's public `/api/state` leaves out. **Why:** the owner. _(owner, 2026-10-27)_
- **Q: Wonder?** A: Left out. Its data is empty in series 1, and the rules have no fights against the AI ([Competition Format → Decisions](../../pkmn/series/1/explanation/competition-format.md#decisions)). **Why:** the owner. _(owner, 2026-10-27)_
- **Q: The old app's look?** A: Not copied. Every league screen is designed anew on the Site v2 Screens canvas and signed off before it is built; all of them are signed off and frozen in `pkmn/site/design/` ([The pkmn Site → Look](../../pkmn/site/explanation/site.md#look)). **Why:** the owner: "we can do way better". _(owner, 2026-10-27; signed off 2026-10-28)_

### Rounds

- **Q: Which milestone is a round?** A: Round N is the series' Nth milestone marked `round` (`MILESTONE_MARKS`, `shared/series.ts`); series 1's are Gyms 1, 2, 3, 5 and 7. _(from the code, 2026-10-27)_
- **Q: Who opens a round?** A: An admin, by hand; opening rounds by themselves may come later. **Why:** the owner. _(owner, 2026-10-27)_
- **Q: Pairings?** A: Opening a round draws pairs at random among players who have not met yet, with a bye on an odd count, as the app does; the admin can redraw it or set the pairs by hand. **Why:** the owner. _(owner, 2026-10-27)_
- **Q: A player joining mid-league?** A: Not handled; open in the [backlog](../backlog.md#pkmnsite-what-does-the-league-do-with-a-player-who-joins-mid-league). _(owner, 2026-10-27)_

### Team Locking

- **Q: Where does a player's round team come from?** A: Opening a round gives each player a team to complete in their Teams tab, flagged until it is done, its source locked to their snapshot at that round's milestone, its size set by the league's rules (6 to 8). The play is fully async: a player gets the team only once that snapshot exists, and until then is told which milestone to reach and upload. So one player still on round 1 and another on round 3 each see only the team their own snapshots back, and no team ever points at a snapshot that does not exist. **Why:** the owner. _(owner, 2026-10-27; settles "how a team is locked", 2026-10-23)_
- **Q: Who locks it and what does locking freeze?** A: The player presses Lock in when the team is done, which freezes the whole build: members, items, abilities, moves, natures, EVs. Only an admin unlocks it. The team list and team page mark it locked, naming its round. **Why:** the owner. _(owner, 2026-10-27)_
- **Q: Who sees round and cup teams, their snapshots and their pairs?** A: It depends on the mode, set per round and per cup, so each can differ. There are two modes for now, and more may come. Before its reveal, a team is seen only by its owner and admins, enforced by the API, not only the page.
  - **Open:** pairs and the snapshots teams are built from (the PC at the round's milestone, the Tournament snapshot for the cup) are public at all times, so players can build from what they know of each other. A round match's two teams show once both its players have locked; the cup's teams all show once every cup player has locked.
  - **Closed:** a match's two teams and both players' snapshots for it show once the match has its result. A player sees their pair only once they have locked their own team.
  **Why:** the owner: "this will vary depending on the series and the round … this should be configurable". _(owner, 2026-10-28; replaces "everything is open", 2026-10-27)_
- **Q: Who sets the mode?** A: An admin, when opening a round or starting the cup, prefilled with the previous round's choice; the series stores no default. Series 1's rounds are already played, and its cup is open. **Why:** the owner. _(owner, 2026-10-28)_
- **Q: Whose saves can a player see?** A: Only another player's saves from their own round or older: a player's round is the latest round milestone they have uploaded a snapshot for, and a snapshot's round is the latest round milestone at or before its milestone (series 1's Gym 4 is round 3). While a closed match is unplayed, each of its two players' later saves stay hidden from the other, so moving on does not give the box away. Someone outside the series sees a snapshot only once every player of the series has reached its round. Admins see everything. It always applies, in open and closed rounds alike; a series without round milestones has nothing it hides. **Why:** the owner: it closes the async leak of a closed round's box through later saves. _(owner, 2026-10-28)_
- **Q: Others' EVs and IVs?** A: Hidden: a team's EVs and IVs are seen only by its owner and admins, on every team, league or free, enforced by the API; everyone else sees the rest of the build. The PC's summaries hide them too, from all but their owner and admins, since a team built from a snapshot carries its EVs and IVs. The old app promised it to its players. The stats worked out for a team whose EVs and IVs the viewer may not see, in the team analysis and Compare's damage calc, use its base stats rather than them. **Why:** the owner. _(owner, 2026-10-28; the PC 2026-10-28; worked-out stats 2026-10-29)_
- **Q: What may an "Any Pokémon" member hold?** A: Everything: any ability and any move, not only its species' own, in the editor and in a Showdown paste, so a pasted try or an imported game team keeps the randomized abilities and moves series 1 played with. **Why:** the owner. _(owner, 2026-10-29)_
- **Q: Free teams?** A: Every team that is not a round or cup team has a public/private toggle, private by default, existing teams included. Round and cup teams have no toggle and follow only their mode, so a match can always reveal them. **Why:** the owner. _(owner, 2026-10-28)_
- **Q: The items a locked team spends in a manual series?** A: Nothing is done: each team draws from its own snapshot's bag as now, and the next snapshot shows what was really spent. A later series may handle it better: a [backlog task](../backlog.md#pkmnsite-track-what-a-locked-league-team-spends-in-a-manual-series). **Why:** the owner. _(owner, 2026-10-27; settles the question of 2026-10-23)_

### Results

- **Q: How does a match result get in?** A: Game by game, on the [match page](#the-match-page): an admin records each game's winner, each side's fainted Pokémon and its Showdown replay link, and the Bo3 score follows from the games; the admin fixes any of it. Players do not report or confirm for now; the battles stay on Showdown, and the site builds nothing that stands in for it. A private Showdown that records each game by itself is its own [backlog idea](../backlog.md#pkmnsite-a-private-showdown-tied-to-the-site), and the match page is built to take it ([The Match Page](#the-match-page)). **Why:** the owner: admin tools are needed anyway, and the site orchestrates the games. _(owner, 2026-10-27; game by game 2026-10-28; replaces the app's report, confirm and dispute)_
- **Q: Series 1's imported matches?** A: They keep the app's match-level result (the games score, each side's fainted, the replay links). Each game with a Showdown replay becomes a game of its match, read from the replay's log: its winner (`|win|`), each side's fainted (`|faint|`) and each side's team. Games with no replay are left out; the app's score stands for them. A replay that disagrees with the app's score is reported by the import, not guessed. Where every game of a match has a replay, the match's fainted are the replays' sum: it equals the app's in every such match but round 3's Elfo v Dloez, which the app holds as 0–0 against the replays' 17 and 11. _(owner, 2026-10-28; the fainted from the dump, 2026-10-28)_
- **Q: The team of an imported game?** A: Built from its replay, not the matchday paste: the six brought (`|poke|`: species, gender, level) with the moves, items and abilities the battle revealed, as a site team sourced "Any Pokémon" and locked to its round. The player's matchday paste stays only where a game has no replay, so every imported match still shows a team. **Why:** the owner: the replay is what was actually played, in case a paste holds a human error. In the dump every replay's six are the paste's six, since every matchday team had six (one had five) and was brought whole. _(owner, 2026-10-28, kept after the dump was read)_
- **Q: Replays?** A: Links, as all 28 of series 1's are (none was an uploaded file). The app's turn-by-turn replay log is left to the private Showdown idea. _(proposed, 2026-10-27)_

### Standings, the Pokémon League and Eggs

- **Q: Standings?** A: The rulebook's, not the app's: a point per Bo3 win and per combat won in the best Pokémon League try; ties to the direct result, then wins among the tied, then a stable random draw ([Series 1 Rules → The League](../../pkmn/series/1/reference/rules.md#the-league)). The app still breaks ties by game and Pokémon difference. Wins, losses, games and Pokémon fainted show beside the points.
- **Q: Who records a Pokémon League try?** A: The player: combats won (0–5) and the combat each member fainted in, with its team picked from their teams or pasted from Showdown. A paste creates a team, sourced "Any Pokémon", since no Post-League snapshot will back it, and links it to the try. An admin can edit or delete any try. **Why:** the owner. _(owner, 2026-10-27)_
- **Q: Eggs won?** A: The rulebook's: one per league win, one per combat won in the best try; none for cup wins, unlike the app.
- **Q: Eggs hatched?** A: Counted from the player's latest snapshot: its Pokémon, living or fainted, obtained by hatching (`obtained.hatchedAt`, [Snapshot Format](../../pkmn/site/reference/snapshot.md)). Nobody marks them: an upload updates the count. An admin corrects it in place on the standings' Eggs cell, as the site's other overrides are, the cell showing who set it and when; that is the fix for a hatched Pokémon since released. Drawn on the canvas and signed off 2026-10-29 (`league-eggs.dc.html`, `league-eggs-phone.dc.html`), a phone row showing the hatched count too. **Why:** the owner. _(owner, 2026-10-27; in place on the Eggs cell 2026-10-28)_

### The Cup

- **Q: The bracket?** A: An even number of entrants, for now: a cup of 5 or 7 cannot start, and the start-the-cup board already keeps Start off for an odd count (owner, 2026-10-29). In the rulebook's pattern: seeded by the standings; a plain knockout for 2, 4 or 8, otherwise an opening round whose losers play a round-robin group to fill the bracket. Six players give series 1's cup: 1–6, 2–5, 3–4, the losers' triangular with its own tie-breaks, and the rulebook's semifinals. The admin starts it and picks who enters (finished the story, did not lose the challenge). **Why:** the owner. _(owner, 2026-10-27)_
- **Q: The sheet a cup team is built from?** A: The player's snapshot at the series' Tournament milestone, the one players will upload. Each cup match gives each of its players a team locked to that snapshot, built and locked as a round team is. **Why:** the owner. _(owner, 2026-10-27; settles the backlog question of 2026-10-23)_
- **Q: Cup teams' size?** A: Eight Pokémon, with a ban: the group's latest decision, replacing "no bans". **Why:** the owner. _(owner, 2026-10-27)_
- **Q: The ban?** A: In every game of a cup match, each player bans one of the opponent's eight, blind: both bans are made at the same time on the match page, and neither player sees the other's until both are in. Each then brings six of their seven left. The winner of a game may not ban, in the next game, the Pokémon they banned in it; the loser may repeat theirs, and in game 3 the winner of game 2 may go back to their game 1 ban. League round matches have no ban. An open cup has bans and a closed one none, since its players cannot see each other's teams; series 1's cup is open. **Why:** the owner. _(owner, 2026-10-28)_

### Surfaces

- **Q: Where does the league live?** A: Its own page, `/series/<n>/league`, with Overview (the standings, and beside them the viewer's next match and their own rounds), Rounds, Pokémon League and Cup, and admin tools in place for admins; the series page's League placeholder becomes a short summary (the standings' top, the current round, the cup once it starts) linking to it; the Teams tab flags a round or cup team still to build; the player profile's placeholder becomes each series' league record. The canvas design settles the layout. **Why:** four views and their admin tools would make the series page very long, a phone most of all, and a page of its own lets a round or a cup match be linked. _(proposed, 2026-10-27; the owner asked for a suggestion; Standings renamed Overview by the owner, 2026-10-28)_
- **Q: How does the Teams list tell league teams from the rest?** A: Every team shows its kind (free, league round, cup, Pokémon League try) and, for a league team, its series, round or cup match, and state (to build, locked). The list filters by series, kind, state (to build, locked, editable) and owner (today's `?player=` made a visible control). A league team's series is its league's, so an imported "Any Pokémon" team still files under series 1. The boards were drawn on the Site v2 Screens canvas, desktop and phone, and signed off 2026-10-29 (`teams-list*.dc.html`). **Why:** the owner: the import alone adds about five locked matchday teams and the try teams to every player's list. _(owner, 2026-10-28)_

### The Match Page

- **Q: Does the site run the games?** A: Yes: the site orchestrates every match, league round or cup, on a page of its own (`/series/<n>/league/matches/<id>`), one player's team in the left column and the other's in the right, the Bo3 game by game below them. A cup game opens with both players' blind bans; a league game has none. Only the battle itself is played on Showdown. **Why:** the owner. _(owner, 2026-10-28)_
- **Q: How does a game move on?** A: A cup game opens its bans once the game before it has its result (the first on the match's start); each player bans on the page, sees only that their opponent has or has not banned, and both bans show once both are in; each player then picks their six of the seven left, copied for Showdown; the admin records the game's result, which opens the next game until the Bo3 is won. The page refreshes itself while it waits for the other side, since Vercel holds no websockets. _(owner, 2026-10-28, the ban and the admin; the pick of six kept with the game and the polling proposed)_
- **Q: Ready for a private Showdown?** A: Yes, without building it: a match is a sequence of games, each with its bans, its picks of six and its result, and every step (a ban, a pick, a result) is one server-side move on the match, checked by the same rules whoever makes it. The admin's result is one caller today; a private Showdown that sets up the battle from the picks and reports its finish would be another, with no change to the match. **Why:** the owner: the group means to play on a private Showdown the site orchestrates ([backlog idea](../backlog.md#pkmnsite-a-private-showdown-tied-to-the-site)). _(owner, 2026-10-28)_

### Rules, Data and Build

- **Q: Where do the league's rules live?** A: Hard-coded, as named values in one module (`shared/league.ts`): points, tie-break order, egg sources, round and cup team sizes, the bracket pattern. Every computation reads them from there. Looked at again once a series' rules become a data structure. The mode (open or closed) of each round and of the cup is the only exception: it is data, stored on the round and the cup, its options named in `shared/league.ts`. Nothing else becomes a setting for now. **Why:** the owner: "cover only what we are discussing". _(owner, 2026-10-27; the mode as data 2026-10-28)_
- **Q: The import's build?** A: A script under `pkmn/site/scripts/` reading the dump's `league.json` from the gitignored `pkmn/site/saves/league-export/`, with an explicit map from the app's players to site users; rerunnable, replacing series 1's league rows each time. The dump holds every replay's Showdown log (`data/replays/<id>.log`), so the import needs no network; each replay's sides are mapped to players by the match they belong to and the Showdown names the dump lists (`INTEGRATION.md` §6). Imported games' teams come from their replays, the matchday paste only where no replay is ([Results](#results)); tries come in as their teams; hatched counts as admin overrides until a snapshot says otherwise. _(proposed, 2026-10-27)_
- **Q: Schema and rollback?** A: New tables through `drizzle-kit` migrations, forward only, each extending `npm run seed` ([`pkmn/site/CLAUDE.md`](../../../pkmn/site/CLAUDE.md)); rollback is the site's ([The pkmn Site → Hosting and Deploys](../../pkmn/site/explanation/site.md#hosting-and-deploys)): Vercel's Instant Rollback, a forward migration, Neon's point-in-time restore.
- **Q: Observability?** A: Nothing new: Vercel's function logs, as the rest of the site.
- **Q: Verification?** A: `npm run gate` and every slice driven through the `verify-site` skill on the local stack; the import also checked against the dump's own standings.
- **Q: Where is the league built and tried?** A: On its own git branch, never pushed to `main`, since every `main` push that touches `pkmn/site/` deploys to production and runs its migrations there; so neither the league's tables nor its data reach production until the owner says so. The owner tries it on that branch's Vercel preview (the Neon `dev` branch and the preview bucket). **Why:** the owner: nothing for the league is created in production before they have tested it. _(owner, 2026-10-28)_
- **Q: The import's first target?** A: The preview, read from the old site's whole database dump, which the owner hands over before the import is written; the script is shaped to the dump as it really is. It runs from the shell against the Neon `dev` branch and refuses production, as `npm run seed` does. Series 1's six players are invented preview accounts in the preview's series 1, each signable through the test sign-in (`/api/auth/dev/sign-in?username=<name>`); the user map points the dump's players at them. Production gets the import later, once the owner has invited the real players so their accounts exist, the map then pointing at those. **Why:** the owner. _(owner, 2026-10-28)_

## Out of Scope

- Players reporting or confirming results, for now, and the private Showdown itself; the match page is ready for it ([backlog idea](../backlog.md#pkmnsite-a-private-showdown-tied-to-the-site)).
- Wonder battles.
- Tracking what a locked team spends (backlog task).
- Players joining mid-league (backlog question).
- Rounds opening by themselves.
- A series' rules as data.
- Uploaded replay files and the turn-by-turn replay log.

## What the Trainer League App Holds

Read 2026-10-28 from the full dump the owner handed over (`pkmn/site/saves/league-export/`, exported 2026-10-28, `rev` 295), which documents itself in its `README.md`, `DATA_MODEL.md` and `INTEGRATION.md`:

- 6 players, each with an account; Vicky is the organizer.
- 5 matchdays, each pair once, no byes; 15 matches, 14 played. Round 5's Elfo v Javi is unplayed, and Elfo has no team for it. The dump's README says all 15 were played; its data does not.
- 29 matchday teams of six (one of five), all at level 50, each used in one match; 27 hidden by their owners. No Wonder teams or battles.
- 28 replays, all links, each with its Showdown log in the dump, covering 28 of the 32 games played: round 1's Javi v Vicky has 1 of 2, round 4's Tole v Javi 2 of 3 (Tole's win has none), round 5's Dloez v Vicky none. Every replay agrees with the app's score and, where a match has every replay, with its fainted, except Elfo v Dloez's missing 0–0.
- 6 Pokémon League tries (Dloez 2, Vicky, Javi, Inop and Tole 1; Elfo none), each with its team and the combat each member fainted in.
- Hatched eggs as each player marked them: Vicky 9, Javi 9, Dloez 8, Elfo 2, Inop 0, Tole 0. The app's eggs count cup and Wonder wins; the rulebook's do not.
- The cup has not started.

## References

- [The pkmn Site](../../pkmn/site/explanation/site.md), [Team Builder](../../pkmn/site/explanation/team-builder.md), [Snapshot Format](../../pkmn/site/reference/snapshot.md).
- [Series 1 Rules](../../pkmn/series/1/reference/rules.md), [Competition Format](../../pkmn/series/1/explanation/competition-format.md).
- Code: `pkmn/site/shared/series.ts` (`MILESTONE_MARKS`), `api/_lib/schema.ts` (`series`, `seriesPlayer`, `milestone`, `snapshot`, `team`, `teamSource`), `src/pages/series.tsx`, `src/pages/player-profile.tsx`.
- The Trainer League app: `logic.js` (`rankPlayers`, `eggStats`, `buildBracket`, `losersTable`, `settleBracket`), `app.js`.
- The [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas: its League page holds the signed-off league boards (2026-10-28); version 43 held a first League design, not read for this scoping.
