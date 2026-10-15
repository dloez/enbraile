# Open Sheet Export

The export is part 1 of [Open Sheet](../../../work-in-progress/open-sheet.md). A player runs it on their own Pokémon Añil save and gets one JSON file holding the Pokémon, items and TMs they share with their rival for an open-sheet fight. Part 2's web app reads that file. Every name the file carries comes from an outside source, Showdown, and never from the game's text, because the game's descriptions do not hold on other platforms, Showdown included, where the fights are played. The file's fields are in the [JSON reference](../reference/open-sheet-json.md); running and sharing it is in [How to Run and Share the Open Sheet Export](../how-to/run-the-open-sheet-export.md).

It is done when, run in WSL on a real save, it writes a file listing each living Pokémon and each shared item and TM with the fields below and nothing else, prints a notice for everything it left out or could not read, and changes nothing in the save. It was scoped with the owner on 2026-10-15, from the leads of the [Origin Conversation](../../../work-in-progress/open-sheet-origin-conversation.md) and a probe of the owner's own save (`Partida 1.rxdata`, 11.7 MB).

## What Goes Out

**Pokémon.** The party and every PC box, in party then box order. Eggs are left out (the 16 mod eggs among them), and so are permafainted Pokémon (`@perma_faint` true): neither can be fielded. Each Pokémon carries its species-form, nickname, gender, shiny, level, nature, its current ability, the abilities it can have under the randomizer, and its types. Nothing else: no moves of any kind (neither its current four nor its learnset), no place (party or box slot), no stats, IVs, EVs, HP, EXP, happiness or personal ID. Final stats would let the rival work back the IVs and EVs.

**Abilities.** The ones it can have are the randomized ones, never the vanilla ones: its species-form's entry in `$randomized_data[:abilities]`, with `base` and `hidden` kept apart. A Pokémon whose Random Ability Capsule rolled it a list of its own (`$PokemonGlobal.random_abs_pokes[pokemon.id]`) gets that list, and `@forced_ability` overrides the current ability, as the game's `getAbilityList` and `ability_id` do (`P/Random Pokemon & Moves + Randomizer EX (Abilities)/008_RandomAbilityCapsule.rb:66-93`, `002_Abilities.rb:230-234`). Shedinja keeps its real abilities by design (`SPECIES_WITHOUT_RANDOM_ABS`, `000_Config.rb:219`, which also names `MEWTWO_5`, not an allowed species-form); they ship with the script and are used with no notice.

The current ability follows the game's load order: a Random Ability Capsule roll first (`008_RandomAbilityCapsule.rb` wraps `ability_id` last), then `@forced_ability`, then `@ability`, then the table. A capsule list that is empty is skipped, as the game skips it (`008_RandomAbilityCapsule.rb:75-93`), so the ability comes from `@forced_ability` or `@ability`; the possible abilities stay that empty list, which is what the game's `getAbilityList` returns, and the table step reads that empty list. The capsule only rolls an empty list for a Pokémon whose randomized abilities are empty, and then clears `@ability` and `@ability_index` (`008_RandomAbilityCapsule.rb:16-53`), so the game's own table step finds nothing either. `@ability` stays nil until the game first calls `ability_id`; the script then works it out the same way the game would, from the species-form's table entry, `@ability_index`, and `@personalID & 1` (Wonder: `docs/domains/game/reference/randomizer.md`, "A starter's ability" and "A trainer Pokémon's ability", the second matched on 77 trainer Pokémon).

**Other Pokémon fields.** The form is `@forced_form`, else `@form`, as the game's `species_data` reads it. `shiny` is `@shiny`, or worked out from the personal ID and the owner's ID as `shiny?` does when it is nil. The nature is the one that sets the stats, `@nature_for_stats` when a mint set it, else `@nature`, as `nature_for_stats` reads it: a Showdown nature only changes stats, so the minted one is the one that holds in the fight (two Pokémon of the probed save are minted). `@level`, `@gender` and `@nature` are filled when the game makes or registers a Pokémon, and none was nil in the probed save; one that is nil goes out as null with a notice, since working it out needs growth rates and gender ratios the script does not ship.

**Items.** Pockets 1 (Objetos) and 5 (Bayas) whole, with their quantities, and the TMs of pocket 4, without HMs. The held item of each party and box Pokémon that is neither an egg nor permafainted is added to the items as if it were in the bag, under the same pocket rule, so a held Mega Stone (pocket 6) is left out. Pocket 1 carries some noise (evolution stones, Mochis), but taking it whole needs no hand-kept list of what counts as competitive, and Showdown fights have no bag use, so Obj. Batalla never matters. An item's pocket is the one `items.dat` gives it, the same table for bag and held items, so a held pocket 4 item goes out only when it is a TM. Items are merged by Showdown ID with their quantities summed, and a TM listed twice goes out once.

**TMs.** Each carries its TM item and the move it teaches: the save's `tm_move_map` entry when it has one, otherwise the item's own move in `items.dat`, as `GameData::Item#move` does (Wonder: `docs/domains/game/reference/game-data.md`, "Data the Mod Changes"). Which Pokémon can learn each TM is left out on purpose: the owner dropped TM compatibility on 2026-10-13, and since the game rolls it lazily an offline script could not answer it anyway.

**No header.** The file holds the Pokémon, items and TMs only: no trainer, badges, format version or export time. Part 2's web app reads whatever the current script writes, so there is no data migration to plan.

**Trust, not enforcement.** The script only filters what it writes; the IVs and EVs stay in the raw save, and keeping them hidden rests on trust between the players.

## Showdown IDs

The file names species-forms, abilities, items, moves, natures and types only by their Showdown IDs: the English Showdown name with everything but letters and digits removed, lowercased (`Choice Band` → `choiceband`), so any Showdown data source can be looked up by them. Showdown's data is what actually runs in the fights. PokéAPI was the alternative; its descriptions are the cartridge games', and carrying multilingual names was weighed and given up. The game's own names and descriptions are never exported.

Anything with no Showdown counterpart is left out with a notice naming its game ID, since it cannot exist in a Showdown fight and nothing may vanish silently. The names table covers 790 of the game's 887 items. Every ability the mod can roll has a Showdown name, since the mod limits them to the 164 Gen 1–5 ones (Wonder: `randomlocke/data/abilities.txt`), and so does every allowed species-form but one: `ARCEUS_9`, the ???-type Arceus (`QMARKS`), which Showdown lacks (Wonder's `showdown.txt` goes from `ARCEUS_8` to `ARCEUS_10`).

Which list the item IDs are checked against is still open; see [Open](#open).

## Notices

The script prints a notice, to the terminal and never into the JSON, for:

- each item or Pokémon left out for having no Showdown ID, naming an item once however many times it appears, and each TM whose move has no Showdown ID (none in the probed save);
- each Pokémon whose rolled abilities it cannot find, which then goes out without abilities;
- each Pokémon whose current ability it cannot work out, or whose current ability has no Showdown ID (a `@forced_ability` or stored `@ability` outside the rolled Gen 1–5 set), naming that ability; the Pokémon goes out with its `ability` null;
- each Pokémon whose level, gender or nature the save has not filled in;
- each Pokémon whose level already meets a level-up evolution of its species and that has not evolved;
- a save whose `@randomlocke_version` differs from the version the script's data was built for, the guard for data shipped inside the script.

The could-evolve notice skips evolutions into Gen 6+, which the mod blocks (Wonder: `docs/domains/competition/reference/rules.md`, "Gen 1–5 Limits"). It checks the level and whatever else of the evolution's own condition the save holds: the gender for `LevelMale` and `LevelFemale`, attack against defense for the stat comparisons, and the personal ID for `Silcoon` and `Cascoon`. Time of day, weather and place are not checked.

Beyond the notices, the run prints one closing line with how many Pokémon, items and TMs it wrote, and where.

## Data Shipped With the Script

The player points the script at the save and nothing else: no game folder. It ships the little game data it needs, embedded in the script as its `DATA` dict: the game ID → Showdown ID table, the mod's types per species-form, each item's pocket, each TM's default move, Shedinja's fixed abilities, the species' level-up evolutions, and the Randomlocke version the data was built for, which the version notice compares the save's `@randomlocke_version` against. One set of data serves every player because everyone plays the same package (Wonder: `docs/domains/competition/reference/rules.md`, "The Group's Rules"), and the probe confirmed that evolutions and types are not randomized in a real save (`@enable_random_evolutions` and `@enable_random_types` false).

A generator, `pkmn/tools/generate_export_data.py`, run by the owner only, builds that data by reading Wonder in place: `packages/randomlocke/src/randomlocke/data/showdown.txt` (built from PokéAPI's English names, covering species-forms, abilities, items, moves and natures), `types.txt`, and `species.txt` (the species the mod allows, which bounds the level-up evolutions), the build's `Data/items.dat` and `species.dat`, the mod's `000_Config.rb` from Wonder's extracted game, and the `VERSION` constant of Wonder's `randomlocke/sources.py`, read as text, as the Randomlocke version. It copies nothing else from Wonder and imports none of Wonder's code; Wonder is not in Enbraile yet, and whether its shared material moves now is still [an open question](../../../work-in-progress/open-questions.md#shared-pokémon-material-before-wonder-moves). It reads the two `.dat` files with `rubymarshal`, which handles them though not the save. Its build rules:

- Types come from `types.txt`, falling back to `species.dat` for species-forms outside it, for every species-form with a Showdown ID.
- A TM's default move is the TM's own `@move`; HMs are left out.
- Shedinja's real abilities ship as `fixed_abilities`: the species-forms of `SPECIES_WITHOUT_RANDOM_ABS` that have a Showdown ID, with their `species.dat` abilities.
- A level-up evolution is any evolution whose parameter is a level (`Level` and its variants, the stat comparisons, `Silcoon`, `Cascoon`, `Ninjask`; not `Shedinja`, which adds a Pokémon rather than evolving one), kept only when its target is in the mod's `species.txt`, the list the mod's `check_evolution_internal` checks, so evolutions the mod blocks never reach the export.

## Reading the Save

The save is Ruby Marshal, read by a reader written for the script. `rubymarshal` fails on the owner's real save ("invalid link destination: Object id 5837 is not yet unmarshaled"): the save links back to objects still being read, which `rubymarshal` does not support. A minimal reader that registers each object before reading its contents reads the whole save in about a second.

Everything it reads sits under the save's top-level hash: `player` (`@party`), `storage_system` (`@boxes`, each with `@pokemon`), `bag` (`@pockets`, index 0 empty), `randomized_data` (`abilities`, 1,519 entries in the probed save), and `global_metadata` (`@tm_move_map`, each value a `GameData::Move` with `@id`; `@random_abs_pokes`, nil in the probed save; `@randomlocke_version`, 1). Field layouts are in Wonder's `docs/domains/game/reference/state.md`.

The run is safe to repeat: it opens the save read-only, never writes it, and writes only the JSON, so there is nothing to roll back. A save caught while the game writes it fails to parse; the run then ends with a message to let the game finish saving and run again, and writes nothing. The script needs no credentials and no settings file.

## Where It Runs and How It Travels

It runs in WSL only, reading the Windows save, because everyone in the group runs it there. It finds the save folder by itself: `%APPDATA%` from `cmd.exe /c echo %APPDATA%`, turned into a path with `wslpath`, falling back to a glob of `/mnt/c/Users/*/AppData/Roaming/`, then `Pokemon Anil/`. The game saves there because its `mkxp.json` leaves `dataPathApp` unset and `Game.ini`'s title is `Pokemon Anil`. It lists the `Partida N.rxdata` slots it finds, the names Multi Save gives them (`P/Multi Save/Multi Save.rb:31`), skipping backups and `.bak` files, and takes the only one or lets the player pick; `--save PATH` reads another file. When it finds none, it says where it looked and points to `--save`.

The export is one self-contained file, `pkmn/tools/export_data.py`, with its dependencies declared inline (PEP 723) and its data embedded, so `uv run` needs nothing beside it. That is what lets the owner post it as a GitHub Gist and a rival run it straight from the Gist's raw URL, always getting the latest; sending the file itself works as well. `tools` is the pkmn project for small scripts like this one, so its docs live here and part 2's web app links to them.

## Decisions

- **The export's purpose:** one JSON file of what a player shares, read by part 2's web app; every name from an outside source, never the game's text. **Why:** the game's descriptions do not hold on Showdown, where the fights are played. _(owner, 2026-10-15)_
- **Party and every box go out; eggs and permafainted Pokémon do not.** **Why:** neither can be fielded. _(owner, 2026-10-15)_
- **Each Pokémon carries species-form, nickname, gender, shiny, level, nature, current ability, possible abilities and types, and nothing else.** **Why:** final stats would let the rival work back the IVs and EVs. _(owner, 2026-10-15)_
- **Possible abilities are the randomized ones,** with a capsule roll's own list and `@forced_ability` honoured as the game does, and Shedinja's real abilities with no notice. **Why:** the owner asked for the randomized ones; the per-Pokémon list and the forced ability are forced by the game's code. _(owner, 2026-10-15)_
- **A current ability the save has not filled in is worked out** from the table entry, `@ability_index` and `@personalID & 1`, as the game does. _(settled 2026-10-15)_
- **Items are pockets 1 and 5 whole plus pocket 4's TMs, with held items added under the same rule.** **Why:** no hand-kept list of competitive items is needed, and Showdown has no bag use. _(owner, 2026-10-15)_
- **A TM carries its item and its move, never its compatibility.** **Why:** compatibility was dropped on purpose and is rolled lazily, so an offline script cannot answer it. _(owner, 2026-10-13 and 2026-10-15)_
- **No header** of trainer, badges, format version or export time. _(owner, 2026-10-15)_
- **Hiding IVs and EVs is not enforced;** it rests on trust. _(owner, 2026-10-15)_
- **Showdown IDs only,** for species-forms, abilities, items, moves, natures and types. **Why:** Showdown's data is what runs in the fights; PokéAPI and carrying both were rejected. _(owner, 2026-10-15)_
- **An item with no Showdown ID is left out with a notice.** **Why:** it cannot exist in a Showdown fight, and nothing should vanish silently. _(owner, 2026-10-15)_
- **A Pokémon with no Showdown species (only `ARCEUS_9`) is left out with a notice,** the item rule applied to Pokémon. **Why:** the agent's inference from the owner's item rule, for the owner to overturn. _(settled 2026-10-15)_
- **Notices** for what is left out, abilities not found, could-evolve Pokémon and a Randomlocke version mismatch, printed to the terminal only. **Why:** the owner asked for the first three; the version notice guards the data shipped inside the script. _(owner, 2026-10-15)_
- **The player points the script at the save only; the game data ships inside it.** **Why:** the owner wanted no game folder, and every player plays the same package. _(owner, 2026-10-15)_
- **The generator reads Wonder in place,** copying nothing else and importing none of its code. **Why:** whether Wonder's shared material moves now is still open, and reading it in place decides nothing early. _(settled 2026-10-15)_
- **The generator's build rules** (rubymarshal for the `.dat` files, the version from `sources.py`, types with a `species.dat` fallback, TM moves from `@move` without HMs, `fixed_abilities`, level-up evolutions kept only into the mod's `species.txt`): the implementer's build choices. _(settled 2026-10-15)_
- **The save is read with a Marshal reader written for the script.** **Why:** forced by the probe: `rubymarshal` cannot follow the save's links back to objects still being read. _(settled 2026-10-15)_
- **The script's build rules** (the JSON shape in the [reference](../reference/open-sheet-json.md), items merged by Showdown ID, the form from `@forced_form`, shiny worked out when nil, missing level, gender or nature exported as null with a notice, the minted nature, the ability load order with an empty capsule list skipped and a notice for a current ability not exported, the could-evolve checks, an unparseable save writing nothing): the implementer's build choices. _(settled 2026-10-15)_
- **WSL only, finding the save folder by itself.** **Why:** everyone runs it in WSL. _(owner, 2026-10-15)_
- **The player picks among the `Partida N` slots found, or names a file with `--save`.** _(owner, 2026-10-15)_
- **The JSON goes to `<trainer name>-open-sheet.json` in the working folder, or `--out`.** _(settled 2026-10-15)_
- **One self-contained PEP 723 file, in `pkmn/tools/`, shared as a GitHub Gist run by its raw URL.** **Why:** the owner's choice, once it was clear `uv` runs a script from a URL. _(owner, 2026-10-15)_

## Open

- See [Open Questions → Which item IDs count as Showdown's](../../../work-in-progress/open-questions.md#which-item-ids-count-as-showdowns).
- See [Open Questions → Held items of permafainted Pokémon](../../../work-in-progress/open-questions.md#held-items-of-permafainted-pokémon).
