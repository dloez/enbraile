# Añil Tooling: Discovery

The decisions behind bringing the tooling that installs, runs and checks Pokémon Añil with the group's Randomlocke mod from Wonder (`~/workspace/wonder`) into `pkmn/games/anil/`, and the group's series rulebook into `docs/pkmn/series/1/`. It is the first step towards a site that shows every series the group plays; the site's series hub is the next idea and is not part of this one. Scoped with the owner on 2026-10-21.

## Goal and Success

**Q: What is being built?**
A: One uv project in `pkmn/games/anil/` with an `anil` command that installs the game with the mod, launches it with the bridge, drives it through the harness verbs, and checks the mod's rules against the live game. Wonder's tooling took the owner's Añil mod from idea to tested build; this keeps that tooling without the agent.
**Why:** the owner: "we just need the different tools that allow you to play the game which has been tremendous for developing the mod for añil and also test it." _(2026-10-21)_

**Q: When is it done?**
A: From a clean clone: `anil install` builds a Windows working copy whose new game starts the Randomlocke; `anil install --harness` plus `anil run` launches it with the bridge, and `anil state`, `anil go`, `anil battle …`, `anil rules …` work against it; `anil check all` passes as it does in Wonder; the Open Sheet export is regenerated from in-repo files; the game facts, harness design and series 1 rulebook live under `docs/pkmn/`.

## Scope Edges

**Q: What stays out?**
A: Wonder's agent and everything only it needs: `packages/agent`, `packages/arena`, Jev, the planner, PvP, `harness/tools/`, `harness/goals/`, `harness/memory.py`, `harness/home.py`, the control panel (`harness/panel.py`, `panel.html`), `bridge/ruby/wonder_run.rb`, the real run with its Fair Play takeover, Wonder fights, rounds and frozen pastes, the `know`, `agent`, `runs` and `rules fight|round|pastes` commands, `run --real`, the second game instance, and the agent settings (`WONDER_AGENT_*`, team weights, weak HP fraction).
**Why:** the owner: "nothing for wonder (where wonder is the actually agent that runs it) should be kept"; the panel only made sense for watching the agent. _(2026-10-21)_

**Q: Is anything removed from Wonder?**
A: No. Everything is copied; Wonder's repository is left untouched.
**Why:** the owner. _(2026-10-21)_

**Q: The players' zip and how players install the game?**
A: Out for now: no `anil package`, no hosting of the game or a zip.
**Why:** the owner. _(2026-10-21)_

**Q: The site?**
A: Out. A series hub (home lists series, each series has a hub, Open Sheet and Team Analysis under it) is agreed in direction, but what it shows is the next idea.
**Why:** the owner: "nothing now, we will build this next". _(2026-10-21)_

## Games and Series

**Q: Are a game and a series the same thing?**
A: No. A game is the build the group plays and its tooling (`pkmn/games/<game>/`, `docs/pkmn/games/<game>/`); a series is one playthrough of a game by the group under its rules. A game may be replayed in a later series.
**Why:** the owner: "we may replay games". _(2026-10-21)_

**Q: How is a series identified?**
A: By number: series 1 is Añil. Its docs live in `docs/pkmn/series/<n>/`, and the site will serve it at `/series/<n>`.
**Why:** a number stays unique when a game is replayed. _(owner, 2026-10-21)_

**Q: Where do the rules live?**
A: One rulebook per series, in `docs/pkmn/series/<n>/`, holding every rule of that series, whether it concerns the game (Nuzlocke, randomizer, Gen 1–5 limits, level caps, locked options) or the PvP part (league, eggs, final tournament). There is no separate rulebook for the game.
**Why:** the owner: "there are nothing as game rules … we do not have to split in series and game". _(2026-10-21)_

**Q: Does series 1's rulebook keep Wonder fights?**
A: No. It comes over without Wonder fights; an egg opens on a league win only.
**Why:** the owner. _(2026-10-21)_

**Q: What happens to Wonder's facts about Añil itself (mechanics, world, menus, state, randomizer)?**
A: They are the game's, in `docs/pkmn/games/anil/reference/`, with the harness design in `docs/pkmn/games/anil/explanation/`. This closes the open question "Shared Pokémon material before Wonder moves".

## Surfaces

**Q: What does `pkmn/games/anil/` hold?**
A: One uv project, Python 3.12, with the `anil` command:

| Path | From Wonder | Holds |
|------|-------------|-------|
| `src/anil/install/` | `harness/builds.py`, `game_files.py`, `deploy.py`, `windows.py` | Fetch (the hash-checked zip from Windows Downloads), extract, deploy with the mod and, with `--harness`, the bridge |
| `src/anil/mod/` | `packages/randomlocke` | The Randomlocke's Ruby, data, allow-list builders and `LEEME-Randomlocke.txt` |
| `src/anil/bridge/` | `packages/bridge` | The Ruby bridge with its client and protocol, without `wonder_run.rb` |
| `src/anil/harness/` | `packages/harness` | launch, lock, investigate, context, state, changes, steps, snapshot, replay, dialog, menu, storage, battle, navigate, world, gamedb, random, calc (with the `knowledge` module it reads; `team` stays in Wonder, [Damage Calc Design → Coming to Añil's Tooling](../pkmn/games/anil/explanation/damage-calc-design.md#coming-to-añils-tooling)), showdown, progression, rules, check |
| `src/anil/cli.py` | `packages/cli` | The tooling commands of the CLI table in the migration map: install, run, stop, replay, eval, stack, shot, rng, showdown, control, speed, state, snapshot, go, interact, dialog, menu, battle, db, world, rules check/audit/freeze, check, nav check |
| `export_data.py`, `generate_export_data.py` | — (already here) | The Open Sheet export, at the same path, since players run it from its raw GitHub URL |
| `game/` | `game/` | The game files, gitignored, beside `src/`: the original zip (`archives/`), the untouched unpacked game (`base/`) and its scripts extracted for reading (`extracted/`) |

**Q: Is `game/` a `dist/`?**
A: No. It holds the game as downloaded, inputs to install, not its output. The installed, modded game is deploy's output and lives outside the repository, in the Windows working copy (`ANIL_GAME_DIR`), since the game must run from the Windows filesystem.
**Why:** raised by the owner; follows from Wonder's runtime constraints. _(2026-10-21)_

One project rather than Wonder's workspace members: nothing outside Añil reuses the parts. _(owner, 2026-10-21)_

**Q: Is `anil check` a test suite, which the root `CLAUDE.md` forbids?**
A: It comes over as a tool: it drives the real game and prints pass/FAIL with evidence, which is checking a change by running it. It holds its own copy of the expected configuration, as in Wonder.
**Why:** the owner. _(2026-10-21)_

## Data, Secrets and Config

**Q: Names and defaults?**
A: `WONDER_*` becomes `ANIL_*` (`ANIL_DATA`, `ANIL_GAME_DIR`, `ANIL_BRIDGE_PORT`); `WonderBridge` becomes `AnilBridge`, `wonder_*.rb` becomes `anil_*.rb`, `wonder_stamp.json`, `wonder_launch.json` and `wonder_version.rb` take the `anil_` prefix, and the PowerShell type `[Wonder.Win]` becomes `[Anil.Win]`. The data root defaults to `~/.local/share/enbraile/anil`, the working copy to `%USERPROFILE%\Documents\Pokemon\Pokemon Anil-enbraile`, the bridge port to 24731, so Wonder's own games can run alongside. In-game messages naming Wonder are reworded. The repo-root paths (`GAME_ROOT`) resolve to `pkmn/games/anil/game/`.
**Why:** proposed and confirmed by the owner. _(2026-10-21)_

**Q: What happens to the rules engine's egg guard?**
A: It goes: Wonder's guard counts eggs from Wonder fight rounds in run records, and neither comes over. Every other rule of the guard and audit stays, with the bridge's rules hooks (`wonder_rules.rb`).
**Why:** follows from dropping Wonder fights and the run records; no other source of league wins exists in the tooling. _(settled 2026-10-21)_

**Q: Secrets?**
A: None. The game, its saves and the data root never enter the repository.

## Reuse

**Q: What is the single source of truth for the export's data?**
A: `generate_export_data.py` reads `src/anil/mod/data/`, the mod's version and the installed `game/base/es-v4.14/` instead of a Wonder checkout.

## Idempotency and Rollback

`anil install` is safe to re-run as in Wonder: fetch reuses a base or archive whose hashes match, and deploy refuses a non-empty folder without its stamp and writes only what changed. A bad change is reverted in git; Wonder is untouched, so its own tooling stays usable meanwhile.

## Portability and Environment

As in Wonder: WSL2 with interop and mirrored networking, the game alone on Windows, launched from WSL, the working copy on the Windows filesystem, a Windows desktop session.

## Observability

As in Wonder: the bridge's logs, the stamp file and each command's printed result. Nothing new.

## Verification

The gate for `pkmn/games/anil/`, in its `CLAUDE.md`: `uv run ruff check .`, `uv run ruff format --check .`, `uv run ty check`, from `pkmn/games/anil/`. _(owner, 2026-10-21)_ Beyond it, each change is checked by running it against the game; only a human sees the game window.

## References

- Wonder: `CLAUDE.md`, `docs/general/reference/architecture.md`, `docs/subsystems/harness/explanation/runtime-design.md`, `randomlocke-design.md`, `rules-engine-design.md`, `docs/domains/game/`, `docs/domains/competition/`, `pyproject.toml`, `packages/*/pyproject.toml`, `packages/harness/src/harness/{builds,game_files,deploy,windows,check,rules,runs,panel,settings}.py`, `packages/cli/src/cli/main.py`
- Enbraile: [Repository Layout](../general/explanation/repository-layout.md), [Open Questions](open-questions.md), `pkmn/games/anil/generate_export_data.py`, [How to Run and Share the Open Sheet Export](../pkmn/games/anil/how-to/run-the-open-sheet-export.md)
