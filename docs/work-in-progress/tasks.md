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

## pkmn/site: theme the overlay scrims

`pkmn/site/src/components/ui/dialog.tsx:40` and `pkmn/site/src/components/ui/sheet.tsx:40` darken the page behind the bag, the move picker and the phone summary with shadcn's raw `bg-black/10`, where `pkmn/site/CLAUDE.md` takes every colour from the `:root` variables of `src/index.css`, set by the Open Sheet Screens design of [Surfaces, Reuse and Data](open-sheet-site-discovery.md#surfaces-reuse-and-data). Either give the scrim a variable and Tailwind token from the design and use it in both overlays, or record in `pkmn/site/CLAUDE.md` that the shadcn files under `src/components/ui/` are exempt.

Verify manually: opening the bag, and a Pokémon's summary at phone width, shows the scrim the design shows; `grep -rn 'bg-black' pkmn/site/src` finds nothing unless the files are exempted; `npm run gate` passes.
**Touches:** `pkmn/site/src/components/ui/`, `pkmn/site/src/index.css`, `pkmn/site/CLAUDE.md`
**Needs the author:** do the vendored shadcn components in `src/components/ui/` follow the site's no-raw-colours theme rule, so the scrims get a token from the design, or are they exempt, so the rule says so?
