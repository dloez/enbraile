# Runtime Design

How the `anil` tooling in `pkmn/games/anil/` gets Pokémon Añil and installs it with the group's Randomlocke mod: the game files, the build table, deploy and its layers, and the stamp. It is copied from Wonder's runtime (Wonder: `docs/subsystems/harness/explanation/runtime-design.md`), where it was built and checked against the game, without Wonder's agent. The mod itself is in [Randomlocke Design](randomlocke-design.md); how to run the install is in [How to Install the Game](../how-to/install-the-game.md).

The code is `src/anil/install/` (`builds.py`, `game_files.py`, `deploy.py`, `windows.py`), the mod in `src/anil/mod/`, and the `anil` command in `src/anil/cli.py`. Script references are to Añil's `game/extracted/es-v4.14/`: `S/` for a `Scripts.rxdata` section and `P/` for a plugin.

## What Install Does

From WSL, `uv run anil install` fetches and verifies the game into `pkmn/games/anil/game/`, then deploys it with the mod to a Windows working copy, so a new game started there is the Randomlocke. Nothing is launched: the game is started by hand from the working copy's `Game.exe`.

## Environment

WSL2 with Windows interop: `cmd.exe` resolves `%USERPROFILE%`, and `wslpath` converts between Windows and WSL paths. The working copy sits on the Windows filesystem, because `Game.exe` runs there and reading about 830 MB of assets across the WSL boundary is slow and untested. Only the game runs on Windows; nothing is installed there.

## Re-running and Rollback

Fetch reuses a base or archive whose hashes match. Deploy copies the base only when the build changes, the last copy did not finish, or `--full` is passed, and writes only the overlay files whose content changed, so a second `anil install` copies nothing. Deleting the working copy and installing again resets the game side; players' saves live in Añil's own save folder, `%APPDATA%\Pokemon Anil`, which install never touches. Code is reverted through git.

## Observability

Each step prints what it did: which source fetch used, what was copied or extracted, each overlay file written, and the stamp. `anil_stamp.json` in the working copy records what is deployed ([Deploy](#deploy)).

## Decisions

### Project Layout

- **One uv project, `anil`,** in `pkmn/games/anil/`, Python 3.12, with its code in `src/anil/` (`install/`, `mod/`, `cli.py`, `settings.py`) and the `anil` command a click group (`anil.cli:anil`). ruff and ty are its dev group, with Wonder's ruff configuration (line length 100, Python 3.12). Why: nothing outside Añil reuses the parts, so Wonder's workspace members became one project. _(owner, 2026-10-21)_
- **The Open Sheet export scripts stay outside the project and its gate:** `export_data.py` and `generate_export_data.py` keep their paths and their own inline script metadata, and the gate's ruff and ty leave them out. Why: players run `export_data.py` from its raw GitHub URL, and neither script was written to the project's gate. _(2026-10-21, build choice)_
- **Names follow the discovery's renames:** `WONDER_*` settings become `ANIL_*`, the stamp is `anil_stamp.json`, the PowerShell type is `[Anil.Win]`, and the mod's log calls name `AnilBridge`. _(owner, 2026-10-21)_
- **Wonder Guard, Wonder Skin and Wonder Room keep their names** in the mod's data (`abilities.txt`, `moves.txt`, `showdown.txt`), so `grep -rn -i wonder pkmn/games/anil/src` prints those six lines and nothing else. Why: they are the game's and Showdown's names for two abilities and a move, which the allow-lists and the Showdown export must match; renaming them would break both. _(2026-10-21, forced by evidence)_

### Game Files

- **The game lives in a gitignored `game/` folder beside `src/`:** `game/archives/<build>.zip` (the archive, kept), `game/base/<build>/` (the pristine unpack) and `game/extracted/<build>/` (the game's scripts, read-only, for investigation: `scripts/` for `Scripts.rxdata` and `plugins/` for `PluginScripts.rxdata`). `game/` is found from the code's own location, not the working directory. It holds the game as downloaded, the input to install, not its output. _(owner, 2026-10-21; from Wonder, settled 2026-09-30)_
- **Fetch takes the first source that holds:** `game/base/<build>/` whose `Scripts.rxdata` and `PluginScripts.rxdata` match their pinned hashes; else `game/archives/<build>.zip` whose SHA-256 matches, unpacked; else a copy of the build's archive from the owner's Windows downloads into `game/archives/`, verified and unpacked. An archive that fails its hash is rejected and deleted. Extraction runs whenever `base/` is created, and also when `base/` is valid but either half of `extracted/` is missing. `--no-cache` skips the local copies. A zip placed in `game/archives/` by hand is picked up the same way. _(from Wonder, settled 2026-09-30, rewritten for Añil 2026-10-02)_
- **Nothing is half-written:** the archive is copied into `<build>.zip.part`, hashed and renamed only once verified. Unpacking strips the archive's single top-level folder into a staging folder beside `base/<build>/`, checks both script hashes there and only then replaces `base/<build>/`. Extraction writes into a staging folder swapped in when complete: `scripts/NNN_Name.rb` per section, and `plugins/<plugin>/<file>` per plugin file with the plugin's own subfolders kept, each half with an `_index.txt` (position, code length, name) and every file read-only. Plugin and file names keep their own spelling, with only characters a path can't hold replaced by `_`. Why: a half-written archive, base or extraction must never be taken for a good one. _(from Wonder, settled 2026-09-30)_

### Builds

- **Spanish Añil v4.14, keyed by build:** the build table `anil.install.builds.BUILDS` holds, per build, the name (`es-v4.14`), the archive's path under `%USERPROFILE%` (`Downloads\POKEMON ANIL v4.14.zip`, resolved through interop, since Añil has no download link to fetch from), the archive SHA-256, the pristine `Scripts.rxdata` and `PluginScripts.rxdata` SHA-256s and the language. `--build` (default `es-v4.14`) picks one. Why: facts verified on one build don't carry to another. _(from Wonder, settled 2026-10-02)_

### Configuration

- **Config through pydantic-settings, no secrets:** `ANIL_GAME_DIR`, the Windows working copy, default `%USERPROFILE%\Documents\Pokemon\Pokemon Anil-enbraile`, resolved through interop, so it sits beside Wonder's own working copies and the owner's playable copy without touching them. _(owner, 2026-10-21)_

### Deploy

- **Deploy builds the working copy from `game/base/<build>/` and the overlay, with no staging copy:** copy the base into the working copy only when its stamp is missing, names another build or records an unfinished copy, or with `--full`; write the overlay; then write the stamp. Why: the 830 MB base crosses to Windows once per build while a mod change deploys in under a second, and a broken working copy can be deleted or redeployed with `--full`. _(from Wonder, settled 2026-09-30)_
- **Only changed overlay files are written:** each overlay file is compared with the one in the working copy and written only when its bytes differ, and the command says how many were written. Why: the acceptance for install is that a second run copies nothing; Wonder rewrote the whole overlay on every deploy. _(2026-10-21, build choice)_
- **The overlay is layered:** each layer brings its files and its preload list, written over the base in order; a layer that would rewrite a file of an earlier layer, or `mkxp.json`, is refused; base files are overwritten freely. The one layer today is `randomlocke`, the mod ([Randomlocke Design](randomlocke-design.md)): its generated `randomlocke_version.rb`, `randomlocke_allowlists.rb` and `randomlocke_showdown_names.rb`, then `randomlocke.rb` and `showdown.rb`. Wonder's bridge layer, on top of the mod, is not migrated yet. _(from Wonder, settled 2026-10-02; the bridge layer left for later, owner, 2026-10-21)_
- **`mkxp.json`** is the shipped one parsed after its `//` comment lines and trailing commas are dropped, and written back as plain JSON with every shipped key kept and the layers' preload files appended to any `preloadScript` list it has (Añil's has none). The shipped `preload.rb` is never listed, because it raises when preloaded (Wonder: `docs/domains/game/reference/runtime.md` → Player and Engine). _(from Wonder, settled 2026-10-02)_
- **Frame sync stays as shipped without the bridge:** a mod-only working copy keeps the shipped `vsync` and `syncToRefreshrate`, as Wonder's players zip did; Wonder's deploy turned both off because its bridge's speed and lockstep need the game's own frame rate to pace rendering, and that comes back with the bridge layer. _(2026-10-21, follows from deploying the mod layer only)_
- **Stamp:** `anil_stamp.json` in the working copy holds the build, whether the base copy finished, the commit (`+dirty` when `pkmn/games/anil/` has uncommitted changes), the deploy time and a SHA-256 per overlay file. It is written as unfinished before a base copy starts, so an interrupted copy is redone on the next install. The dirty check covers `pkmn/games/anil/` only, since changes elsewhere in the repository never reach the working copy. _(from Wonder, settled 2026-09-30; the dirty check's scope 2026-10-21, build choice)_
- **Base copy:** a base copy removes the working copy and copies the base afresh. A folder that exists, is not empty and has no stamp is refused and left alone, so a mistaken `ANIL_GAME_DIR` can never wipe someone's copy of the game. _(from Wonder, settled 2026-09-30)_
- **No running-game check yet:** Wonder refused to deploy while its harness ran a game, through the game lock. That lock comes with `anil run`; until then install has no game of its own to refuse on. _(2026-10-21, follows from deploying without a launcher)_

### Game Modifications

- **Only preloaded Ruby, never an edited `Scripts.rxdata`:** every change is a Ruby file in `src/anil/mod/`, loaded by `mkxp.json`'s `preloadScript` before `Scripts.rxdata`, patching methods at runtime. If a change ever can't be made at runtime, a patch file applied to the extracted scripts at deploy is added then, not before. Why: every change lives in the repo, and preload patches compose with the game without editing it. _(from Wonder, settled 2026-09-30)_

## Open

- None yet.
