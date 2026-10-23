# How to Run and Share the Open Sheet Export

Write a player's Open Sheet JSON ([Snapshot Format](../../../site/reference/snapshot.md), its first three keys) with `pkmn/games/anil/export_data.py` from the save folder they zip and send you, and hand the zip back with its TM rolls; or run it on your own save. Why it works this way is in [Open Sheet Export](../explanation/open-sheet-export.md).

## Prerequisites

- WSL, with [`uv`](https://docs.astral.sh/uv/) installed. It fetches the Python the script asks for (3.11 or newer).
- For a player's save: the player on the Windows machine where they play Pokémon Añil.

## Steps

### 1. Get the player's save folder

Send the player these steps:

1. Close the game.
2. Press Win+R, type `%APPDATA%`, and press Enter.
3. Right-click the `Pokemon Anil` folder, choose **Send to → Compressed (zipped) folder**, and send the `Pokemon Anil.zip` it makes.
4. Do not play until you have put back the zip you get in return: anything played in the meantime is lost.

Whatever else the folder holds, other saves, backups or photos, can stay in the zip; the script ignores it and returns it as it was.

### 2. Run the export on the zip

From the folder the files should land in, with `<repo>` the Enbraile checkout:

```sh
uv run <repo>/pkmn/games/anil/export_data.py --save "Pokemon Anil.zip"
```

With one `Partida N` save in the zip it reads that one; with several it lists them and asks which. `--moves` also writes the moves each Pokémon knows and can learn at the move relearner and from the bag's TMs; `--out sheet.json` writes the JSON elsewhere.

It rolls every bag TM the game has not checked against the Pokémon it exports, then writes `<trainer name>-open-sheet.json` and, beside it, `<trainer name>-save.zip`, overwriting files of those names. It prints a notice for each thing it left out or could not read, and ends with a line counting the Pokémon, items and TMs it wrote and the TM checks it rolled.

### 3. Return the zip

Send the player `<trainer name>-save.zip` and the JSON, with these steps:

1. Close the game.
2. Press Win+R, type `%APPDATA%`, and press Enter.
3. Open the zip, drag its `Pokemon Anil` folder into the `%APPDATA%` window, and choose **Replace the files in the destination**.
4. Open the game and load the save; the next in-game save keeps the rolls.

### Your own save

With the game closed, run the script with no `--save`:

```sh
uv run <repo>/pkmn/games/anil/export_data.py
```

It finds the `Pokemon Anil` folder in WSL by itself, lists the `Partida N` slots when there are several, and writes the rolls into the slot's side file in place, copying the old one to `tm_compatibility_<slot>.dat.bak` first. `--save "/mnt/c/Users/<you>/AppData/Roaming/Pokemon Anil/Partida 2.rxdata"` reads another file the same way.

A technical player can run it on their own save the same way, without a checkout, from the script on `main` of this public repository, which serves whatever was last pushed, a few minutes after a push at most:

```sh
uv run https://raw.githubusercontent.com/dloez/enbraile/main/pkmn/games/anil/export_data.py
```

## Refreshing the Shipped Data

Only when the game build, the mod's data (`pkmn/games/anil/src/anil/mod/`) or Showdown's item list changes, the owner regenerates the data embedded in the script. It reads the mod and the game files in `pkmn/games/anil/game/`, which [How to Install the Game](install-the-game.md) fetches, and downloads Showdown's `data/items.ts`, so it needs a network connection:

```sh
uv run pkmn/games/anil/generate_export_data.py
```

It rewrites the `DATA` dict in `export_data.py` and the site's copy of the same data, `pkmn/site/api/_lib/export/data.json`, each only when it changed. Commit and push both: the script reaches players through the raw URL, the JSON through the site's next deploy.

## Verification

- The run ends with `Wrote N Pokémon, N items and N TMs to <path>; rolled N TM checks into <path>`, and both files exist.
- Run again on the returned zip, it ends with `no TMs to roll`.
- The returned zip holds the same entries as the player's, and only the slot's `tm_compatibility_Partida_N.dat` differs: `unzip -p "Pokemon Anil.zip" "Pokemon Anil/Partida 1.rxdata" | cmp - <(unzip -p <trainer>-save.zip "Pokemon Anil/Partida 1.rxdata")` prints nothing.
- On your own save, the save file's modification time is unchanged and `tm_compatibility_<slot>.dat.bak` holds the side file as it was.
