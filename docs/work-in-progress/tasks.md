# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/tools: export the items and TMs

Add the items and TMs of [Scope Edges](open-sheet-export-discovery.md#scope-edges) to the export: pockets 1 and 5 with quantities, held items merged under the same pocket rule, pocket 4's TMs with their moves, and the notice for items with no Showdown ID.

Verify manually: run on `Partida 1`; Walrein's `leftovers` is counted in the items; no item comes from pockets 2, 3, 6, 7 or 8; each TM shows its rolled move, matching the in-game bag's MT list for three TMs picked at random; every item the notice names is absent from the file.
**Touches:** `pkmn/tools/`

## pkmn/tools: document the export

Move the lasting content of the [Export Script Discovery](open-sheet-export-discovery.md) into `docs/pkmn/tools/`: an explanation doc holding its decisions, a reference for the JSON the export writes, and a how-to for running it and for posting it as a Gist; then delete the discovery doc and update [Open Sheet](open-sheet.md), the [Work in Progress](index.md) index and `docs/pkmn/index.md` (a row for the `tools` project).

Verify manually: every decision in the discovery doc has a home under `docs/pkmn/tools/`; `grep -rn open-sheet-export-discovery docs/` finds nothing; following the how-to, a Gist's raw URL run with `uv run` in WSL writes the same file as the local script.
**Touches:** `docs/pkmn/`, `docs/index.md`, `docs/work-in-progress/open-sheet.md`, `docs/work-in-progress/index.md`, `docs/work-in-progress/open-sheet-export-discovery.md`
**After:** pkmn/tools: export the items and TMs
