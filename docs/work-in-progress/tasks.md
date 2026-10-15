# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/site: design the Open Sheet screens

Design in Claude Design, with the owner, the screens [The Builder and the Team Page](open-sheet-site-discovery.md#the-builder-and-the-team-page) and [Interfaces and Integration](open-sheet-site-discovery.md#interfaces-and-integration) describe: the site's home, importing a file into a tab, the sheet browser with its filters, the PC-style team builder (including its phone layout, tap-to-add) and the team page, in light and dark. Link the chosen design from the [scope doc](open-sheet-site-discovery.md#surfaces-reuse-and-data), under "What does it look like?".

Verify manually: the design covers every view named above with a realistic sheet (a dozen Pokémon, items, TMs); the owner has signed it off; its link is in the scope doc.
**Touches:** `docs/work-in-progress/open-sheet-site-discovery.md`
**Needs the author:** the design is made and chosen with the owner.

## pkmn/site: scaffold the site

Create `pkmn/site/` with the stack of [Surfaces, Reuse and Data](open-sheet-site-discovery.md#surfaces-reuse-and-data), at each package's latest stable version, pinned, deployed as a Worker with static assets for `pkmn.enbraile.vip` ([Portability and Environment](open-sheet-site-discovery.md#portability-and-environment)): shadcn initialised, TanStack Router with a home page listing the tools and an empty `/open-sheet` route, `npm run gate` (`tsc` and `vitest`), and `pkmn/site/CLAUDE.md` naming the gate. Add the project's row to `docs/pkmn/index.md`.

Verify manually: `npm run gate` passes; `npm run dev` serves the home page and `/open-sheet`, in light and dark; `npm run build` then `npx wrangler dev` serves the same from the Worker; `npm outdated` lists nothing.
**Touches:** `pkmn/site/`, `docs/pkmn/index.md`

## pkmn/site: deploy on Workers Builds

Connect the repository to Cloudflare Workers Builds for `pkmn/site/` and attach `pkmn.enbraile.vip`, as [Portability and Environment](open-sheet-site-discovery.md#portability-and-environment) settles.

Verify manually: a push to `main` touching `pkmn/site/` deploys; `https://pkmn.enbraile.vip` serves the home page; a branch push gets a preview URL.
**Touches:** `pkmn/site/`
**After:** pkmn/site: scaffold the site
**Needs the author:** the Cloudflare dashboard and the `enbraile.vip` zone are the owner's.

## pkmn/site: import exports into tabs

Build importing and the tabs of [Interfaces and Integration](open-sheet-site-discovery.md#interfaces-and-integration): drop or pick a file, validate it with a zod schema of [Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md), refuse a bad file with the reason, open each import in its own renamable tab, store imports and tabs in IndexedDB with Dexie, and mark a stored import that no longer passes the schema ([Idempotency and Rollback](open-sheet-site-discovery.md#idempotency-and-rollback)). Follow the design.

Verify manually: import a real export and a second one; two tabs open, named after their trainers; reload, and both are still there; a file with `pokemon` removed is refused with a message naming it; closing a tab removes it after a reload.
**Touches:** `pkmn/site/`
**After:** pkmn/site: scaffold the site; pkmn/site: design the Open Sheet screens

## pkmn/site: browse a sheet

Show a tab's sheet with `@pkmn/dex` and `@pkmn/img` ([Interfaces and Integration](open-sheet-site-discovery.md#interfaces-and-integration)): a card per Pokémon (sprite, shiny and gender, nickname, level, nature, types with the mismatch flag, base stats, current and possible abilities with descriptions), the items with icons, quantities and descriptions, the TMs with their move's type, category, power, accuracy and description; unknown IDs by raw ID with a marker and `tinymushroom` labelled; search by name and filters for type, ability and level, and for a TM's move type and category. Follow the design.

Verify manually: on a real export, the party's Walrein shows its sprite, Showdown's base stats and its abilities' descriptions; filtering by Ice type keeps only Ice Pokémon; `tinymushroom` reads "Mini Seta (Tiny Mushroom)"; a hand-edited export with an unknown species shows it marked, without breaking the page; on a phone-width window every view is readable.
**Touches:** `pkmn/site/`
**After:** pkmn/site: import exports into tabs

## pkmn/site: build teams

Build the PC-style builder of [The Builder and the Team Page](open-sheet-site-discovery.md#the-builder-and-the-team-page): named teams per tab (create, rename, duplicate, delete), stored with Dexie; Pokémon dragged from a box grid into six slots; items held under the quantity limit; abilities switchable with the Mini Seta count against `tinymushroom`; four move slots offering the tab's TMs, then any Gen 1–5 move; tap-to-add on a phone. Follow the design.

Verify manually: with one `leftovers` in the tab, a second member cannot take it; switching two members' abilities shows 2 Mini Setas needed against the tab's count; a TM's move and a free-picked move both fill slots; two teams in one tab survive a reload; on a phone, tapping a Pokémon adds it to the team.
**Touches:** `pkmn/site/`
**After:** pkmn/site: browse a sheet

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
