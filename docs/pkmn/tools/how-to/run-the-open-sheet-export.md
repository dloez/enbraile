# How to Run and Share the Open Sheet Export

Write a save's [Open Sheet JSON](../reference/open-sheet-json.md) with `pkmn/tools/export_data.py`, and post the script as a GitHub Gist so a rival can run it without the repository. Why it works this way is in [Open Sheet Export](../explanation/open-sheet-export.md).

## Prerequisites

- WSL, on the Windows machine where Pokémon Añil saves its games.
- [`uv`](https://docs.astral.sh/uv/) installed in WSL. It fetches the Python the script asks for (3.11 or newer).
- To post the Gist: the [GitHub CLI](https://cli.github.com/) (`gh`), logged in with `gh auth login`.

## Steps

### 1. Let the game finish saving

Let the game finish saving. A save caught mid-write cannot be read, and the run says so and writes nothing; running it again once the game has saved fixes it.

### 2. Run the export

From the folder the JSON should land in, with `<repo>` the Enbraile checkout:

```sh
uv run <repo>/pkmn/tools/export_data.py
```

Without the repository, run the copy you were sent (`uv run export_data.py`) or the Gist's raw URL (step 4).

With one `Partida N` slot it reads that one; with several it lists them and asks which. To read another file, or to write elsewhere:

```sh
uv run <repo>/pkmn/tools/export_data.py --save "/mnt/c/Users/<you>/AppData/Roaming/Pokemon Anil/Partida 2.rxdata" --out sheet.json
```

It writes `<trainer name>-open-sheet.json`, overwriting a file of that name, prints a notice for each thing it left out or could not read, and ends with a line counting the Pokémon, items and TMs it wrote.

### 3. Post the script as a Gist

The owner does this once:

```sh
gh gist create pkmn/tools/export_data.py -d "Pokémon Añil open-sheet export"
```

Gists are secret by default: unlisted, but readable by anyone holding the link, which is all a rival needs. The command prints the Gist's URL; its id is the last part. After changing the script, replace the Gist's copy:

```sh
gh gist edit <gist id> --filename export_data.py pkmn/tools/export_data.py
```

### 4. Give the rival the raw URL

The raw URL without a revision in it serves the latest copy, a few minutes after an edit at most:

```
https://gist.githubusercontent.com/<owner>/<gist id>/raw/export_data.py
```

The **Raw** button on the Gist's page adds a revision hash between `raw/` and the filename, which pins that version; drop it. The rival runs, in WSL:

```sh
uv run https://gist.githubusercontent.com/<owner>/<gist id>/raw/export_data.py
```

and sends back the JSON it writes.

## Refreshing the Shipped Data

Only when the game build or Wonder's data changes, the owner regenerates the data embedded in the script, reading a Wonder checkout (default `~/workspace/wonder`):

```sh
uv run pkmn/tools/generate_export_data.py [WONDER]
```

It rewrites the `DATA` dict in `export_data.py`, and nothing when the data is unchanged. Update the Gist afterwards (step 3).

## Verification

- The run ends with `Wrote N Pokémon, N items and N TMs to <path>`, and that file exists.
- Run from the Gist's raw URL and from the local script on the same save, the two files are identical (`cmp`).
- The save file's modification time is unchanged.
