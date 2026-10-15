# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/tools: notice the export's unreadable current ability

The export writes `"ability": null` without a notice when a Pokémon's current ability has no Showdown ID (a `@forced_ability` or a stored `@ability` outside the rolled Gen 1–5 set), and when a Random Ability Capsule list is empty, where the game falls through to `@forced_ability` and `@ability` (`008_RandomAbilityCapsule.rb:75-93`) but the script returns nothing. Make both follow the export's notice rule (a notice for everything it could not read) and the game's ability load order, both recorded in the export's explanation doc under `docs/pkmn/tools/`, and update the export's docs under `docs/pkmn/tools/` to match.

Verify manually: in a copy of `Partida 1` whose Walrein has `@forced_ability` set to an ability with no Showdown ID, the run prints a notice naming it and Walrein's `ability` is null; with `$PokemonGlobal.random_abs_pokes` holding an empty list for Walrein's `@id`, its `ability` reads `bigpecks`; on the unchanged save the file is identical to before.
**Touches:** `pkmn/tools/export_data.py`, `docs/pkmn/tools/`

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

## pkmn: scope the Open Sheet web app

Run `/scope` for part 2 of [Open Sheet](open-sheet.md): the web app that shows a player's export and helps the reader navigate it, reading the JSON the export's reference under `docs/pkmn/tools/` describes and looking its Showdown IDs up in a Showdown data source. The scope doc decides where the app lives, which Showdown data it reads and how, and what navigating an export means, and writes the app's tasks into this queue.

Verify manually: a scope doc for the web app exists in `docs/work-in-progress/` and is linked from [Open Sheet](open-sheet.md) and the [Work in Progress](index.md) index; its tasks are in this queue.
**Touches:** `docs/work-in-progress/`
**Needs the author:** part 2 is not designed yet; its `/scope` interview needs the owner.
