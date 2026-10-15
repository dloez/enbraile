# Open Sheet JSON

What `pkmn/tools/export_data.py` writes: one UTF-8 JSON object, indented by two spaces. Why each field is there, and what is left out, is in [Open Sheet Export](../explanation/open-sheet-export.md). Every ID is a Showdown ID: the English Showdown name lowercased, with everything but letters and digits removed.

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
      "types": ["ice", "water"]
    }
  ],
  "items": [{"item": "leftovers", "quantity": 2}],
  "tms": [{"item": "tm13", "move": "icebeam"}]
}
```

The values above are illustrative.

## Top Level

| Key | Type | Holds |
|-----|------|-------|
| `pokemon` | array of objects | Each living Pokémon of the party, then of each PC box in order |
| `items` | array of objects | The shared items, bag first in pocket order, then held items not yet listed |
| `tms` | array of objects | The TMs, in the order first found |

There is no header: no trainer, badges, format version or export time.

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

## `items[]`

| Key | Type | Holds |
|-----|------|-------|
| `item` | string | The item's ID, listed once; always a key of Showdown's `data/items.ts` |
| `quantity` | integer | The bag's quantity plus 1 for each Pokémon holding it |

Holds the items of pocket 1 (Objetos) and pocket 5 (Bayas), and the held items that belong to those pockets.

## `tms[]`

| Key | Type | Holds |
|-----|------|-------|
| `item` | string | The TM item's ID (`tm01` and so on), listed once; a label, not in Showdown's `data/items.ts`, which has no TM items |
| `move` | string | The ID of the move it teaches in this save |

## Command Line

| Option | Effect |
|--------|--------|
| *(none)* | Finds the `Partida N.rxdata` slots in the Windows save folder; takes the only one, or asks which |
| `--save PATH` | Reads that save file instead |
| `--out PATH` | Writes there instead of `<trainer name>-open-sheet.json` in the current folder |

An existing file at the output path is overwritten. Notices and the closing count go to the terminal, never into the JSON; the [explanation](../explanation/open-sheet-export.md#notices) lists them.
