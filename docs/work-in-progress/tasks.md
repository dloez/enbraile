# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/site: deploy on Workers Builds

Connect the repository to Cloudflare Workers Builds for `pkmn/site/` and attach `pkmn.enbraile.vip`, as [Portability and Environment](open-sheet-site-discovery.md#portability-and-environment) settles.

Verify manually: a push to `main` touching `pkmn/site/` deploys; `https://pkmn.enbraile.vip` serves the home page; a branch push gets a preview URL.
**Touches:** `pkmn/site/`
**Needs the author:** the Cloudflare dashboard and the `enbraile.vip` zone are the owner's.

## pkmn/site: document the site

Move the lasting content of the [Site Discovery](open-sheet-site-discovery.md) into `docs/pkmn/site/`: an explanation doc holding its decisions and a how-to for running and deploying the site; then delete the discovery doc and update [Open Sheet](open-sheet.md) (closing the initiative if nothing is left), the [Work in Progress](index.md) index, `docs/pkmn/index.md` and `docs/index.md` where needed. In `docs/pkmn/index.md`, the Open Sheet row's status still reads "web app scoped" though the web app is built, and both rows link the discovery doc. `pkmn/site/CLAUDE.md` names the discovery doc as the site's design until `docs/pkmn/site/` exists; point it at the new docs.

Verify manually: every decision in the discovery doc has a home under `docs/pkmn/site/`; `grep -rn open-sheet-site-discovery docs/ pkmn/` finds nothing; the Open Sheet and Site rows of `docs/pkmn/index.md` describe what is built and deployed.
**Touches:** `docs/pkmn/`, `docs/index.md`, `docs/work-in-progress/`, `pkmn/site/CLAUDE.md`
**After:** pkmn/site: deploy on Workers Builds

## pkmn/site: Team Analysis Pool and Compare views

Add the Pool view (tiles, base-stat statistics, distribution, types, correlations, the sortable table) and the Compare view (2–4 teams, scoreboard, head-to-head, fingerprints, by-type tables) as the design draws them.

Verify manually: the Pool view's counts change with the pool bar; comparing two sample teams shows the scoreboard with stars and the head-to-head in both directions.
**Touches:** `pkmn/site/src/team-analysis/`

## pkmn/site: the analysis in Open Sheet's Team view

Give Open Sheet's Team view the Analysis section of the design (Summary with archetype and checklist beside the speed order, defence and coverage; Graph; Archetype; Members; Matrices; the pool chip) and the "Open in Team Analysis" button, which opens the team in Team Analysis.

Verify manually: a built team shows its archetype and checklist; "Open in Team Analysis" shows the same team analysed there; a team with an unknown species still analyses the rest.
**Touches:** `pkmn/site/src/open-sheet/`
