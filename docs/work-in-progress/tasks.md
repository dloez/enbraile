# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/site: deploy on Workers Builds

Connect the repository to Cloudflare Workers Builds for `pkmn/site/` and attach `pkmn.enbraile.vip`, as [Portability and Environment](open-sheet-site-discovery.md#portability-and-environment) settles.

Verify manually: a push to `main` touching `pkmn/site/` deploys; `https://pkmn.enbraile.vip` serves the home page; a branch push gets a preview URL.
**Touches:** `pkmn/site/`
**After:** pkmn/site: scaffold the site
**Needs the author:** the Cloudflare dashboard and the `enbraile.vip` zone are the owner's.

## pkmn/site: build teams

Build team building in the PC and the Team view of [The Builder and the Team Page](open-sheet-site-discovery.md#the-builder-and-the-team-page), point and click only: named teams per tab (create, rename, duplicate, delete), stored with Dexie; the six-slot strip, filled from a Pokémon's summary; items given and TMs taught from the bag, items held under the quantity limit; abilities switchable with the Mini Seta count against `tinymushroom`; four move slots offering the tab's TMs, then any Gen 1–5 move. Follow the design.

Verify manually: with one `leftovers` in the tab, a second member cannot take it; switching two members' abilities shows 2 Mini Setas needed against the tab's count; a TM taught from the bag and a free-picked move both fill slots; two teams in one tab survive a reload; on a phone, tapping a Pokémon then Add to team puts it in the strip.
**Touches:** `pkmn/site/`
**After:** pkmn/site: browse a sheet in the PC

## pkmn/site: analyse a team

Build the team page of [The Builder and the Team Page](open-sheet-site-discovery.md#the-builder-and-the-team-page): base stats and Level 50 stat ranges (IVs 0–31, 1 EV, nature) with the speed order, the defensive chart with the hand-kept list of matchup-changing abilities, and offensive coverage from picked moves, falling back to STAB, using Showdown's types. Unit-test the stat ranges, the chart and the coverage.

Verify manually: a team with Walrein shows its Level 50 ranges matching Showdown's damage calculator at IV 0 and 31 with 1 EV; a member with Levitate counts as immune to Ground; a team whose moves and STAB types hit nothing super-effectively against Steel lists Steel as uncovered; `npm run gate` passes.
**Touches:** `pkmn/site/`
**After:** pkmn/site: build teams

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
