# Open Sheet: Export Script Discovery

The decisions behind part 1 of [Open Sheet](open-sheet.md): the script that reads a player's save and writes what they share for an open-sheet fight to JSON. Scoped with the owner on 2026-10-15, from the [Origin Conversation](open-sheet-origin-conversation.md)'s leads and a probe of the owner's own save.

## Goal and Success

**Q: What is the export for?**
A: A player runs it on their own save and gets one JSON file holding the Pokémon, items and TMs they share with their rival. Part 2's web app reads that file. Every name and description comes from an outside source, never from the game's text.
**Why:** the owner: the game's descriptions are not true on other platforms, Showdown included, where the fights are played.

**Q: When is it done?**
A: Run in WSL on a real save, it writes a file that lists each living Pokémon and each shared item and TM, with the fields below and nothing else, prints a notice for everything it left out or could not read, and changes nothing in the save.

## Scope Edges

**Q: Which Pokémon go out?**
A: The party and every PC box. Eggs are left out (the 16 mod eggs among them), and so are permafainted Pokémon (`@perma_faint` true).
**Why:** neither can be fielded. The owner's choice.

**Q: Which fields go out for each Pokémon?**
A: Species and form, nickname, gender, shiny, level, nature, its current ability, the abilities it can have under the randomizer, and its types. Nothing else for now: no moves of any kind (neither its current four nor its learnset), no place (party or box slot), no stats, IVs, EVs, HP, EXP, happiness or personal ID.
**Why:** the owner's choice. Final stats would let the rival work back the IVs and EVs ([Origin Conversation](open-sheet-origin-conversation.md)).

**Q: Which abilities count as "the ones it can have"?**
A: The randomized ones, never the vanilla ones: its species-form's entry in `$randomized_data[:abilities]` (`base` and `hidden`, kept apart). A Pokémon whose Random Ability Capsule rolled it a list of its own (`$PokemonGlobal.random_abs_pokes[pokemon.id]`) gets that list, and `@forced_ability` overrides the current ability, the way the game's `getAbilityList` and `ability_id` do (`P/Random Pokemon & Moves + Randomizer EX (Abilities)/008_RandomAbilityCapsule.rb:66-93`, `002_Abilities.rb:230-234`). Shedinja keeps its real abilities by design (`SPECIES_WITHOUT_RANDOM_ABS`, `000_Config.rb:219`, which also names `MEWTWO_5`, not an allowed species-form), taken from the species data with no notice.
**Why:** the owner asked for the randomized ones; the per-Pokémon list and the forced ability are forced by the code, which leaves no other correct reading.

**Q: Where does the current ability come from when the save has not filled it in?**
A: `@ability` stays nil until the game first calls `ability_id`. The script then works it out the same way: from the species-form's table entry, `@ability_index`, and `@personalID & 1` (Randomizer → Reading the Caches (Wonder: `docs/domains/game/reference/randomizer.md`), "A starter's ability" and "A trainer Pokémon's ability", the second matched on 77 trainer Pokémon).

**Q: Which items go out?**
A: Pockets 1 (Objetos) and 5 (Bayas) whole, with their quantities, and the TMs of pocket 4 (no HMs). Each Pokémon's held item is taken off it and added to the items as if it were in the bag, under the same pocket rule, so a held Mega Stone (pocket 6) is left out.
**Why:** the owner's choice. Pocket 1 carries some noise (evolution stones, Mochis), but needs no hand-kept list of what counts as competitive. Fights on Showdown have no bag use, so Obj. Batalla never matters.

**Q: What does a TM carry?**
A: Its TM item and the move it teaches: the `tm_move_map` entry when it has one, otherwise the item's own move in `items.dat`, as `GameData::Item#move` does (Game Data → Data the Mod Changes (Wonder: `docs/domains/game/reference/game-data.md`)). Which Pokémon can learn each TM is left out.
**Why:** the owner dropped TM compatibility on purpose (2026-10-13, [Origin Conversation](open-sheet-origin-conversation.md)). It is rolled lazily, so an offline script cannot answer it.

**Q: Is there a header (trainer, badges, format version, export time)?**
A: No. The file holds the Pokémon, the items and the TMs only.
**Why:** the owner's choice.

**Q: Is hiding IVs and EVs enforced?**
A: No. The script only filters what it writes; the IVs stay in the raw save. It works on trust between the players ([Origin Conversation](open-sheet-origin-conversation.md)).

## Interfaces and Integration

**Q: Which identifiers does the JSON carry?**
A: Showdown IDs only, for species-forms, abilities, items, moves, natures and types: the English Showdown name with everything but letters and digits removed, lowercased (`Choice Band` → `choiceband`), so any Showdown data source can be looked up by them. The game's own text (names, descriptions) is never exported.
**Why:** the owner chose Showdown over PokéAPI and over carrying both: its data is what actually runs in the fights. PokéAPI's descriptions are the cartridge games', and multilingual names were weighed and given up.

**Q: What about an item or a Pokémon with no Showdown counterpart?**
A: It is left out, and the script prints its game ID in a notice. The names table covers 790 of the 887 items. Every ability the mod can roll has a Showdown name, since the mod limits them to the 164 Gen 1–5 ones (`randomlocke/data/abilities.txt`), and so does every allowed species-form but one: `ARCEUS_9`, the ???-type Arceus (`QMARKS`), which Showdown lacks (`showdown.txt` goes from `ARCEUS_8` to `ARCEUS_10`). A Pokémon with no Showdown species is left out the same way, with a notice.
**Why:** the owner, for items: it cannot exist in a Showdown fight, and nothing should vanish silently. The same reason holds for the one species-form, so it gets the same rule: the agent's inference from the owner's item rule, for the owner to overturn _(2026-10-15)_.

**Q: What notices does the script print?**
A: One for each item or Pokémon left out for having no Showdown ID. One for each Pokémon whose rolled abilities it cannot find (it is then exported without abilities). One for each Pokémon whose level already meets a level-up evolution of its species and that has not evolved, skipping evolutions into Gen 6+, which the mod blocks (Rules → Gen 1–5 Limits (Wonder: `docs/domains/competition/reference/rules.md`)). A last one when the save's `@randomlocke_version` differs from the version the script's data was built for. Notices go to the terminal and never into the JSON.
**Why:** the owner asked for the first three; the version notice is the build's guard for data shipped inside the script.

## Surfaces, Reuse and Data

**Q: What does the player point the script at?**
A: Only the save. The script ships the little game data it needs, generated once: the game ID → Showdown name table, the mod's types per species-form, each item's pocket, each TM's default move, and the species' level-up evolutions.
**Why:** the owner: no game folder. Every player plays the same package (Rules → The Group's Rules (Wonder: `docs/domains/competition/reference/rules.md`)), so one set of data serves them all. The probe confirmed that evolutions and types are not randomized in a real save (`@enable_random_evolutions` and `@enable_random_types` false), so they can ship with the script.

**Q: Where does that data come from?**
A: A generator, run by the owner only, reads it from Wonder in place: `packages/randomlocke/src/randomlocke/data/showdown.txt` (built from PokéAPI's English names, covering species-forms, abilities, items, moves and natures) and `types.txt`, and the build's `Data/items.dat` and `species.dat`. It writes the data into the script itself. It copies nothing else from Wonder and imports none of Wonder's code.
**Why:** Wonder is not in Enbraile yet, and whether its shared material moves now is still open ([Open Questions → Shared Pokémon material before Wonder moves](open-questions.md#shared-pokémon-material-before-wonder-moves)). Reading it in place answers nothing early.
**Built:** `pkmn/tools/generate_export_data.py`, run with `uv run pkmn/tools/generate_export_data.py [WONDER]` (default `~/workspace/wonder`), replaces the `DATA` dict in `export_data.py` and rewrites nothing when the data is unchanged. The implementer's build choices _(2026-10-15)_:
- It reads the two `.dat` files with `rubymarshal`, which handles them though not the save.
- The Randomlocke version is the `VERSION` constant of Wonder's `randomlocke/sources.py`, read as text.
- Types come from `types.txt`, falling back to `species.dat` for species-forms outside it, for every species-form with a Showdown ID.
- The TM moves are the TMs' own `@move`, with HMs left out.
- Shedinja's real abilities ship as `fixed_abilities`: the species-forms of `SPECIES_WITHOUT_RANDOM_ABS`, read from the mod's `000_Config.rb` in Wonder's extracted game, that have a Showdown ID, with their `species.dat` abilities.
- A level-up evolution is any evolution whose parameter is a level (`Level` and its variants, the stat comparisons, `Silcoon`, `Cascoon`, `Ninjask`; not `Shedinja`, which adds a Pokémon rather than evolving one), kept only when its target is in the mod's `species.txt`, the list the mod's `check_evolution_internal` checks, so evolutions the mod blocks never reach the export.

**Q: How is the save read?**
A: With a Marshal reader written for the script. `rubymarshal` fails on the owner's real save ("invalid link destination: Object id 5837 is not yet unmarshaled"): the save links back to objects still being read, which `rubymarshal` does not support. A minimal reader that registers each object before reading its contents read the whole save in the probe.
**Why:** forced by the probe (2026-10-15, `Partida 1.rxdata`, 11.7 MB).
**Built:** `pkmn/tools/export_data.py` reads it in about a second. The implementer's build choices _(2026-10-15)_:
- The JSON is `{"pokemon": [...]}`, each Pokémon with `species` (the species-form's Showdown ID), `nickname` (null when it has none), `gender` (`M`, `F` or `N`), `shiny`, `level`, `nature`, `ability`, `abilities` (`base` and `hidden`, or null when the rolled ones were not found) and `types`, in party then box order. Beside it, `items` holds `{"item", "quantity"}` entries and `tms` holds `{"item", "move"}` entries, each item and move as its Showdown ID (a TM's is `tm01` and so on).
- The items are read from the bag in pocket order, then the held items in party then box order, each held item counting 1. An item's pocket is the one `items.dat` gives it, the same table for bag and held items, so a held item from pocket 4 goes to `tms` only when it is a TM. Items are merged by Showdown ID with their quantities summed; a TM listed twice is written once. An item with no Showdown ID is named once in a notice however many times it appears. A TM whose move has no Showdown ID is left out with a notice the same way; none does in the probed save.
- The form is `@forced_form`, else `@form`, as the game's `species_data` reads it; a form above 0 makes the species-form `<SPECIES>_<form>`.
- `shiny` is `@shiny`, or worked out from the personal ID and the owner's ID as `shiny?` does when it is nil. `@level`, `@gender` and `@nature` are filled when the game makes the Pokémon or registers it, and none was nil in the probed save; one that is nil is exported as null with a notice rather than worked out, since that needs growth rates and gender ratios the script does not ship.
- `nature` is the one that sets the stats: `@nature_for_stats` when a mint set it, else `@nature`, as the game's `nature_for_stats` reads it. A Showdown nature only changes stats, so the minted one is the one that holds in the fight; two Pokémon of the probed save are minted.
- The current ability follows the game's load order: a Random Ability Capsule roll first (`008_RandomAbilityCapsule.rb` wraps `ability_id` last), then `@forced_ability`, then `@ability`, then the table fallback.
- The could-evolve notice checks the level and whatever else of the evolution's own condition the save holds: the gender for `LevelMale` and `LevelFemale`, attack against defense for the stat comparisons, and the personal ID for `Silcoon` and `Cascoon`. Time of day, weather and place are not checked.
- A save that cannot be parsed ends the run with the finish-saving message and writes nothing.

**Q: Where are the things it reads in the save?**
A: All under the save's top-level hash, as the probe read them: `player` (`@party`), `storage_system` (`@boxes`, each with `@pokemon`), `bag` (`@pockets`, index 0 empty), `randomized_data` (`abilities`, 1,519 entries), and `global_metadata` (`@tm_move_map`, each value a `GameData::Move` with `@id`; `@random_abs_pokes`, nil in the probed save; `@randomlocke_version`, 1). Field layouts are in State (Wonder: `docs/domains/game/reference/state.md`).

**Q: Where does the code live?**
A: `pkmn/tools/`. The export is one self-contained file, `pkmn/tools/export_data.py`, with its dependencies declared inline (PEP 723) and the generated data embedded, plus the generator beside it. `tools` is a pkmn project of small scripts, so the export's lasting docs go under `docs/pkmn/tools/`, and part 2's web app links to them.

## Portability and Environment

**Q: Where does it run?**
A: In WSL only, reading the Windows save. It finds the save folder by itself: `%APPDATA%` from `cmd.exe /c echo %APPDATA%` turned into a path with `wslpath`, falling back to a glob of `/mnt/c/Users/*/AppData/Roaming/`, then `Pokemon Anil/`. The game saves there because `mkxp.json` leaves `dataPathApp` unset and `Game.ini`'s title is `Pokemon Anil`. The owner's saves are at `/mnt/c/Users/david/AppData/Roaming/Pokemon Anil/`.
**Why:** the owner: everyone runs it in WSL.

**Q: How does a player choose a save?**
A: The script lists the `Partida N.rxdata` slots it finds (backups and `.bak` files skipped) and the player picks one; with one slot it takes it. `--save PATH` reads that file instead. When no save is found, it says where it looked and points to `--save`.
**Why:** the owner's ask; slots are named by Multi Save (`P/Multi Save/Multi Save.rb:31`).

**Q: How does a rival get it?**
A: The owner posts the file as a GitHub Gist, and the rival runs `uv run <the Gist's raw URL>`, which always gives the latest. Sending the file and running `uv run export_data.py` works as well.
**Why:** the owner's choice, once it was clear `uv` runs a script from a URL.

**Q: Where is the JSON written?**
A: `<trainer name>-open-sheet.json` in the folder it was run from, overwriting a file of that name; `--out PATH` writes elsewhere.

## Idempotency and Rollback

**Q: Is it safe to run again?**
A: Yes. It opens the save read-only, never writes it, and writes only the JSON. A save caught while the game writes it fails to parse; the script then says to finish saving and run it again. There is nothing to roll back.

## Observability

**Q: What does it log?**
A: Nothing beyond the notices above and a closing line with how many Pokémon, items and TMs it wrote, and where.

## Not Applicable

- **Secrets and config:** none. The script needs no credentials and no settings file.
- **Data migrations:** none. The JSON has no format version (no header), so part 2's web app reads what the current script writes.

## References

- [Open Sheet](open-sheet.md), the brief
- [Origin Conversation](open-sheet-origin-conversation.md)
- Wonder: `docs/domains/game/reference/state.md`, `game-data.md`, `randomizer.md`; `docs/domains/competition/reference/rules.md`; `packages/randomlocke/src/randomlocke/data/`; `packages/randomlocke/src/randomlocke/showdown.py`
- The game's scripts: `game/extracted/es-v4.14/plugins/Random Pokemon & Moves + Randomizer EX (Abilities)/` (`002_Abilities.rb`, `003_Items.rb`, `008_RandomAbilityCapsule.rb`), `plugins/Multi Save/Multi Save.rb`, `game/base/es-v4.14/mkxp.json`, `Game.ini`
