# Snapshot Format

What a snapshot holds: the JSON object the site's export (`pkmn/site/api/_lib/export/`) makes from one `Partida N.rxdata` slot of a save zip, or that the site reads from an old export's JSON ([Old Exports](#old-exports)), stored as the `snapshot` row's `data` ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)), and its zod schema, `snapshotSchema` in `pkmn/site/shared/snapshot.ts`. Its first three keys, `pokemon`, `items` and `tms`, are the Open Sheet JSON the retired Python export wrote, and the site's export writes them the same way; the rest is what the Python export left out. Why each of the three keys' fields is there, and what is left out, is in [Save Export](../explanation/save-export.md). Where each value sits in the save is in [State](../../games/anil/reference/state.md). Every ID in `pokemon` and `tms` is a Showdown ID: the English Showdown name lowercased, with everything but letters and digits removed; `items` holds the save's own item IDs with a Showdown ID beside each. The rest of the save, which no page reads, is kept in the row's `world` column, never sent to a browser ([World](#world)).

```json
{
  "pokemon": [
    {
      "species": "walrein",
      "nickname": null,
      "gender": "M",
      "shiny": false,
      "level": 42,
      "nature": "modest",
      "ability": "thickfat",
      "abilities": {
        "base": ["thickfat", "icebody"],
        "hidden": ["oblivious"]
      },
      "types": ["ice", "water"],
      "ivs": {"hp": 31, "atk": 4, "def": 22, "spa": 29, "spd": 17, "spe": 9},
      "evs": {"hp": 12, "atk": 0, "def": 6, "spa": 40, "spd": 3, "spe": 8},
      "stats": {"hp": 140, "atk": 63, "def": 75, "spa": 85, "spd": 66, "spe": 53},
      "moves": {"current": ["surf", "icebeam"], "relearner": ["powdersnow", "surf"], "tms": ["icebeam"], "levels": {"surf": 32}},
      "personalId": 2078334086,
      "details": {"gameSpecies": "WALREIN", "heldItem": {"item": "LEFTOVERS", "showdown": "leftovers"}, "ball": "ULTRABALL", "rest": {"evo_step_count": 0, "…": "…"}, "…": "…"}
    }
  ],
  "items": [{"item": "LEFTOVERS", "showdown": "leftovers", "pocket": 1, "quantity": 2}, {"item": "REPEL", "showdown": null, "pocket": 1, "quantity": 3}],
  "tms": [{"item": "tm13", "move": "icebeam"}],
  "fainted": [{"species": "remoraid", "gameSpecies": "REMORAID", "nickname": "TRAMPANTOJO", "level": 14, "personalId": 2026315114, "…": "every other key of a pokemon[] entry"}],
  "bag": [{"pocket": 1, "items": [{"item": "LEFTOVERS", "showdown": "leftovers", "quantity": 1}]}],
  "trainer": {"name": "MIRAMEEE", "id": 2550780501, "publicId": 53845, "money": 1168806, "badges": [true, true, false, false, false, false, false, false]},
  "playTime": 134379.17,
  "pokedex": {"seen": 463, "owned": 132},
  "records": {"trainerBattlesWon": 229, "trainerBattlesLost": 2, "wildBattlesWon": 122, "wildBattlesLost": 287, "blackouts": 1},
  "hallOfFame": 0,
  "usedEncounters": [2, 3, 4],
  "saveSlot": "Partida 1",
  "randomlockeVersion": 1,
  "notices": ["SURSKIT (level 43) has not evolved into MASQUERAIN (level 25)."],
  "details": {"trainer": {"coins": 300, "…": "…"}, "position": {"map": 136, "x": 39, "y": 35, "direction": 8}, "…": "…"}
}
```

The values above are illustrative; `bag` always holds all eight pockets.

## Top Level

| Key | Type | Holds |
|-----|------|-------|
| `pokemon` | array of objects | Each living Pokémon of the party, the PC boxes and the Day Care, in one random order the export draws each time, so nothing tells where a player keeps a Pokémon |
| `items` | array of objects | Every item the player has: the bag first, in pocket order, then held items, then the PC's item storage, each item once ([`items[]`](#items)) |
| `tms` | array of objects | The TMs, in the order first found |
| `fainted` | array of objects | Each permafainted Pokémon (`@perma_faint`), in the same random order, with every key of a `pokemon[]` entry ([`fainted[]`](#fainted)) |
| `bag` | array of objects | The bag's eight pockets in order, every item in each |
| `trainer` | object | The trainer's name, ID, money and badges |
| `playTime` | number or null | `GameStats@play_time`, in seconds; null when the save has none |
| `pokedex` | object | `seen` and `owned`: how many species the Pokédex marks as seen and as owned, counted as the game counts them; each null in an old export's snapshot |
| `records` | object | `GameStats`' battle counts: `trainerBattlesWon`, `trainerBattlesLost`, `wildBattlesWon`, `wildBattlesLost` (fleeing included) and `blackouts` (`@blacked_out_count`), each an integer or null |
| `hallOfFame` | integer or null | How many teams `$PokemonGlobal@hallOfFame` holds; 0 before the League is won; null in an old export's snapshot |
| `usedEncounters` | array of integers | The map IDs whose first encounter is used (`challenge_encs`), ascending |
| `saveSlot` | string or null | The Multi Save slot name (`Partida 1`) |
| `randomlockeVersion` | integer or null | The save's `@randomlocke_version` |
| `notices` | array of strings | The export's notices ([Save Export → Notices](../explanation/save-export.md#notices)), the version notice included |
| `details` | object, or absent | What else the save holds ([Details](#details)); absent in a snapshot exported before 2026-10-27 and in an old export's |

## `pokemon[]`

| Key | Type | Holds |
|-----|------|-------|
| `species` | string | The species-form's ID (a form above 0 is its own species-form, e.g. `rotomwash`) |
| `nickname` | string or null | The nickname; null when it has none |
| `gender` | `"M"`, `"F"`, `"N"` or null | Male, female or genderless; null when the save has not filled it in |
| `shiny` | boolean | Whether it is shiny |
| `level` | integer or null | Its level; null when the save has not filled it in |
| `nature` | string or null | The nature that sets its stats (a mint's when one was used); null when the save has not filled it in, or when it has no Showdown ID |
| `ability` | string or null | Its current ability; null, with a notice, when it cannot be worked out or has no Showdown ID |
| `abilities` | object or null | The abilities it can have under the randomizer, as `base` and `hidden` arrays of IDs; null when the rolled abilities were not found |
| `types` | array of strings | Its one or two types |
| `ivs` | object or null | Its IVs, 0 to 31, keyed `hp`, `atk`, `def`, `spa`, `spd`, `spe`; a Hyper-Trained stat counts 31; null, with a notice, when the save has not filled them in |
| `evs` | object or null | Its EVs, keyed the same way; null, with a notice, when the save has not filled them in |
| `stats` | object or null | Its stats at its own level as the game stores and shows them, keyed the same way; null, with a notice, when the save has not filled them in |
| `moves` | object | Always in a save zip's snapshot; a Python export holds it only when run with its moves option: `current`, the moves it knows now, in slot order; `relearner`, its first moves then its rolled learnset up to its level; `tms`, the moves of the bag's TMs it is compatible with that `relearner` lacks, every one of them rolled by then ([Rolling TMs](../explanation/save-export.md#rolling-tms)). All three are arrays of move IDs, each move once; `levels`, an object from a `relearner` move's ID to the lowest level its learnset teaches it at, for the moves the learnset holds (a first move it lacks has none). A snapshot exported before 2026-10-25, and every Python export, has no `levels`, and the summary says so over "Can learn" |
| `personalId` | integer or null | Snapshots only: its `@personalID`, which it keeps for life |
| `details` | object, or absent | Snapshots only: what else the save holds of it ([Details](#details)); absent in a snapshot exported before 2026-10-27 |

## `items[]`

| Key | Type | Holds |
|-----|------|-------|
| `item` | string | The item's game ID (`LEFTOVERS`, `TINYMUSHROOM`), listed once |
| `showdown` | string or null | Its Showdown ID when it is a key of Showdown's `data/items.ts` (a TM's `tm01` label too, and `tinymushroom`); null otherwise (`REPEL`, `POTION`, the key items) |
| `pocket` | integer or null | Its pocket in `items.dat`, 1 to 8 as in [`bag[]`](#bag); null for an old export's item the site's data does not know |
| `quantity` | integer | The bag's quantity, plus 1 for each Pokémon holding it, permafainted ones included, plus the PC item storage's |

Every pocket goes in, TMs and HMs too. The PC's bag and the team builder use only the fight items: those with a Showdown ID in pocket 1 (Objetos) or 5 (Bayas), the Mini Seta (`TINYMUSHROOM`) aside, which they count apart (`fightItems` and `setasOf` in `shared/items.ts`).

## `tms[]`

| Key | Type | Holds |
|-----|------|-------|
| `item` | string | The TM item's ID (`tm01` and so on), listed once; a label, not in Showdown's `data/items.ts`, which has no TM items |
| `move` | string | The ID of the move it teaches in this save |

## `fainted[]`

Every key of a [`pokemon[]`](#pokemon) entry, read the same way, with two differences:

| Key | Type | Holds |
|-----|------|-------|
| `species` | string or null | The species-form's Showdown ID; null when it has none, where `pokemon[]` leaves the Pokémon out |
| `gameSpecies` | string | The species-form's game ID (`REMORAID`, `ROTOM_1`) |

A snapshot exported before 2026-10-27 holds only `species`, `gameSpecies`, `nickname`, `level` and `personalId`; the rest reads as absent, as in an old export's `pokemon[]` ([Old Exports](#old-exports)).

## `bag[]`

| Key | Type | Holds |
|-----|------|-------|
| `pocket` | integer | 1 to 8: Objetos, Medicinas, Poké Balls, MTs & MOs, Bayas, Mega Piedras, Obj. Batalla, Obj. Clave ([State → Bag](../../games/anil/reference/state.md#bag)) |
| `items` | array of objects | The pocket's entries in order: `item`, the game ID (`LEFTOVERS`); `showdown`, its Showdown ID when the site's data has one, else null; `quantity` |

## `trainer`

| Key | Type | Holds |
|-----|------|-------|
| `name` | string or null | `$player@name` |
| `id` | integer or null | `$player@id`, the full 32-bit ID |
| `publicId` | integer or null | The ID shown in game, its low 16 bits |
| `money` | integer or null | `$player@money` |
| `badges` | array of booleans | `$player@badges`, one per badge |

## Details

What the save holds beyond a fight, kept so later features can use it ([Save Export → Everything Else It Keeps](../explanation/save-export.md#everything-else-it-keeps)). IDs here are the save's own (`ULTRABALL`, `BATONPASS`), with a Showdown ID beside an item or a move where the site's data has one. A value the save lacks is null.

### A Pokémon's `details`

| Key | Type | Holds |
|-----|------|-------|
| `gameSpecies` | string | The species-form's game ID |
| `form` | integer or null | `@forced_form`, else `@form` |
| `heldItem` | object or null | `item`, the game ID of `@item`, and `showdown`, its Showdown ID or null |
| `exp`, `happiness` | integer or null | `@exp`, `@happiness` |
| `ball` | string or null | `@poke_ball` |
| `mintedFrom` | string or null | The Showdown ID of `@nature` when a mint set `@nature_for_stats`, else null |
| `abilityIndex` | integer or null | `@ability_index` |
| `moveSlots` | array of objects | Its current moves in slot order: `move` (game ID), `showdown` (or null), `pp`, `ppUp` |
| `firstMoves` | array of strings | `@first_moves`, game IDs |
| `owner` | object or null | `@owner`: `name`, `id`, `gender` |
| `obtained` | object | `method`, `map`, `level`, `text` (`@obtain_*`), `at` (`@timeReceived`, Unix seconds), `hatchedMap`, `hatchedAt` (`@timeEggHatched`) |
| `pokerus` | integer or null | `@pokerus` |
| `markings`, `ribbons` | arrays | `@markings` (integers), `@ribbons` (IDs) |
| `contest` | object | `cool`, `beauty`, `cute`, `smart`, `tough`, `sheen` |
| `superShiny` | boolean | `@super_shiny` |
| `rest` | object, or absent | Every other field the save holds of it, keyed by its name without `@` and converted as [World](#world) says (`ability`, `forced_ability`, `steps_to_hatch`, `evo_step_count`, `ready_to_evolve`, …), so a field the mod adds later is kept too; absent before 2026-10-27 |

Its current HP and status, its Exp. Share flag and its `legacy_data` (time in the party, battles fought, foes defeated) are not here but in [`world.pokemon`](#world): each changes with where it sits, so they would tell the party apart.

### The snapshot's `details`

| Key | Type | Holds |
|-----|------|-------|
| `trainer` | object | `$player`'s `gender`, `trainerType` (`@trainer_type`), `coins`, `battlePoints`, `soot` |
| `boxes` | array of objects | Each PC box in order: `name`, `size` (its slots) |
| `position` | object | `map` (the current `Game_Map`'s `@map_id`), and `game_player`'s `x`, `y` and `direction` |
| `startedAt`, `savedAt` | string or null | `$PokemonGlobal@startTime` and `$player@last_time_saved`, ISO 8601 in UTC |
| `steps` | integer or null | `$PokemonGlobal@stepcount` |
| `saveCount` | integer or null | `game_system@save_count` |
| `gameVersion` | string or null | The save's `game_version` (`4.1.1`) |
| `pokedex` | object | `seen`, `owned`, `seenEggs` and `ownedShadow`: the species IDs the Pokédex marks; `seenForms` and `lastSeenForms`, `@seen_forms` and `@last_seen_forms` by species as [World](#world) converts them; `caughtCounts` and `defeatedCounts`, how many of each species were caught and defeated; `unlockedDexes` and `accessibleDexes`. All but `seen` and `owned` absent before 2026-10-27 |
| `gameStats` | object | Every number `GameStats` holds, keyed by its field without `@` (`distance_walked`, `money_spent_at_marts`, …) |
| `challenge` | object | `rules`, `$PokemonGlobal@challenge_rules`; `outcomes`, each challenge's outcome in `@challenge_state` (`VICTORY`) |
| `vial` | object or null | The Pokévial's `charges` and `max`; null before the game gives it |
| `hallOfFame` | array of arrays | Each Hall of Fame team, each member's `species` (Showdown ID or null), `gameSpecies`, `nickname`, `level` and `personalId` |
| `itemsFound` | array of strings | `item_log@found_items`, game IDs |

## World

The `snapshot` row's `world` column (`World` in `api/_lib/export/export.ts`) holds the rest of the save that one export reads, kept because a save is only exported once though its zip is stored: no page reads it, no route answers it, and it stays out of `data`, which the team builder sends whole to any player. A Ruby value is converted as is: a symbol to its name, a hash to an object keyed by its keys as text, an object to its fields without `@` plus `_class`, a `Time` to ISO 8601, a `GameData` object to its ID, a `Set` to its members, bytes to base64, a link back to an object still being converted to `"[cycle]"`; a Pokémon object inside these fields (a trainer's, the Day Care's, one in a variable) is cut to its species, form, nickname, level, gender, shininess, ability, nature, item, IVs, EVs, personal ID and move IDs. About 600 KB for a finished run.

| Key | Holds |
|-----|-------|
| `randomizer` | The run's randomized world: `abilities` (`randomized_data`'s table), `learnsets` (`@random_moves`), `encounters` (`@random_encounter_table`, by map and method: weight, species, levels), `trainers` (`@random_trainer_teams`, each trainer's team) and `tmMoves` (`@tm_move_map`) |
| `pokemon` | Each Pokémon of `pokemon` and `fainted`, in their random order: `personalId`, `gameSpecies`, and its `hp`, `status`, `statusCount`, `expshare`, `legacy_data` and `last_update_time` |
| `metadata` | Every other field of `$PokemonGlobal`: the randomizer's settings and rules, the Day Care, the PC item storage, eggs, followers, roamers, fossils, the phone, the visited maps and the trail, the Pokévial and the rest |
| `player` | Every field of `$player` but the party and the Pokédex: mystery gifts, online stats, defeated and reset combats and the rest |
| `bag` | The bag's fields but its pockets: registered, favourite and new items, the last pockets viewed |
| `storage` | `unlockedWallpapers` and each box's `backgrounds`; never which box is open |
| `switches`, `variables`, `selfSwitches` | The game's switches and variables, and each event's self switches |
| `mapMetadata`, `options` | `map_metadata`'s fields and the player's options (`pokemon_system`) |
| `frameCount`, `essentialsVersion` | The save's `frame_count` and `essentials_version` |

An old export's snapshot has no `world`.

## Old Exports

The upload also takes the `.json` a Python export wrote ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)), and reads it as far as it goes rather than refusing it for a gap (`readExport` in `pkmn/site/shared/snapshot.ts`). Its `pokemon` and `tms` are read with the same `pokemonSchema` and `tmSchema` as a save zip's snapshot, and its `items`, Showdown IDs with a quantity, are turned into `items[]` entries through the site's data, the game ID and pocket of the first game item with that Showdown ID (`itemFromShowdown`): in `pokemon[]` every key but `species` reads as absent when it is missing or not of its type (null, `shiny` false, `types` empty, `moves` left out), and an entry of any of the three lists that still fails, a Pokémon without a non-empty `species` among them, is skipped and counted. A list that is missing reads as empty. Only a file that is not JSON ("This file is not JSON"), not an object ("This file is not an export"), or with no entry read in any of the three lists ("Nothing in this export can be read") is refused.

The rest of the snapshot, which no export ever held, reads as absent: `details` and each Pokémon's `details` left out, `fainted`, `bag`, `usedEncounters` and `notices` empty, `trainer`'s values null and its `badges` empty, `playTime`, `pokedex`'s counts, every `records` count, `hallOfFame`, `saveSlot` and `randomlockeVersion` null. Its fainted count is 0 until an admin sets it by hand.

Beside `data`, the snapshot row keeps the export's missing-field report (`missing`, `exportReport` in `shared/snapshot.ts`; null for a save zip's snapshot): `missing`, the gaps found in the order below, and `skipped`, how many entries were skipped.

| Gap | Found when |
|-----|------------|
| `ivs`, `evs`, `stats` | A Pokémon lacks that key or holds a value not of its type; Python exports wrote them from 2026-10-21 |
| `moves` | A Pokémon lacks `moves`; a Python export wrote them only under its moves option |
| `tmRolls` | A Pokémon's `moves` carries `unchecked`, the list of bag TMs its species had no roll for, which every Python export with moves wrote until TM rolling replaced it on 2026-10-21: its `tms` hold only the pairs the game had rolled, and the site keeps no rolls for it |
| `level`, `nature`, `ability`, `abilities`, `types`, `gender`, `nickname`, `shiny` | A Pokémon lacks that key or holds a value not of its type |
| `items`, `tms` | The export has no such list |

The PC reads the report where each gap shows (below), and the upload's done step as a "Missing: IVs, EVs, stats · moves" chip beside a "1 skipped" one (`missingList`). Series 1's two old exports read as:

| Export | Pokémon | Gaps |
|--------|---------|------|
| Vicky's, 2026-10-16 | 55 | `ivs`, `evs`, `stats`, `moves` |
| MIRAMEEE's, 2026-10-17 | 48 | `ivs`, `evs`, `stats`, `tmRolls` |

The PC shows what an old export lacks the way it shows any absent value, "—" for IVs, EVs and stats, and warns where the gap shows rather than over the page: the Stats tab names the IVs, EVs or stats it lacks, and its Lv 50 view shows ranges over IVs 0 to 31; the Moves tab reads "No moves in this export" without `moves`, and over "Can learn" names the missing TM rolls; the bag names a missing `items` or `tms` list in that pocket (`GapWarning` in `src/components/pc/summary.tsx`).
