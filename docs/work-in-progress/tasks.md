# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/site: deploy on Workers Builds

Connect the repository to Cloudflare Workers Builds for `pkmn/site/` and attach `pkmn.enbraile.vip`, as [Portability and Environment](open-sheet-site-discovery.md#portability-and-environment) settles.

Verify manually: a push to `main` touching `pkmn/site/` deploys; `https://pkmn.enbraile.vip` serves the home page; a branch push gets a preview URL.
**Touches:** `pkmn/site/`
**Needs the author:** the Cloudflare dashboard and the `enbraile.vip` zone are the owner's.

## pkmn/site: copy a team as Showdown text

Add the button of [Interfaces and Integration](open-sheet-site-discovery.md#interfaces-and-integration) that copies a team in Showdown's team format: species, nickname, gender, shiny, item, ability, nature, Level 50 and the picked moves, no IVs or EVs.

Verify manually: a copied team pastes into Showdown's teambuilder ("[Gen 9] Custom Game") with every member, item, ability, nature and move recognised.
**Touches:** `pkmn/site/`
**After:** pkmn/site: build teams

## pkmn/site: document the site

Move the lasting content of the [Site Discovery](open-sheet-site-discovery.md) into `docs/pkmn/site/`: an explanation doc holding its decisions and a how-to for running and deploying the site; then delete the discovery doc and update [Open Sheet](open-sheet.md) (closing the initiative if nothing is left), the [Work in Progress](index.md) index, `docs/pkmn/index.md` and `docs/index.md` where needed.

Verify manually: every decision in the discovery doc has a home under `docs/pkmn/site/`; `grep -rn open-sheet-site-discovery docs/` finds nothing.
**Touches:** `docs/pkmn/`, `docs/index.md`, `docs/work-in-progress/`
**After:** pkmn/site: analyse a team; pkmn/site: copy a team as Showdown text; pkmn/site: deploy on Workers Builds
