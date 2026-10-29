# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch and never pushed to `main` until the owner says so, so nothing of the league reaches production; every code entry runs `npm run gate` from `pkmn/site/`, checks its flow through the `verify-site` skill (in the browser when it changes a page, by its routes and the database when it changes only the API or shared logic; `pkmn/site/CLAUDE.md`), builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

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
