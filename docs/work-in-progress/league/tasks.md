# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch, which the owner merges into `main` to deploy: `league` reached production on 2026-10-29 at `5ec191a`, and what lands after it goes out when the owner next merges it ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build), "When does the league go to production, and how?"); every code entry runs `npm run gate` from `pkmn/site/`, checks its flow through the `verify-site` skill (in the browser when it changes a page, by its routes and the database when it changes only the API or shared logic; `pkmn/site/CLAUDE.md`), builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## A rerun of the league import keeps what the site has made since the last run

The owner reruns the import against production once the app holds Elfo v Javi ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build), "When does the league go to production, and how?", owner 2026-10-29). In one transaction the import deletes every Pokémon League try of series 1 and every round of it, their matches, games and teams going with them by cascade (`pkmn/site/scripts/league-import.ts:492-494`; `team.match_id` cascades, `api/_lib/schema.ts:245`), then writes the dump's. Between the two runs production is live: players log tries on the site, an admin logs or edits one for them and changes its team, fixes an imported matchday team in place (`fixed_by`, `fixed_at`; all `813d7bd`) and fixes a game of an imported match (`fixGame`, `api/_lib/match.ts`), and the cup may start. The rerun drops all of it without a word: a try logged on the site leaves the standings, its pasted team left behind locked and no try's; a fixed matchday team comes back as its replays draw it. The docs say only that running it again "writes the same rows" ([How to Run and Deploy the Site → Import series 1's league](../../pkmn/site/how-to/run-and-deploy-the-site.md#import-series-1s-league)). The one rerun rule settled is the eggs': an admin's own setting is left alone, and a count still from the app takes the dump's again ([discovery → Standings, the Pokémon League and Eggs](discovery.md#standings-the-pokémon-league-and-eggs), owner 2026-10-29). What the site made can be told from what the import made by who made it: imported tries have no `logged_by`, imported games no `recorded_by`, imported teams no `fixed_by`. Found by the end-of-run gardener, 2026-10-29, from `813d7bd` and `5ec191a` together.

**Do:**
- [ ] Per the author's answers: the rerun in `scripts/league-import.ts`; what it keeps and what it replaces in [How to Run and Deploy the Site → Import series 1's league](../../pkmn/site/how-to/run-and-deploy-the-site.md#import-series-1s-league), with its decision in [The pkmn Site](../../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack, after an import, log a try as `vicky`, and as `admin` fix a game of an imported match and fix an imported matchday team in place; rerun the import and read back from the database that what the answers keep is still there and what they replace is the dump's.
- Human-run: the owner's production rerun once the app holds Elfo v Javi, series 1's league checked against the app after it, and the rows made on the site that the answers keep still there.
- Reuse: `importMatch` (`api/_lib/match.ts`); the hatched counts' rerun in `scripts/league-import.ts` (`hatchedImported`).
- Neighbors: the hatched counts' rerun.
- Forbidden: a rerun that deletes a row made on the site without printing it; a test account made in production.

**Touches:** `pkmn/site/scripts/league-import.ts`, `docs/pkmn/site/how-to/run-and-deploy-the-site.md`, `docs/pkmn/site/explanation/site.md`
**Needs the author:**
- What a rerun does with a Pokémon League try logged on the site since the last run, a player's or an admin's.
- What it does with an admin's change to an imported try: its combats won, where each fell, or its team.
- What it does with an admin's fix of a game of an imported match, and with an admin's in-place fix of an imported matchday team.
- Whether a rerun replaces series 1's whole league as now, or only brings in what the app holds and the site does not (Elfo v Javi).
- Whether a rerun may run once series 1's cup has started.
