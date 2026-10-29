# The League Tasks

Decisions are in [discovery.md](discovery.md). Every code entry is built on the league's own git branch, which the owner merges into `main` to deploy: `league` reached production on 2026-10-29 at `5ec191a`, and what lands after it goes out when the owner next merges it ([discovery → Rules, Data and Build](discovery.md#rules-data-and-build), "When does the league go to production, and how?"); every code entry runs `npm run gate` from `pkmn/site/`, checks its flow through the `verify-site` skill (in the browser when it changes a page, by its routes and the database when it changes only the API or shared logic; `pkmn/site/CLAUDE.md`), builds from the frozen league boards in `pkmn/site/design/`, reads the league's rules only from `shared/league.ts`, extends `npm run seed` for any table it adds, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. Series 1's cup is close, so the entries that bring its league across and run its cup come before the rounds a later series needs.

## The league import is documented as a full import only

The import's rerun deletes series 1's tries and rounds (`scripts/league-import.ts`), and the rounds take their matches, games and teams with them (`team.match_id` cascades, `api/_lib/schema.ts`), so a rerun replaces series 1's whole league, wiping what the site has made since: tries logged there, an admin's try edits and team fixes, game fixes. The docs say only that a rerun "writes the same rows" ([How to Run and Deploy the Site → Import series 1's league](../../pkmn/site/how-to/run-and-deploy-the-site.md#import-series-1s-league); [The pkmn Site → League](../../pkmn/site/explanation/site.md#league)) and that production gets the import "again when the app holds Elfo v Javi". The owner settled it: the import is not run again on production; it is kept for a full import, and Elfo v Javi is entered on its match page by hand once the owner says it is played ([discovery → Results](discovery.md#results), [discovery → Rules, Data and Build](discovery.md#rules-data-and-build), owner 2026-10-29). Found by the end-of-run gardener, 2026-10-29.

**Do:**
- [ ] The how-to's import section and site.md's League paragraph saying a rerun replaces series 1's whole league with the dump, wiping what the site has made since, so it is for a full import only; production's import run once, with Elfo v Javi entered on its match page by an admin.
- [ ] site.md's go-live decision no longer saying production gets the import again, and its decision recording the owner's answer.

**Acceptance:**
- Claude-run: docs-only, so no gate run and no `verify-site`; `grep -rn -i 'rerun\|again when the app' docs/pkmn/site/` finds no sentence promising a production rerun.
- Human-run: none.
- Reuse: the existing import section and League paragraph.
- Neighbors: the eggs override's rerun rule, unchanged.
- Forbidden: changing the import's code; a new import mode.

**Touches:** `docs/pkmn/site/how-to/run-and-deploy-the-site.md`, `docs/pkmn/site/explanation/site.md`
