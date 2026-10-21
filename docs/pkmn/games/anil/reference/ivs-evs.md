# IVs and EVs

How Añil gives Pokémon their IVs and EVs under the Randomlocke, how a player sees them, and every item, place and mechanic that changes them. How players read these facts is in [Rules → IVs and EVs](../../../series/1/reference/rules.md#ivs-and-evs). Its facts were verified with Wonder's harness and are kept as recorded there; [Runtime](runtime.md) maps Wonder's commands, modules and paths to `anil`'s.

Verified 2026-10-02 on `es-v4.14` with the Randomlocke mod and the bridge, by `wonder check ivs-evs` (`packages/harness/src/harness/check.py`). It passed in session `20261002-145832` (save `ivev-3`), booted into the snapshot `shiny-new` (the bedroom right after the intro of a new game driven in session `20261002-135643`), and `replay` replayed that session with no digest mismatch ([Runtime → Checks](runtime.md#checks)). The check reads settings, item data and map data by eval, uses each item through the game's own item handler on a Rattata with random species paused, samples IVs, loads trainers through the randomizer, and opens the summary screen in an interpreter script under a snapshot it restores afterwards. Rows marked as read from code or data were not exercised in game; their citations are to `S/` (the extracted scripts), `P/` (the plugins) and the map files.

## Limits and Settings

| Item | Value | How verified |
|------|-------|--------------|
| Limits | IVs 0–31 per stat; EVs at most 252 per stat and 510 in all (`Pokemon::IV_STAT_LIMIT`, `EV_STAT_LIMIT`, `EV_LIMIT`) | The check's read |
| Generation | `MECHANICS_GENERATION` 9, so `NO_VITAMIN_EV_CAP` is true (vitamins fill a stat to 252, not 100) and `MORE_EVS_FROM_POWER_ITEMS` is true (+8, not +4) | The check's read; the item uses below |
| IVs and EVs count in stats | `DISABLE_IVS_AND_EVS` is false and switch 149 (`MODO_SIN_GRINDEO`, "Sin Grindeo") is off. Either would make stats use 0 IVs and 0 EVs (`S/277_Pokemon.rb:1162-1168`) | The check's read |

## Where IVs Come From

The randomizer changes nothing about IVs or EVs: it picks a species before the Pokémon is built, and its code never sets either (`P/Random Pokemon & Moves + Randomizer EX (Abilities)/`).

| Item | Value | How verified |
|------|-------|--------------|
| Wild Pokémon | Each of the six IVs is drawn uniformly from 0–31 on its own (`S/277_Pokemon.rb:1371`); EVs start at 0. No wild battle on any map sets IVs: the alpha nests' and Cryogonal's `editWildPokemon` set only immunities. The one scripted wild Pokémon with fixed IVs, the armoured Mewtwo (IVs 31, EVs 100, `P/Misc Scripts Añil/000_Scripts_menores.rb:32-47`), cannot be caught (`disablePokeBalls`) | 3,000 from `pbGenerateWildPokemon`: every value's count 517–607 (562 expected, within four standard deviations), mean IV 15.49, all EVs 0. The scripted battles from a scan of every map event's script |
| Gifts and trades | Made with `Pokemon.new`, so the same uniform IVs and no EVs. The Trading Charm's +5 IVs on trades made through `pbStartTradePC` (`S/424_TradeFromPC.rb:70-80`) needs the Charms Case plugin, which is not installed | 3,000 `Pokemon.new`: counts 507–633, mean 15.45, EVs 0. The plugin check by eval |
| Starters | The three random starters are `Pokemon` objects made at the new game, with random IVs and no EVs | The check: in `shiny-new`, Totodile's IVs were 29, 21, 10, 29, 22, 30, Azurill's 21, 24, 26, 5, 3, 19 and Weedle's 9, 0, 17, 10, 5, 30, and all their EVs 0 |
| Eggs | At the Day Care (Ruta 5, map 17 event 1; Guardería, map 49 event 4) an egg takes 3 IVs from its parents, 5 if a parent holds a Destiny Knot ("Lazo Destino"), and a parent holding a power item passes that item's stat; the rest are random (`S/251_Overworld_DayCare.rb:176-211`) | Read from code |
| Trainer Pokémon | A trainer's Pokémon has the IVs its PBS entry sets, or else its PBS level / 2 (at most 31) in every stat, and its PBS level × 1.5 EVs (at most 85) in every stat (`S/141_Trainer.rb:163-174`). 1,346 of the 1,841 PBS trainer Pokémon set IVs, each the same value in all six stats; none sets EVs. The level cap lowers a trainer Pokémon's level after this, so it keeps the IVs and EVs of its PBS level. The exception: a Mega Stone holder whose random species has no Mega Stone is rebuilt with `Pokemon.new` (`P/Random Pokemon & Moves + Randomizer EX (Abilities)/006_Trainers.rb:85-102`), so it gets random IVs and 0 EVs | Every 25th trainer loaded through the randomizer at 0 badges (cap 14): 66 of 69 Pokémon followed the rule, 57 of them lowered to the cap; the other three (Surya's, PBS level 58, and two of Altomando's, 72 and 100) held Mega Stones in the PBS and had random IVs and 0 EVs |

## Seeing IVs and EVs

| Item | Value | How verified |
|------|-------|--------------|
| Summary screen | The summary's second "Estadísticas" page (`page_allstats`, drawn by the [SV] Summary Screen plugin's `drawPageAllStats`) shows each stat's EVs and IVs as "EV/IV" ("PS", "Ataque", "Defensa", "At. Esp.", "Def. Esp.", "Velocidad"), the EV total as "EVs totales" out of 510, and the Hidden Power type ("Poder Oculto"). The SV plugin registers the page with no condition, replacing Lin's IV EV Summary Screen's registration and its `SHOW_ADVANCED_STATS` condition, so it shows for every Pokémon (`P/[SV] Summary Screen/[001] Base Plugin/[000] Summary Handlers.rb:64-70`). IV rating icons are also on (`SUMMARY_IV_RATINGS`) | The check opened the summary of the starter Totodile and pressed Right to that page: it drew 0/29, 0/21, 0/10, 0/29, 0/22, 0/30 and 0/510, its EVs and IVs; a screenshot was taken. The rating icons read from the settings only |
| IV judge | None is needed and none exists: no event judges IVs | The scan of every map event |

## Raising and Lowering

Every item below except the held ones is used from the bag on a party Pokémon. The Chapas, vitamins, Mochis, feathers and berries refuse with "No tendría ningún efecto." when they would change nothing; the Mochi Reinicio is just not used up.

| Item | Value | How verified |
|------|-------|--------------|
| Chapas (IVs) | Añil's IV items (`P/Chapas/Chapas.rb`): "Chapa Vigor" (HP), "Chapa Fuerte" (Attack), "Chapa Robusta" (Defense), "Chapa Sabia" (Sp. Atk), "Chapa Espíritu" (Sp. Def), "Chapa Ímpetu" (Speed). Each use adds 10 to that IV, up to 31, with no limit on uses. The plugin's "Chapa Dorada" (all IVs to 31) is commented out and is not an item | From IV 5: 15, 25, 31, then refused; "Los puntos individuales del Ataque de Rattata han aumentado." |
| Vitamins | "Más PS", "Proteína", "Hierro", "Calcio", "Zinc", "Carburante": +10 EVs per use, up to 252 | HP Up: +10 first, 26 uses allowed from 0, 252 after them, then refused |
| Mochis | "Mochi Vigor", "Mochi Músculo", "Mochi Aguante", "Mochi Intelecto", "Mochi Mente", "Mochi Ímpetu": +50 EVs per use, up to 252. They are not flagged as vitamins | Health and Muscle Mochi: +50 first, 6 uses allowed, 252 after them, then refused |
| Feathers | "Pluma Vigor", "Pluma Músculo", "Pluma Aguante", "Pluma Intelecto", "Pluma Mente", "Pluma Ímpetu": +1 EV per use, up to 252. Flagged as vitamins | Health Feather: +1 first, 252 uses allowed, 252 after them, then refused |
| The 510 total | Every EV item stops at 510 in all | HP Up on 505 total EVs raised it to 510 |
| EV-reducing berries | "Baya Grana" (HP), "Baya Algama" (Attack), "Baya Ispero" (Defense), "Baya Meluce" (Sp. Atk), "Baya Uvav" (Sp. Def), "Baya Tamate" (Speed): −10 EVs in that stat per use, down to 0, and more happiness | Pomeg Berry from 25 HP EVs: 15, 5, 0, happiness 70 → 81 → 92 → 103 |
| Reset | "Mochi Reinicio" sets every EV to 0 | From 100 HP and 60 Speed EVs: all 0 |
| Power items | "Pesa Recia" (HP), "Brazal Recio" (Attack), "Cinto Recio" (Defense), "Lente Recia" (Sp. Atk), "Banda Recia" (Sp. Def), "Franja Recia" (Speed): held, +8 EVs in their stat from every Pokémon defeated | `triggerEVGainModifier` on a Rattata's yield (1 Speed): Power Weight gave 8 HP and 1 Speed, Power Anklet 9 Speed |
| Macho Brace | "Brazal Firme", held: doubles the EVs from every Pokémon defeated | The same: 2 Speed |
| Battle EVs | Each Pokémon that gains EXP from a defeated Pokémon (the battlers, EXP Share holders, and the whole party with EXP Share on) also gains its EV yield (`S/414_ExpShare.rb:175-210`). EVs are gained before EXP and the level cap does not stop them (`P/Level Caps EX/001_Main.rb:80` overrides only `pbGainExpOne`) | Read from code |
| Pokérus | Doubles battle EVs (`S/152_Battle_ExpAndMoveLearning.rb:74-77`). A wild Pokémon or egg has it 3 times in 65,536 (`POKERUS_CHANCE`) | The setting read; the rest read from code |
| Punch-bag training | At the Dojo Azafrán (map 117) two trainers offer a "super-entrenamiento de Puntos de Esfuerzo": event 19 for HP, Defense or Sp. Def, event 20 for Attack, Sp. Atk or Speed. It is free, has no condition and can be repeated. It is 10 rounds of a timing minigame, each scored 1 to 5; the chosen stat gains 126 EVs times the share of the score above 10 out of 40 (the share is rounded to a whole percentage, then the EVs are rounded down), so 126 for a perfect 50 and none for 10, within 252 and 510. Eggs, fainted Pokémon and Pokémon already at the limit cannot take part (`P/Misc Scripts Añil/013_Punch Bag Minigame.rb:484-600`) | The events and their stats from the check's map scan; the formula read from code; the minigame not played |
| Not in the game | Bottle Caps and Gold Bottle Caps do not exist as items, and no event sets `ivMaxed`, so there is no Hyper Training | The check's read and map scan |

## Where the Items Come From

| Item | Value | How verified |
|------|-------|--------------|
| Marts | Four marts sell these items: the Centro Comercial (map 78, event 42) the six vitamins, Pueblo Marengo (map 91, event 50) the six EV-reducing berries at 20 each, and the Dojo Magenta (map 207) the six power items at 3,000 each (event 6) and the six Mochis and the Mochi Reinicio at 250 each (event 9). No mart or BP shop sells Chapas, feathers or the Macho Brace. When each mart can be reached is not checked | The check's scan of every map event's mart and BP-shop calls; prices from the item data. The Pueblo Marengo and Dojo Magenta marts' buy screens, opened from their events' own script commands on a fresh new game, listed these items at these prices ([Randomizer → TMs and Items](randomizer.md#tms-and-items)) |
| The vitamin ban | The Randomlocke's mart rules refuse items flagged as vitamins, healing items or battle items (`P/Challenge Modes/009_Marts.rb`), so the Centro Comercial's vitamins are refused ([Nuzlocke](nuzlocke.md)). The Mochis, the Mochi Reinicio, the EV-reducing berries and the power items carry none of those flags, so the marts sell them | The flags read by the check; the refusal of Protein seen by the `mart-bans` check; buying a Mochi, berry or power item not driven |
| Found and received items | Añil places Chapas, vitamins, a Macho Brace (Ruta 9) and a Destiny Knot (Ruta 5) as item balls and rewards, Chapas among them as gym rewards and alpha-nest prizes. Under the Randomlocke every item found or received is random ([Randomizer → TMs and Items](randomizer.md#tms-and-items)), so these places give random items instead. Every item on this page is in the random item pool, so any random item can be one | The pool membership read by the check; the placements from a scan of every map event's script commands for these items, made while writing this doc |
