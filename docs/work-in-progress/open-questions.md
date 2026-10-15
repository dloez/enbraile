# Open Questions

Everything not yet decided. Never resolve one silently in code; close it as described in [Recording Decisions](../general/how-to/write-documentation.md#recording-decisions).

## Shared Pokémon material before Wonder moves

Whether the group's shared Pokémon material (the Randomlocke rulebook and competition format, the Randomlocke package, the Añil game facts) moves into `pkmn/` now or waits for Wonder's migration. It all lives in Wonder today.

Owner: [Repository Layout](../general/explanation/repository-layout.md).

## Which item IDs count as Showdown's

The export names items by the Showdown-style ID of their PokéAPI English name, but 67 of the 306 nameable pocket 1 items and every TM item are absent from Showdown's own item data. Whether those are left out with a notice, kept, or kept only for TMs.

Owner: [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md).

## Held items of permafainted Pokémon

The export adds held items only from the Pokémon it exports, so an item held by a permafainted Pokémon is left out with no notice, though the player can recover it. Whether those items count as shared.

Owner: [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md).
