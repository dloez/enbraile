# How to Check the Mod

Prove each rule of the Randomlocke mod on the real game with `anil check`: it drives a running game through the bridge and prints `pass` or `FAIL` with its evidence for every expectation. What each check does is in [Randomlocke Design → How the Checks Run](../explanation/randomlocke-design.md#how-the-checks-run); what the checks saw is in [Runtime → Checks](../reference/runtime.md#checks).

## Prerequisites

- The game installed with the bridge, as in [How to Run the Harness](run-the-harness.md) step 1, and no `anil` game running.
- A fresh new game: a session started on an empty save and driven through the intro, or booted into a snapshot taken right after it in the bedroom. Wonder's data root holds one, `marked-bedroom` (`~/.local/share/wonder/snapshots/`); copy it into `~/.local/share/enbraile/anil/snapshots/` with `cp -an`. The `newgame` checks expect the untouched bedroom, and the `nuzlocke` checks change the game in order.

Every command below runs from `pkmn/games/anil/`.

## Steps

### 1. Start a fresh game

```sh
uv run anil run --snapshot <after-intro snapshot> --save <new save name> --hidden
```

A new save name keeps the run's saves apart from your others. Booted into a snapshot, `starter-region` and `new-game-save` note that the new game ran before it and check only the live state.

### 2. Run the checks

```sh
uv run anil check all
```

`all` runs `newgame`, `nuzlocke`, `caps`, `battle`, `shiny`, `stats`, `showdown`, `random` and `stage0`, in that order; any group or single check name runs alone (`uv run anil check --help` lists them). `replay` runs last and stops the live game to replay its session, leaving the replayed game running. The whole of `all` takes about 8 minutes (52 checks in 463 s on 2026-10-22).

### 3. Stop the game

```sh
uv run anil stop
```

## Verification

- The command ends with `N of N checks passed` and exits 0; a failure names the failed checks and exits 1.
- Each check's evidence is a `check` entry in the session's `record.jsonl`, under `~/.local/share/enbraile/anil/sessions/<session>/`.
