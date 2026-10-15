# How to Run and Share the Open Sheet Export

Write a save's [Open Sheet JSON](../reference/open-sheet-json.md) with `pkmn/tools/export_data.py`, and have a rival run it from the repository's raw URL without a checkout. Why it works this way is in [Open Sheet Export](../explanation/open-sheet-export.md).

## Prerequisites

- WSL, on the Windows machine where Pokémon Añil saves its games.
- [`uv`](https://docs.astral.sh/uv/) installed in WSL. It fetches the Python the script asks for (3.11 or newer).

## Steps

### 1. Let the game finish saving

Let the game finish saving. A save caught mid-write cannot be read, and the run says so and writes nothing; running it again once the game has saved fixes it.

### 2. Run the export

From the folder the JSON should land in, with `<repo>` the Enbraile checkout:

```sh
uv run <repo>/pkmn/tools/export_data.py
```

Without the repository, run the copy you were sent (`uv run export_data.py`) or the raw URL (step 3).

With one `Partida N` slot it reads that one; with several it lists them and asks which. To read another file, or to write elsewhere:

```sh
uv run <repo>/pkmn/tools/export_data.py --save "/mnt/c/Users/<you>/AppData/Roaming/Pokemon Anil/Partida 2.rxdata" --out sheet.json
```

It writes `<trainer name>-open-sheet.json`, overwriting a file of that name, prints a notice for each thing it left out or could not read, and ends with a line counting the Pokémon, items and TMs it wrote.

### 3. Give the rival the raw URL

The script on `main` of this public repository is served at:

```
https://raw.githubusercontent.com/dloez/enbraile/main/pkmn/tools/export_data.py
```

It serves whatever was last pushed to `main`, a few minutes after a push at most, so a change reaches rivals once it is pushed. The rival runs, in WSL:

```sh
uv run https://raw.githubusercontent.com/dloez/enbraile/main/pkmn/tools/export_data.py
```

and sends back the JSON it writes.

## Refreshing the Shipped Data

Only when the game build, Wonder's data or Showdown's item list changes, the owner regenerates the data embedded in the script, reading a Wonder checkout (default `~/workspace/wonder`) and downloading Showdown's `data/items.ts`, so it needs a network connection:

```sh
uv run pkmn/tools/generate_export_data.py [WONDER]
```

It rewrites the `DATA` dict in `export_data.py`, and nothing when the data is unchanged. Commit and push it to reach rivals (step 3).

## Verification

- The run ends with `Wrote N Pokémon, N items and N TMs to <path>`, and that file exists.
- Run from the raw URL and from the local script of the same pushed commit on the same save, the two files are identical (`cmp`).
- The save file's modification time is unchanged.
