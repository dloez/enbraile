# Open Sheet

The first tool built in Enbraile. "Open Sheet" is a working name.

## Brief

In the group's Randomlocke tournament, two players have agreed to play an open-sheet fight instead of a closed-sheet one. Each shares their Pokémon with the other, without stats, along with their abilities and the relevant bag items (competitive held items, berries and TMs), and each builds their team from there. The owner's description, 2026-10-15.

Two parts, scoped and built in this order:

1. **Export script.** A Python script, run with `uv run`, that reads a player's save and writes this information to a JSON file.
2. **Web app.** It shows a player's export and helps the reader navigate it.

Part 1 is built as `pkmn/tools/export_data.py` and documented in [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md); part 2 is not designed yet. `/scope` turns each part into a scope doc and tasks ([Tasks](tasks.md)).

## Context

- [Origin Conversation](open-sheet-origin-conversation.md): the Wonder session where the export was first discussed (2026-10-13). It covers reading the save from Python, which data the Randomlocke rolls, what IVs and EVs leak through, and dropping TM compatibility on purpose. Treat it as leads; none of it is decided.
- Wonder (`~/workspace/wonder`, not yet migrated to `pkmn/wonder/`) holds verified facts about the game and the save:
  - `docs/domains/game/reference/state.md`: where the party, PC boxes and bag live, and their layouts
  - `docs/domains/game/reference/game-data.md`: species, move, ability and item data files
  - `docs/domains/game/reference/randomizer.md`: what the Randomlocke rolls and where the rolls are stored
  - `docs/domains/competition/`: the rulebook and the league format
- Wonder's harness already reads these files from a live game. Whether the export reuses any of Wonder's code before Wonder moves here is a scope question.
