# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/tools: decide which item IDs count as Showdown's

The export's "Showdown ID" for an item is the Showdown-style ID of its PokéAPI English name (Wonder's `showdown.txt`), not an entry of Showdown's own item data. Of the 306 nameable pocket 1 items, 67 are absent from Showdown's `data/items.ts` (Repels, Shards, Apricorns, Nuggets, Relics, Mulches and the like), and so is every TM item (`tm01` to `tm125`); the decision says an item with no Showdown counterpart is left out because it cannot exist in a Showdown fight, and that the IDs let any Showdown data source be looked up. Record the answer in the export's explanation doc under `docs/pkmn/tools/`, close the open question, and change the generator and the script if the answer changes what goes out.

Verify manually: the export's explanation and reference docs state which item list the IDs are checked against and what a TM's `item` holds; every `item` in a fresh export of `Partida 1` is found in that list, or the docs say why not.
**Touches:** `pkmn/tools/`, `docs/pkmn/tools/`, `docs/work-in-progress/open-questions.md`
**Needs the author:** should items absent from Showdown's own item data (TMs, Repels, Nuggets and the rest of pocket 1's non-battle items) be left out with a notice, kept as now, or kept only for TMs, whose `move` is what the rival reads?

## pkmn/tools: decide whether permafainted Pokémon's held items go out

The export takes held items only from the Pokémon it exports (`held_items` uses `all_pokemon`, which drops eggs and permafainted Pokémon), so an item a permafainted Pokémon holds is left out with no notice, though the player can take it back (releasing a Pokémon returns its held item to the bag, `S/314_UI_PokemonStorage.rb:2022-2050`). The scope says each Pokémon's held item is added to the items and that nothing vanishes silently. Record the answer in the export's explanation doc under `docs/pkmn/tools/`, close the open question, and change the script if the answer changes what goes out.

Verify manually: in a copy of `Partida 1` where a permafainted boxed Pokémon holds `LEFTOVERS`, the export's `leftovers` quantity and notices match the recorded decision.
**Touches:** `pkmn/tools/export_data.py`, `docs/pkmn/tools/`, `docs/work-in-progress/open-questions.md`
**Needs the author:** do held items of permafainted Pokémon count as shared items, given the player can recover them by taking or releasing?

## pkmn/tools: post the open sheet export as a gist

The export's explanation decides it is shared as a GitHub Gist that a rival runs by its raw URL, and steps 3 and 4 of [How to Run and Share the Open Sheet Export](../pkmn/tools/how-to/run-the-open-sheet-export.md) say how, but no Gist exists yet (`gh gist list` on the logged-in owner account lists none, 2026-10-15), so a rival without the repository cannot run it the decided way. Post `pkmn/tools/export_data.py` with step 3, and record the result as the owner answers.

Verify manually: `gh gist list` shows the Gist; on `Partida 1`, `uv run <raw URL> --save <path> --out a.json` and `uv run pkmn/tools/export_data.py --save <path> --out b.json` write identical files (`cmp a.json b.json`), and the save's modification time is unchanged.
**Touches:** `docs/pkmn/tools/how-to/run-the-open-sheet-export.md`
**Needs the author:** may the Gist be posted, secret, from your GitHub account now, before the item-ID and permafainted-held-item questions settle (each answer that changes the script then needs a `gh gist edit`), and should its raw URL replace the `<owner>/<gist id>` placeholders in the how-to?

## pkmn: scope the Open Sheet web app

Run `/scope` for part 2 of [Open Sheet](open-sheet.md): the web app that shows a player's export and helps the reader navigate it, reading the JSON the export's reference under `docs/pkmn/tools/` describes and looking its Showdown IDs up in a Showdown data source. The scope doc decides where the app lives, which Showdown data it reads and how, and what navigating an export means, and writes the app's tasks into this queue.

Verify manually: a scope doc for the web app exists in `docs/work-in-progress/` and is linked from [Open Sheet](open-sheet.md) and the [Work in Progress](index.md) index; its tasks are in this queue.
**Touches:** `docs/work-in-progress/`
**Needs the author:** part 2 is not designed yet; its `/scope` interview needs the owner.
