# Snapshot Format

What a snapshot holds: the JSON object the site's export (`pkmn/site/api/_lib/export/`) makes from one `Partida N.rxdata` slot of a save zip, or that the site reads from an old export's JSON ([Old Exports](#old-exports)), stored as the `snapshot` row's `data` ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)), and its zod schema, `snapshotSchema` in `pkmn/site/shared/snapshot.ts`. Its first three keys, `pokemon`, `items` and `tms`, are the Open Sheet JSON the retired Python export wrote, and the site's export writes them the same way; the rest is what the Python export left out. Why each of the three keys' fields is there, and what is left out, is in [Save Export](../explanation/save-export.md). Where each value sits in the save is in [State](../../games/anil/reference/state.md). Every ID in `pokemon`, `items` and `tms` is a Showdown ID: the English Showdown name lowercased, with everything but letters and digits removed.

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
      "moves": {"current": ["surf", "icebeam"], "relearner": ["powdersnow", "surf"], "tms": ["icebeam"]},
      "personalId": 2078334086
    }
  ],
  "items": [{"item": "leftovers", "quantity": 2}],
  "tms": [{"item": "tm13", "move": "icebeam"}],
  "fainted": [{"species": "remoraid", "gameSpecies": "REMORAID", "nickname": "TRAMPANTOJO", "level": 14, "personalId": 2026315114}],
  "party": [{"species": "walrein", "gameSpecies": "WALREIN", "nickname": null, "level": 42, "personalId": 2078334086, "fainted": false}],
  "bag": [{"pocket": 1, "items": [{"item": "LEFTOVERS", "showdown": "leftovers", "quantity": 1}]}],
  "trainer": {"name": "MIRAMEEE", "id": 2550780501, "publicId": 53845, "money": 1168806, "badges": [true, true, false, false, false, false, false, false]},
  "playTime": 134379.17,
  "pokedex": {"seen": 463, "owned": 132},
  "records": {"trainerBattlesWon": 229, "trainerBattlesLost": 2, "wildBattlesWon": 122, "wildBattlesLost": 287, "blackouts": 1},
  "hallOfFame": 0,
  "usedEncounters": [2, 3, 4],
  "saveSlot": "Partida 1",
  "randomlockeVersion": 1,
  "notices": ["SURSKIT (level 43) has not evolved into MASQUERAIN (level 25)."]
}
```

The values above are illustrative; `bag` always holds all eight pockets.

## Top Level

| Key | Type | Holds |
|-----|------|-------|
| `pokemon` | array of objects | Each living Pokémon of the party, then of each PC box in order |
| `items` | array of objects | The shared items, bag first in pocket order, then held items not yet listed |
| `tms` | array of objects | The TMs, in the order first found |
| `fainted` | array of objects | Each permafainted Pokémon (`@perma_faint`) of the party, then of each PC box in order |
| `party` | array of objects | The party in slot order, eggs left out |
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
| `moves` | object | Always in a save zip's snapshot; a Python export holds it only when run with its moves option: `current`, the moves it knows now, in slot order; `relearner`, its first moves then its rolled learnset up to its level; `tms`, the moves of the bag's TMs it is compatible with that `relearner` lacks, every one of them rolled by then ([Rolling TMs](../explanation/save-export.md#rolling-tms)). All three are arrays of move IDs, each move once |
| `personalId` | integer or null | Snapshots only: its `@personalID`, which it keeps for life |

## `items[]`

| Key | Type | Holds |
|-----|------|-------|
| `item` | string | The item's ID, listed once; a key of Showdown's `data/items.ts`, except `tinymushroom`, which Showdown does not model |
| `quantity` | integer | The bag's quantity plus 1 for each Pokémon holding it, permafainted ones included |

Holds the items of pocket 1 (Objetos) and pocket 5 (Bayas), and the held items that belong to those pockets.

## `tms[]`

| Key | Type | Holds |
|-----|------|-------|
| `item` | string | The TM item's ID (`tm01` and so on), listed once; a label, not in Showdown's `data/items.ts`, which has no TM items |
| `move` | string | The ID of the move it teaches in this save |

## `fainted[]` and `party[]`

| Key | Type | Holds |
|-----|------|-------|
| `species` | string or null | The species-form's Showdown ID; null when it has none |
| `gameSpecies` | string | The species-form's game ID (`REMORAID`, `ROTOM_1`) |
| `nickname` | string or null | The nickname; null when it has none |
| `level` | integer or null | Its level |
| `personalId` | integer or null | Its `@personalID` |
| `fainted` | boolean | `party[]` only: whether it is permafainted |

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

## Old Exports

The upload also takes the `.json` a Python export wrote ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)), and reads it as far as it goes rather than refusing it for a gap (`readExport` in `pkmn/site/shared/snapshot.ts`). Its `pokemon`, `items` and `tms` are read with the same `pokemonSchema`, `itemSchema` and `tmSchema` as a save zip's snapshot: in `pokemon[]` every key but `species` reads as absent when it is missing or not of its type (null, `shiny` false, `types` empty, `moves` left out), and an entry of any of the three lists that still fails, a Pokémon without a non-empty `species` among them, is skipped and counted. A list that is missing reads as empty. Only a file that is not JSON ("This file is not JSON"), not an object ("This file is not an export"), or with no entry read in any of the three lists ("Nothing in this export can be read") is refused.

The rest of the snapshot, which no export ever held, reads as absent: `fainted`, `party`, `bag`, `usedEncounters` and `notices` empty, `trainer`'s values null and its `badges` empty, `playTime`, `pokedex`'s counts, every `records` count, `hallOfFame`, `saveSlot` and `randomlockeVersion` null. Its fainted count is 0 until an admin sets it by hand.

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

The PC shows what an old export lacks the way it shows any absent value, "—" for IVs, EVs and stats, and warns where the gap shows rather than over the page: the Stats tab names the IVs, EVs or stats it lacks and opens on its Lv 50 view with ranges over IVs 0 to 31; the Moves tab reads "No moves in this export" without `moves`, and over "Can learn" names the missing TM rolls; the bag names a missing `items` or `tms` list in that pocket (`GapWarning` in `src/components/pc/summary.tsx`).
