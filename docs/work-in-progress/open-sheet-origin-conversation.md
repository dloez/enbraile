# Open Sheet: Origin Conversation

The Claude Code session in Wonder where the open fight's export was first discussed, kept as context for scoping [Open Sheet](open-sheet.md). It predates the decision to build it in Enbraile. Claude's answers here are a feasibility read, not verified facts or decisions: check every claim about the save against a real save before relying on it.

- **Session:** `68106453-83e3-4903-9cdf-3c9ffae7c629`, project `~/workspace/wonder`, 2026-10-13
- **Transcript:** `~/.claude/projects/-home-david-workspace-wonder/68106453-83e3-4903-9cdf-3c9ffae7c629.jsonl`
- The messages below are verbatim; Claude's two tool calls (greps over Wonder's docs) are left out.

## Owner — 2026-10-13 23:19
i have decided with my rival of the fifth fight (we reduced from 8 to 5, so 5 is in the seventh gym) that we are gonna do an open fight. the idea is that we generate a python script that is able to, from the save file, to get the info of all the pokemons from both the team party and the pc and all the bag items. we need to know what the pokemons are able to learn from both moveset and player mts. we would like to avoid seeing the pokemon ivs and evs. how feasable is this? just answer this

## Claude — 2026-10-13 23:20
**Very feasible.** It's a small, self-contained script. The pieces:

**What's easy**
- **The save is Ruby Marshal** (`Partida N.rxdata`). We already read Marshal from Python with `rubymarshal` (game-data reads in `docs/domains/game/reference/`). Unknown classes come back as generic objects with their ivars, so the party (`$player.party`), the PC boxes (`$PokemonStorage`) and the bag pockets (`$bag`) can all be read directly.
- **Names and base data** (species, moves, items, abilities) come from the game's `Data/*.dat` files, which are also Marshal. The script just needs to be pointed at the game folder.
- **Hiding IVs and EVs** just means not printing them.

**What needs care (the Randomlocke parts)**
- **Level-up learnsets are randomised, but they're in the save** (`$PokemonGlobal.random_moves`, one per species-form). Any Pokémon you own already has its learnset rolled, because its starting moves were drawn from it.
- **Which move each TM teaches is randomised, and also in the save** (`tm_move_map`).
- **TM compatibility is the real catch.** It's rolled lazily, one species+move pair at a time, only when the game first asks "can X learn TM Y?" (`tm_compatibility_random`). Pairs the game never asked about don't exist yet. An offline script can't answer them, and it mustn't roll them itself. It would get a different answer from the game, and writing the answer back would change your run. Two fixes:
  - mark those pairs "unknown" in the output, or
  - before exporting, each player opens the TM screen on their team in-game, which makes the game roll the answers.
- **The ability table** (`$randomized_data`) is a global. I haven't checked whether it's written to the save file or rebuilt at load. That needs a quick check.

**Caveats on "no IVs/EVs"**
- **Final stats give them away.** With level, nature and base stats known, the actual stats let anyone work the IVs/EVs back out fairly closely. So either leave stats out (show base stats, level and nature) or agree that stats are fine.
- **Hidden Power's type** says something about IVs, if anyone has it.
- **It's honour-based.** The IVs are still in the raw save. The script only filters what it prints, so either of you could read them with your own code.

**Effort:** a few hundred lines in one file, about half a day including checking it against a real save. Your rival would run it with `uv run --with rubymarshal python3 open_fight.py <save> <game dir>`, with nothing else to install.

## Owner — 2026-10-13 23:24
then, lets simplify it. lets export pokemons without ivs and evs and then lets also export bag items (relevant, not pokeballs or healing) and the mts. we will miss wich pokemons learn each mts on purpose. feasable?

## Claude — 2026-10-13 23:24
**Yes, and it's easier than before.** Dropping TM compatibility removes the only part an offline script couldn't fully answer. Everything left is already in the save:

- **Pokémon, party and PC:** species and form, level, nature, ability, held item, current moves, and the level-up learnset (randomised but stored in the save). IVs and EVs are simply left out.
- **TMs:** the bag's TM pocket, with each TM's move read from `tm_move_map`. A TM's move is rolled when you obtain it, so every TM you own has its move in the save.
- **Bag items:** the bag is sorted into pockets (Items, Medicine, Poké Balls, TMs, Berries, Battle Items, Key Items). To skip balls and healing, drop the Medicine and Poké Balls pockets and export the rest. That's mainly held items, plus berries and battle items if you want them. You and your rival just need to agree which pockets count.

Two things are still open:

1. **Stats:** a Pokémon's final stats let someone work its IVs and EVs back out. I'd show base stats, level and nature and leave final stats out.
2. **Abilities:** the randomised ability table might not be stored in the save. If it isn't, the script could still print the ability for any Pokémon whose ability is already set, and I'd check that against a real save first.

Effort is a couple of hours, as one file both of you run on your own saves.
