# How to Run the Harness

Launch Pokémon Añil under the bridge, read its state, take snapshots, play it by hand or drive it, and replay a session. How it works is in [Runtime Design](../explanation/runtime-design.md); facts verified on the game are in [Runtime Reference](../reference/runtime.md).

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

### 6. Stop

```sh
uv run anil stop
```

### 7. Replay a session (optional)

```sh
uv run anil replay SESSION
```

relaunches the session from its starting save or snapshot, replays every recorded advance, eval and restore, and reports the first tick where the game diverged, or none. `--keep` leaves the replayed game running. A session on the real clock cannot be replayed.

## Verification

- `uv run anil run` prints `held until a driver attaches or anil control take hands the game over`, and `uv run anil state` answers at tick 1.
- After `uv run anil control take`, the title screen moves and the game answers the keyboard.
- `uv run anil snapshot save t && uv run anil snapshot restore t` on the overworld prints both lines with the same hash.
- `uv run anil stop` prints `stopped session …`, and a second `uv run anil stop` prints `no game is running`.

## Troubleshooting

- **"has no bridge" or "the deployed bridge … differs":** install with `--harness` again (step 1).
- **"a game is already running":** `uv run anil stop` first; a stale lock from a killed harness is cleared by the same command.
- **"bridge port … is inside the ephemeral range":** set `ANIL_BRIDGE_PORT` to a port below the range `/proc/sys/net/ipv4/ip_local_port_range` prints.
- **The bridge failed to start or a command errors:** read `bridge.log` and `harness.log` in the session folder `anil run` printed.
