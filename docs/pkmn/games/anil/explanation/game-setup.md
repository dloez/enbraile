# Game Setup

The harness needs a game it can drive and read deterministically and fast, from Python in WSL. This doc records which game we play and how the harness reaches it.

## Game

Pokémon Añil: a free Spanish fan game built on RPG Maker XP and Pokémon Essentials v21.1, shipped as a Windows `Game.exe` (64-bit mkxp-z with Ruby 3.1). Its game logic is `Data/Scripts.rxdata` plus 52 plugins in `Data/PluginScripts.rxdata`, among them a randomizer and the Challenge Modes Nuzlocke.

We play the Spanish v4.14 build, packaged as the group's Randomlocke ([Randomlocke Design](randomlocke-design.md)). The game runs natively on Windows, launched from WSL, and the harness reaches it through a Ruby bridge injected with `mkxp.json` `preloadScript`, over a loopback socket. The design is in [Runtime Design](runtime-design.md); the evidence is in [Runtime → Player and Engine](../reference/runtime.md#player-and-engine).

## Decisions

The harness's own decisions on the game files, saves, the clock, eval, input and control, speed and lockstep are owned by [Runtime Design → Decisions](runtime-design.md#decisions); Wonder's control panel and its refusal of eval to agents stay in Wonder.

- **Game:** Pokémon Añil v4.14, replacing Pokémon Z completely: the Z build row and Z's `game/` files are deleted, and no multi-game support is kept. Z had replaced Pokémon Platinum the same way. — The owner's choice; the competition moved to Añil, and the repo is greenfield. _(settled 2026-09-30 for Pokémon Z; switched to Añil 2026-10-02)_
- **Randomizer settings:** every player plays the same packaged Añil, whose new game starts with Añil's own randomizer and Challenge Modes Nuzlocke set to the owner's configuration, with no mode menus ([Randomlocke Design → Nuzlocke](randomlocke-design.md#nuzlocke), [Randomizer](randomlocke-design.md#randomizer)). — The owner supplied the configuration. _(settled 2026-10-02)_
- **Build:** Spanish v4.14 (`es-v4.14`), fetched from the owner's local archive, keyed by build: every build-specific fact is keyed by build, and names come from the game's own data — The owner's choice; facts verified on one build don't carry to another. _(settled 2026-09-30 for Z v2.18; Añil v4.14 2026-10-02)_
- **Runtime:** the game's own `Game.exe` (64-bit mkxp-z with Ruby 3.1.3 on Añil) runs natively on Windows, launched and killed from WSL through interop — The only path shown working, and running the game on another player would change the runtime that facts are verified on ([Runtime → Player and Engine](../reference/runtime.md#player-and-engine)). _(settled 2026-09-30, Añil's player 2026-10-02)_
- **Access:** a Ruby bridge loaded by `mkxp.json` `preloadScript`, serving generic object reads (typed in Python by the harness) and taking input over JSON lines on a loopback TCP socket; all our changes to the game are preload Ruby files in the repo, and `Scripts.rxdata` and `PluginScripts.rxdata` stay pristine. _(settled 2026-09-30, `PluginScripts.rxdata` added 2026-10-02)_

## Open

- None.
