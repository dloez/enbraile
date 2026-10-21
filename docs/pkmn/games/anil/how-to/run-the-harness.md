# How to Run the Harness

Launch Pokémon Añil under the bridge, read its state, take snapshots, play it by hand or drive it, walk, talk and use its menus, look up its game data, and replay a session. How it works is in [Runtime Design](../explanation/runtime-design.md); facts verified on the game are in [Runtime Reference](../reference/runtime.md).

## Prerequisites

- The game installed as in [How to Install the Game](install-the-game.md).
- A Windows desktop session: the game window opens on Windows, and only a human sees it.
- No other `anil` game running from the same data root. Wonder's games may run alongside: they use their own working copy, data root and port.

Every command below runs from `pkmn/games/anil/`.

## Steps

### 1. Install with the bridge

```sh
uv run anil install --harness
```

This writes the bridge over the mod in the working copy and turns frame sync off. Install again with `--harness` after any change to `src/anil/bridge/`; `anil run` refuses a working copy whose bridge differs from the repo's. A plain `uv run anil install` stops preloading the bridge again.

### 2. Launch

```sh
uv run anil run
```

The game starts on the title screen, held at its first tick, and the command returns once the bridge answers. It prints the session, the save folder, the clock, the seed, the monitor the window went to, and the session's log folder. Options:

- `--save NAME` picks the save folder under the data root (`main` by default); in-game saves go there, never to `%APPDATA%\Pokemon Anil`.
- `--snapshot NAME` boots into a snapshot instead of the title.
- `--clock real` uses the wall clock instead of 2026-01-01 12:00; `--clock 2026-03-01T20:00` pins another time.
- `--seed N` fixes the RNG seed.
- `--hidden` keeps the window hidden.

### 3. Read the game

```sh
uv run anil state
```

prints the context the game waits in, the trainer, the map and position, the party, the bag, the boxes and the latest events. `--json` prints the same as JSON; `--switch N`, `--variable N` and `--self-switches` add game flags. The other readers:

- `uv run anil stack` prints the game's call stack.
- `uv run anil eval 'RUBY'` runs Ruby in the game and prints the result.
- `uv run anil shot` saves a screenshot in the session folder.
- `uv run anil rng` counts the game's random draws since boot.
- `uv run anil showdown` prints the party in Showdown's format.

### 4. Play it by hand

```sh
uv run anil control take
```

hands the game to the keyboard: click the game window and play. `uv run anil control release` hands it back to a driver, if one is attached. `uv run anil speed 2x` (or `1x`, `max`) changes the game's speed; `uv run anil speed` reads it.

### 5. Take and restore snapshots

On the idle overworld (no menu, message or battle open):

```sh
uv run anil snapshot save NAME
uv run anil snapshot restore NAME
uv run anil snapshot list
```

A name is never overwritten. `uv run anil run --snapshot NAME` boots a new game straight into one.

### 6. Walk, talk and use the menus

```sh
uv run anil go --map 4
uv run anil go --event 4 5
uv run anil interact 4 5
```

`anil go` walks the player to a tile (`MAP X Y`), onto a map (`--map MAP`) or to stand facing an event (`--event MAP EVENT`), and stops on anything it did not start, such as a wild battle, as `interrupted`. `anil interact MAP EVENT` presses C on the event the player faces and drives its dialog; `anil dialog` drives a dialog already open, after an interrupted walk or a `decision`. `--answer TEXT`, repeatable, answers the next choices or number inputs in order. `anil menu …` runs one menu verb (`continue`, `use`, `give`, `take`, `swap`, `choose`, `lens`, `vial`, `fly`, `exp-share`, `save`, `buy`, `sell`, `relearn`, `pc`); `uv run anil menu --help` lists them. Each prints the lines it saw, the outcome and the state changes, and exits 1 unless it ended as it should: `go` on `arrived`, `interact` and `dialog` on `finished` or `no_effect`, a menu verb on `finished`. The layers are in [Navigation Design](../explanation/navigation-design.md), [Dialog Design](../explanation/dialog-design.md) and [Menu Design](../explanation/menu-design.md).

The world cache and the game database are built from `game/` on first use and rebuilt when the build, the reader or the mod changes; `uv run anil world` and `uv run anil db` build and count them (`--rebuild` forces it). `uv run anil db species PIKACHU`, `move`, `ability`, `item`, `type`, `status`, `trainer-type`, `trainer`, `matchup` and `locations` look facts up; with a game running, `uv run anil db random` reads what the randomizer has rolled, `uv run anil db check` compares the database with the live game, and `uv run anil nav check` compares the passability port with the game's own on the current map ([Game Database Design](../explanation/game-database-design.md)).

### 7. Stop

```sh
uv run anil stop
```

### 8. Replay a session (optional)

```sh
uv run anil replay SESSION
```

relaunches the session from its starting save or snapshot, replays every recorded advance, eval and restore, and reports the first tick where the game diverged, or none. `--keep` leaves the replayed game running. A session on the real clock cannot be replayed.

## Verification

- `uv run anil run` prints `held until a driver attaches or anil control take hands the game over`, and `uv run anil state` answers at tick 1.
- After `uv run anil control take`, the title screen moves and the game answers the keyboard.
- `uv run anil snapshot save t && uv run anil snapshot restore t` on the overworld prints both lines with the same hash.
- `uv run anil nav check` and `uv run anil db check` exit 0 on the overworld, and `uv run anil go --map M` to a neighbouring map prints `arrived`.
- `uv run anil stop` prints `stopped session …`, and a second `uv run anil stop` prints `no game is running`.

## Troubleshooting

- **"has no bridge" or "the deployed bridge … differs":** install with `--harness` again (step 1).
- **"a game is already running":** `uv run anil stop` first; a stale lock from a killed harness is cleared by the same command.
- **"bridge port … is inside the ephemeral range":** set `ANIL_BRIDGE_PORT` to a port below the range `/proc/sys/net/ipv4/ip_local_port_range` prints.
- **The bridge failed to start or a command errors:** read `bridge.log` and `harness.log` in the session folder `anil run` printed.
