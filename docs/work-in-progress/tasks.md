# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/tools: leave out items Showdown does not model

Apply the decision in [Open Sheet Export → Decisions](../pkmn/tools/explanation/open-sheet-export.md#decisions) that an item counts as having a Showdown ID only when that ID is in Showdown's own item data (`data/items.ts`), with TMs exempt: the generator checks the items it ships against that list, so the export leaves the rest out with its existing no-Showdown-ID notice, and the reference under `docs/pkmn/tools/` says which list the item IDs are checked against and that a TM's `item` is a label outside it.

Verify manually: on `Partida 1`, the 17 items absent from Showdown's `items.ts` (among them `repel`, `amuletcoin`, `smokeball`, `luckyegg`, `starpiece`) are gone from the file and each is named in a notice; every other `item` is in `items.ts`; the 101 TMs are unchanged; running the generator twice leaves the script unchanged.
**Touches:** `pkmn/tools/`, `docs/pkmn/tools/`

## pkmn/tools: count the held items of permafainted Pokémon

Apply the decision in [Open Sheet Export → Decisions](../pkmn/tools/explanation/open-sheet-export.md#decisions) that held items of permafainted Pokémon count as shared: `held_items` in `pkmn/tools/export_data.py` takes them from every Pokémon in the party and boxes that is not an egg, not only from those exported, under the same pocket rule, and the docs under `docs/pkmn/tools/` that describe where held items come from say so.

Verify manually: in a copy of `Partida 1` where a permafainted boxed Pokémon holds `LEFTOVERS`, the export's `leftovers` quantity is one more than on the unchanged save and that Pokémon is still absent; on the unchanged save the file is identical to before unless a permafainted Pokémon there already holds an item.
**Touches:** `pkmn/tools/export_data.py`, `docs/pkmn/tools/`

## pkmn: scope the Open Sheet web app

Run `/scope` for part 2 of [Open Sheet](open-sheet.md): the web app that shows a player's export and helps the reader navigate it, reading the JSON the export's reference under `docs/pkmn/tools/` describes and looking its Showdown IDs up in a Showdown data source. The scope doc decides where the app lives, which Showdown data it reads and how, and what navigating an export means, and writes the app's tasks into this queue.

Verify manually: a scope doc for the web app exists in `docs/work-in-progress/` and is linked from [Open Sheet](open-sheet.md) and the [Work in Progress](index.md) index; its tasks are in this queue.
**Touches:** `docs/work-in-progress/`
**Needs the author:** part 2 is not designed yet; its `/scope` interview needs the owner.
