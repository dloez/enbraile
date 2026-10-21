# How to Install the Game

Install Pokémon Añil v4.14 with the group's Randomlocke mod into a Windows working copy, so a new game started there is the Randomlocke. How install works is in [Runtime Design](../explanation/runtime-design.md); what the mod does is in [Randomlocke Design](../explanation/randomlocke-design.md).

## Prerequisites

- WSL2 with Windows interop, and [`uv`](https://docs.astral.sh/uv/) installed.
- The game's archive at `%USERPROFILE%\Downloads\POKEMON ANIL v4.14.zip`, or already in `pkmn/games/anil/game/archives/es-v4.14.zip`. Install checks its SHA-256 against the build table and refuses any other file.
- About 1.5 GB free in WSL for `game/` and about 830 MB on the Windows drive for the working copy.

## Steps

### 1. Choose the working copy (optional)

The working copy defaults to `%USERPROFILE%\Documents\Pokemon\Pokemon Anil-enbraile`. To put it elsewhere, set a Windows path:

```sh
export ANIL_GAME_DIR='C:\Users\<you>\Documents\Pokemon\Somewhere Else'
```

Install refuses a folder that exists, is not empty and has no `anil_stamp.json`, so it never overwrites another copy of the game.

### 2. Install

From `pkmn/games/anil/`:

```sh
uv sync
uv run anil install
```

The first run copies the archive into `game/archives/`, unpacks it into `game/base/es-v4.14/`, extracts its scripts into `game/extracted/es-v4.14/`, copies the base to the working copy and writes the mod over it. Later runs write only what changed. Options:

- `--full` copies the base to the working copy again, for a broken working copy.
- `--no-cache` ignores `game/` and copies the archive from Downloads afresh.
- `--build` picks another build from the build table; `es-v4.14` is the only one.

### 3. Start a new game

Open `Game.exe` in the working copy and start a **new** game. Saves go to Añil's own folder, `%APPDATA%\Pokemon Anil`, beside any other Añil install's saves; the new game saves itself once into a new slot and never over an existing one.

## Verification

- A second `uv run anil install` copies no base and prints `overlay: 0 written, 6 unchanged`.
- The window title reads "Pokémon Añil Randomlocke v1".
- A new game asks no mode questions, and after the rival's name the player wakes in the bedroom with the RULEBOOK ("Libro de Reglas") in the bag.
- Box 50 of the PC, "Huevos", holds 16 eggs.
