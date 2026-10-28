# Series 1 Rules

The complete rulebook of series 1, the group's Randomlocke of Pokémon Añil: every rule that applies to a game started from the Randomlocke package, and the group's own rules. Each rule is a plain statement. The mod's configuration, the reasons behind it and its build choices are in [Randomlocke Design](../../../games/anil/explanation/randomlocke-design.md), cited as `source:` with a link to its section. The game facts and evidence behind a rule are in Añil's reference docs, such as [Runtime](../../../games/anil/reference/runtime.md), also cited as `source:` with a link to their section.

Every rule before [The Group's Rules](#the-groups-rules) is set by the package itself, and no player option turns it off. A rule is verified in the running game unless it says **configured, not yet seen in game**; those are listed together under [Not Yet Seen in Game](#not-yet-seen-in-game).

The game is in Spanish. Quoted Spanish strings are exactly what the game shows, kept as they are so they can be matched on screen; each gets an English gloss in parentheses the first time it appears.

## The Package

- **Everyone plays the same game:** Pokémon Añil v4.14 (Spanish) with the Randomlocke mod, version 1. The window title reads "Pokémon Añil Randomlocke v1" (source: [Runtime → Packages](../../../games/anil/reference/runtime.md#packages)).
- **The rules apply to new games only.** A new game skips every mode menu: the difficulty, the visible-wild-Pokémon question and the PC's "Elegir modo de juego" ("Choose game mode") never ask anything. After the rival's name the player wakes in the bedroom with the "Libro de Reglas" (Rule Book) in the bag, and the PC's "Elegir modo de juego" only says the modes are fixed (source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod)).
- **No starter-region question.** The game never asks which region's starters the laboratory offers ("Elige de qué generación quieres que sean los Pokémon Iniciales…", "Choose which generation you want the starter Pokémon to be from…"); the mod records Kanto silently, and the lab's three Poké Balls (map 29) offer the game's three random starters ([Randomizer](#randomizer); source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod)).
- **A new game saves itself once.** When the player first wakes in the bedroom, the game saves, silently, into a new slot ("Partida N", the first free number) and never over an existing save. The random starters are in that save from the start, so the only way to get other starters is to play the intro again in another new game (source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod)).
- **The base game must be unmodified.** At boot the mod checks it runs on the official v4.14 files; if not, a warning, "Aviso de la Randomlocke: …" ("Randomlocke warning: …"), appears before the title screen and the rules may not work (source: [Runtime → Packages](../../../games/anil/reference/runtime.md#packages)).
- **No updates.** The game's update check is off, so the game never goes online for updates and never replaces itself; a fix comes as a new package. Discord Rich Presence is off (source: [Runtime → Bridge Start](../../../games/anil/reference/runtime.md#bridge-start)).
- **The party can be copied to Pokémon Showdown.** In the pause menu, Z ("[Z] Exportar a Showdown") copies the party, eggs and permafainted Pokémon left out, to the clipboard in Showdown's team format: every Pokémon at Level 50, with its nickname, gender, item, ability, nature, moves, its real IVs (only those below 31 listed) and 1 EV in every stat, under the English names Showdown's import recognises. If any of them has no Showdown name (Arceus's ??? form, or Añil's own species, items, abilities and moves), the game says which and copies nothing (source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod); source: [Randomlocke Design → Showdown Export](../../../games/anil/explanation/randomlocke-design.md#showdown-export)).
- **Saves** go to Añil's normal save folder, `%APPDATA%\Pokemon Anil`, shared with any normal Añil install (source: [Runtime → Player and Engine](../../../games/anil/reference/runtime.md#player-and-engine)); the package does not redirect players' saves.

## Nuzlocke

Añil's Challenge Modes, with exactly these rules on: "Muerte Permanente" (permadeath), the three mart bans, "Una captura por mapa" (one capture per map) with "Cláusula Primer Pokémon" (first Pokémon clause) and the gift, shiny, duplicates and legendary clauses, "Motes Obligatorios" (mandatory nicknames) and "Modo de Combate Fijo" (Set battle style). Off: "Cláusula Vidas" (lives clause), "Cláusula Revivir" (revive clause), Permalocke and its slot recovery, "Cláusula sin Piedad" (no-mercy clause), "Bloqueo de Mochila" (bag lock) and "Sin Capturas" (no catching). How each rule behaves, with its evidence, is in source: [Nuzlocke](../../../games/anil/reference/nuzlocke.md).

- **The challenge starts at the first Poké Ball.** The game announces it with "¡Tu desafío ha comenzado! ¡Buena suerte!" ("Your challenge has begun! Good luck!").
- **Fainted means dead.** A Pokémon at 0 HP stays at 0 HP: Revive and Max Revive have no effect, and a Pokémon Center heals the living but not the fainted.
- **Marts don't sell healing items, battle items or vitamins.** The mart refuses each with a message, and no money changes hands. Only buying is banned: healing items found or received may be used, and Pokémon Centers heal the living as usual. On the visit whose Poké Balls start the challenge the game still sells healing items, and the group's rule bans them there too ([Healing and the League](#healing-and-the-league)).
- **Only the first encounter on each map counts.** A wild battle on a map uses up that map's encounter, whether the Pokémon is caught or the player flees. After that, Poké Balls are refused in wild battles on that map, with "¡La regla "Cláusula Primer Pokémon" te impide atrapar un Pokémon en un mapa en el que ya tuviste un encuentro!" ("The 'first Pokémon clause' rule stops you from catching a Pokémon on a map where you already had an encounter!").
- **Gifts, shinies, dupes and legendaries don't use up the encounter.** A gift Pokémon, a shiny, a Pokémon whose evolutionary family the player already owns, and a legendary each leave the map's encounter unused. A family counts as owned once the Pokédex marks any of its species as owned, caught or received, so it still counts after its only member has died or been released.
- **Every Pokémon must be nicknamed.** A caught or gifted Pokémon goes straight to the name screen, and its species name, in any case, is refused.
- **A whiteout revives no one.** After a lost battle, the living are healed and the fainted stay fainted.
- **A party wipe forces a PC swap.** If every party Pokémon has fainted but one in the PC is alive, the game opens the PC and won't let the player leave until a living Pokémon is in the party.
- **A total wipe loses the challenge.** When no living Pokémon is left anywhere, the game says "¡Has perdido el desafío!" ("You have lost the challenge!") and records the loss. Every challenge rule then switches off and every Pokémon is revived, so play goes on as a normal game. For the competition the player is out ([The Group's Rules → Losing the Challenge](#losing-the-challenge)).
- **Beating the league records a victory but doesn't end the challenge.** The Hall of Fame entry leaves the challenge alone, and the credits record the win. Every challenge rule stays on afterwards, "Muerte Permanente" included, although that rule's own description says fainted Pokémon stay fainted "hasta pasarte la liga" ("until you beat the league"). The package keeps this behaviour by the owner's choice (source: [Randomlocke Design → Nuzlocke](../../../games/anil/explanation/randomlocke-design.md#nuzlocke)).

## Randomizer

Añil's randomizer in "Random Completo" (fully random) mode, progressive, with Gen 1–5 as its generations. What each part does in game, with its numbers and evidence, is in source: [Randomizer](../../../games/anil/reference/randomizer.md); the evidence that the Gen 1–5 caps hold is in source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod).

- **Every Pokémon is random:** wild, trainer, gift and starter Pokémon all get a random species.
- **Random Pokémon grow stronger with badges.** A random species is drawn from a base-stat-total window that rises with the badge count.
- **Three random starters,** each the first stage of a family with two or more evolutions, from three different families.
- **Wild encounters are fixed per map.** Each map's table is randomized once, the first time a wild Pokémon is drawn there, keeping its slots, chances and levels; each slot gets a species of similar base stat total. The table stays the same afterwards. Wild Pokémon may hold random items.
- **Learnsets are random,** at the original learnset's levels, favouring the Pokémon's own types, with no move repeated and no one-hit-KO move. Moves learnt at low levels are weak: up to level 30 (the 0–2 badge windows) a move's power is at most 70. Moves learnt at high levels are never weak early-game filler: from level 50 (the 5+ badge windows) a move is never one of the randomizer's `LATE_GAME_BANNED_MOVES`, such as Tackle ("Placaje") or Ember ("Ascuas"), a list that also holds status moves like Growl and Leer.
- **Abilities are fully random,** fixed per species.
- **Trainer teams are random and remembered:** a trainer has the same team every time. Their held items are random too.
- **Items are random:** items found or received, and the items gift Pokémon may hold.
- **TMs are random:** the move each TM teaches, which Pokémon can learn each TM, and the TMs sold at the three TM marts ("Centro Comercial" (shopping centre), "Ruta 14" (Route 14), "Liga Pokémon" (Pokémon League)).
- **Every other Poké Mart keeps its stock:** it sells the items Añil gives it, at their usual prices. _The randomizer's code does not touch the two Battle Point shops either, but they were not opened in game._
- **Types and evolutions are not randomized.** _Configured, not yet seen in game._
- **Each new game is randomized on its own,** with no shared seed, so every player faces a different game. _Configured, not yet seen in game._

## Gen 1–5 Limits

Our additions to the randomizer. The evidence is in source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod) and source: [Runtime → Checks](../../../games/anil/reference/runtime.md#checks).

- **Only Gen 1–5 Pokémon.** Every random Pokémon (wild, trainer, gift and starter) is a Gen 1–5 species in one of its official Gen 1–5 forms: no regional, Primal, mega or fan forms, and none of Añil's own species. A starter's whole family is Gen 1–5. Forms the game sets later from a held item or in battle are left as the game sets them.
- **No evolving into a later generation.** An evolution into a species after Gen 5 never happens: an Eevee given a Shiny Stone does not become Sylveon, and a Primeape never becomes Annihilape. Its other evolutions still work.
- **Only Gen 1–5 moves.** Every random move (learnsets, trainer movesets, TMs) is an official Gen 1–5 move; Añil's custom moves are out.
- **When a type runs out of moves, any type fills in.** Some types have few Gen 1–5 moves (Fairy has three), so when a draw that wants a move of the Pokémon's own type has none left that fits, it takes a Gen 1–5 move of any type instead, still within the badge's power limits and never one already learnt.
- **Only Gen 3–5 abilities.** Every random ability, including from the Random Ability Capsule, is an official Gen 3–5 ability; Añil's custom abilities are out.
- **Legendaries stay in the pool.** They may be caught but never used ([The Group's Rules → Rules in Every Battle](#rules-in-every-battle)).
- **No Mega Evolution.** Neither the player nor a trainer can mega evolve, even holding a Mega Stone with a Mega Ring. Mega Stones stay in the game as items, and trainers keep holding them.

## Level Cap

A hard cap, set by Añil's Level Caps EX plugin as shipped. How it holds, with its evidence, is in source: [Level Caps](../../../games/anil/reference/level-caps.md).

- **No Pokémon can go above the cap.** At the cap, a Rare Candy has no effect and is not used up, and battle EXP stops; EXP that would cross the cap stops at the cap level.
- **Trainers' Pokémon above the cap are brought down to it.** Seen at 0 badges (source: [Randomizer → Trainers](../../../games/anil/reference/randomizer.md#trainers)), and the same with the plugin's bypass switch on. That switch, named "Tienes Pokédex Nacional" ("You have the National Pokédex"), is never turned on by the game, and it lifts the cap neither for the player nor for trainers (source: [Level Caps](../../../games/anil/reference/level-caps.md)).
- **The cap rises with each badge:**

| Progress | Level cap |
|----------|-----------|
| Start (no badges) | 14 |
| 1st badge | 23 |
| 2nd badge | 30 |
| 3rd badge | 39 |
| 4th badge | 49 |
| 5th badge | 54 |
| 6th badge | 59 |
| 7th badge | 66 |
| 8th badge | 75 |
| Game beaten | 100 |

Every cap value was read in game, with the switch for that badge, or for beating the game, turned on by the tooling rather than earned in play; the Rare Candy and battle EXP were tested at the start cap only. Where the values come from is in source: [Level Caps](../../../games/anil/reference/level-caps.md).

- **Rare Candies ("Caramelos Raros") are free and unlimited** from the candy cups in every Pokémon Center ([Healing and Rare Candies](#healing-and-rare-candies)), and still stop at the cap. The only Rare Candy item ball, on Ruta 6 (map 18, event 18), goes through the randomizer and gives a random item.

## Battles Use Modern Rules

Battles follow the Gen 9 mechanics that Pokémon Essentials implements, with Añil's own setting for snow, and with freeze as in the official games, even though every Pokémon, move and ability is from Gen 1–5. The evidence is in source: [Battle Mechanics](../../../games/anil/reference/battle-mechanics.md).

- **The Fairy type exists, and the type chart is the modern one.** Fairy beats Fighting, Dragon and Dark; Dragon moves don't affect it; Poison and Steel beat it. Steel no longer resists Ghost or Dark. Clefairy and Togepi are Fairy, and Charm, Moonlight and Sweet Kiss are Fairy moves.
- **Every Pokémon has its official types.** Añil had changed the types of 33 Gen 1–5 species, among them the Chikorita line (Grass/Fairy), Feraligatr (Water/Dragon) and Emboar (Fire/Dark). The Randomlocke puts them all back to the official types: the Chikorita line is pure Grass, Feraligatr pure Water and Emboar Fire/Fighting. Types that became official in Gen 6, such as Fairy, stay. The full list is in source: [Battle Mechanics → Types](../../../games/anil/reference/battle-mechanics.md#types).
- **Critical hits do 1.5× damage,** at a base chance of 1 in 24.
- **Burn** costs 1/16 of max HP each turn and halves physical damage.
- **Paralysis** halves Speed and stops the Pokémon 25% of the time (_read from the game's code, not yet seen in game_). Electric types can't be paralysed.
- **Sleep** lasts 1 to 3 turns. _Read from the game's code, not yet seen in game._
- **Poison** costs 1/8 of max HP each turn; bad poison costs 1/16 more each turn.
- **Freeze works as in the official games.** A frozen Pokémon can't move; each turn it tries, it has a 1 in 5 chance to thaw and move. Being hit by a Fire attack thaws it, and so does using a move that thaws its user, such as Flame Wheel. Ice types can't be frozen, and nothing can be frozen in sun. Freeze costs no HP and doesn't change damage. Añil had replaced freeze with frostbite; the Randomlocke puts freeze back. That a thawing move that isn't Fire, such as Scald, also thaws the Pokémon it hits is _read from the game's code, not yet seen in game_.
- **Weather from an ability lasts 5 turns.**
- **Hail is replaced by snow,** "Nevada" (snowfall): it hurts no one, and Ice types get 1.5× Defense against physical moves.

## Shinies

How often shinies appear, as Añil makes them under the Randomlocke. The evidence is in source: [Shinies](../../../games/anil/reference/shinies.md). The group's limits on shinies are in [The Group's Rules → Rules in Every Battle](#rules-in-every-battle).

- **A wild Pokémon is shiny about 1 in 500.** Añil gives every wild Pokémon two separate chances: the usual one, about 1 in 1,000, and one more of 1 in 1,000 from its visible-encounters add-on, which runs precisely because visible wild Pokémon are off. Out of 100,000 wild Pokémon made by the game, 198 were shiny.
- **What that means for a run:** about 0.2 shinies per 100 wild battles, so roughly one in every 500 wild battles: a run fighting 300 wild battles meets one with a 45% chance, and 1,000 battles meet about two.
- **Chains raise it.** Defeating or catching the same species in a row raises the extra chance for that species every 10 in a row, up to 1 in 200 at 40 or more (about 1 in 170 in all). Another species restarts the chain; fleeing or losing leaves it alone.
- **Battling a species often raises it slightly.** After 50 battles against a species, its wild Pokémon get a small chance of extra rolls (_read from the game's code, not yet seen in game_).
- **The Shiny Charm ("Amuleto Iris") can't be had.** Professor Oak gives it only for a complete National Pokédex of 1,027 species, and the Randomlocke's random Pokémon come from only 649. With it, wild shinies would be about 1 in 200 (_measured with the charm added by the tooling; that it can't be obtained is read from the game's data_).
- **The Shiny Potion ("Poción Brillante") makes the next wild Pokémon shiny.** The Battle Tower's shop sells it for 80 BP, and any random item found or received can be one (about 1 in 576). The alpha nests that would give it give a random item instead (_where it comes from is read from the game's data_).
- **Gifts and starters are shiny about 1 in 1,000,** with no extra chance. Four gifts are always shiny, with a random species: Bill's, Cintia's, Mirto's and Máximo's, on the islands (_read from the game's data_).
- **Trainers' Pokémon are never shiny.**
- **A shiny can always be caught:** it doesn't use up the map's encounter ([Nuzlocke](#nuzlocke)).

## IVs and EVs

How Pokémon get their IVs and EVs, and every way to see or change them. The evidence is in source: [IVs and EVs](../../../games/anil/reference/ivs-evs.md). The group's rules forbid changing EVs or IVs by any means ([The Group's Rules → Rules in Every Battle](#rules-in-every-battle)).

- **Every Pokémon's IVs are random,** 0 to 31 in each stat: wild Pokémon, gifts, trades and the three starters. No wild Pokémon you can catch has fixed or guaranteed perfect IVs, and the randomizer doesn't change IVs or EVs.
- **The summary shows exact IVs and EVs.** The second "Estadísticas" (Stats) page shows each stat as "EV/IV" and the "EVs totales" (total EVs) out of 510. There is no IV judge, and none is needed.
- **Trainers' IVs and EVs follow their original level,** even when the level cap brings the Pokémon down: the IVs the game sets for it, or half its original level, up to 31, and 1.5 times its original level in EVs, up to 85 per stat. The exception is a trainer's Mega Stone holder whose random species has no Mega Stone: the game rebuilds it with random IVs and no EVs.
- **EVs go up to 252 per stat and 510 in all.** Defeating a Pokémon gives its EVs to every Pokémon that gets EXP from it, EXP Share included, and also at the level cap. Pokérus and the Macho Brace ("Brazal Firme") double them, and each power item adds 8 to its stat (_read from the game's code, not yet seen in game_).
- **Chapas raise IVs:** "Chapa Vigor", "Fuerte", "Robusta", "Sabia", "Espíritu" and "Ímpetu" each add 10 to one IV, up to 31, as many times as wanted. No shop sells them, so they only come as random items.
- **No Bottle Caps and no Hyper Training.**
- **Vitamins add 10 EVs** to a stat, up to 252. Marts refuse them, so they only come as random items.
- **Mochis add 50 EVs** to a stat, up to 252, and are not vitamins, so the ban doesn't cover them: the Dojo Magenta sells all six for 250 each, with the "Mochi Reinicio" (fresh-start mochi), which sets every EV back to 0 (_the stock seen on the mart's buy screen, not yet bought in game_).
- **Feathers add 1 EV** to a stat, up to 252. No shop sells them.
- **EV-reducing berries take away 10 EVs** from a stat and raise happiness. Pueblo Marengo sells all six for 20 each (_the stock seen on the mart's buy screen, not yet bought in game_).
- **Power items** ("Pesa Recia", "Brazal Recio", "Cinto Recio", "Lente Recia", "Banda Recia", "Franja Recia") are sold at the Dojo Magenta for 3,000 each (_the stock seen on the mart's buy screen, not yet bought in game_).
- **Punch-bag training gives up to 126 EVs a go.** At the Dojo Azafrán two trainers offer a free, repeatable minigame of 10 punches; a perfect score gives 126 EVs in the chosen stat (_read from the game's code, not yet played_).
- **Breeding passes IVs on:** an egg gets 3 IVs from its parents, 5 if a parent holds a Destiny Knot ("Lazo Destino"), and a parent's power item passes its stat (_read from the game's code, not yet seen in game_).
- **Any random item can be one of these items:** every item on this list is in the randomizer's item pool.

## Healing and Rare Candies

Healing outside the Pokémon Centers, and where Rare Candies come from. The evidence is in source: [League, Pokévial and Candy Cups](../../../games/anil/reference/league.md).

- **The Pokévial heals the party anywhere outside battle.** The "Pokévial", a free key item from Professor Oak's lab, fully heals the party, one charge per use, and does nothing in battle. It never revives a permafainted Pokémon. It starts with 1 charge and holds up to 5, one more for each of the four "Mejora del Pokévial" (Pokévial upgrade) pickups: Ruta 20, Ciudad Azulona, Islas Espuma and Ruta 24. Every Pokémon Center nurse refills it. The group allows it ([The Group's Rules → Healing and the League](#healing-and-the-league)). _Read from the game's code and data, not yet seen in game._
- **Every Pokémon Center has a candy cup** ("Taza"): examined, it adds 100 Rare Candies to the bag, as often as wanted, with no message. There are 18: in the Pokémon Centers of Ciudad Verde (the first on the way), Ciudad Plateada, Ruta 3, Ciudad Celeste, Ciudad Carmín, Ruta 10 Norte, Pueblo Lavanda, Ciudad Azulona, Ciudad Azafrán, Ciudad Fucsia, Pueblo Marengo, Isla Canela, Ruta 25 Sur, Villa Ámbar, Villa Azabache and Villa Magenta, in the Pokémon League lobby, and in the Battle Tower ("Torre Batalla") in Ciudad Carmín. They are real Rare Candies, not random items. _Seen in game at the Ciudad Verde and League lobby cups; the other places are read from the game's data._

## The Pokémon League

The Elite Four and the Champion in Ciudad Añil. The evidence is in source: [League, Pokévial and Candy Cups → The Pokémon League](../../../games/anil/reference/league.md#the-pokémon-league).

- **No items in League battles.** Every Elite Four and Champion battle blocks the bag: choosing "Mochila" (Bag) shows "No se pueden usar objetos en este combate." ("Items can't be used in this battle."). _Seen in game against Lorelei; the other four battles are read from the game's data._
- **No way back once in.** The gatekeeper's door leads into the Elite Four, and nothing there leads back to the lobby before the end; losing a battle whites out as anywhere else. The gatekeeper says healing items will be taken, but the game takes nothing.
- **The party is healed after every win,** before the next battle, by each room's attendant; the permafainted stay fainted. The lobby has its own nurse before the first battle.
- **The lobby's item mart sells only balls and repels under the Randomlocke:** its Potions, status heals, Full Restore and Revive are refused by the healing-items ban ([Nuzlocke](#nuzlocke)).
- **The Elite Four and the Champion are at levels 68–75,** Azul (the Champion) up to 75, the 8th-badge cap; the species are random. The rematches after the game is beaten are at level 100.

Apart from the bag in Lorelei's battle, these League facts are read from the game's data, not yet seen in game.

## Locked Options

Set at new game and out of the player's hands (source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod)).

- **Battle style is Set ("Fijo"):** no free switch after knocking out a trainer's Pokémon. It is gone from Options, and nothing in the game switches it to "Cambio" (Switch).
- **Visible wild Pokémon in the overworld are off,** and the option is gone from Options, so nobody picks encounters by sight.
- **Difficulty is "Completo" (complete),** chosen for its normal encounter tables and no bag block; what each mode does is **configured, not yet seen in game**.
- **No other modes:** Monotype, VGC, "Inverso" (inverse) and "Sin Grindeo" (no grinding) stay off, because the menu that sets them never appears.
- **Every other option** (battle scene, nickname prompts, run style, EXP Share, speed-up and the rest) keeps Añil's default and stays the player's choice.

## Not Yet Seen in Game

Configured or read from the game's code, but not yet observed in the running game:

- **The players package beyond its options.** Every rule above was verified on the tooling's copy, whose mod files are byte-identical to the players package; the owner checked by hand that a new game from the players package applies the visible options, without playing further (source: [Runtime → Packages](../../../games/anil/reference/runtime.md#packages)).
- **Types and evolutions not randomized,** and **no shared seed** ([Randomizer](#randomizer)).
- **Egg and tutor moves are not randomized** (source: [Randomizer → Read from Code](../../../games/anil/reference/randomizer.md#read-from-code)).
- **Parts of the battle rules:** paralysis's 25% chance of not moving, how many turns sleep lasts, and a non-Fire thawing move thawing its target ([Battles Use Modern Rules](#battles-use-modern-rules)). The settings, chances and damage behind the rest were seen in a live battle; full turns were played only for freeze.
- **Parts of the shiny facts:** how the Shiny Charm, the Shiny Potion and the four shiny gifts are obtained, and when the Battle Tower and the islands can be reached, are read from the game's data; the number-battled bonus is read from code; the catch chain was seen by calling its end-of-battle handler, not by fighting battles ([Shinies](#shinies)).
- **Parts of the IV and EV facts:** buying Mochis, berries and power items, the punch-bag training, battle EVs at the level cap, Pokérus and the Macho Brace in battle, and breeding are read from the game's code and data, and when the Dojo Magenta, Pueblo Marengo and the Dojo Azafrán can be reached is not checked ([IVs and EVs](#ivs-and-evs)). The item effects were seen by using each item through the game's own code, not from the bag screen.
- **What the difficulty modes change.** Completo is set, but what it and the other modes do beyond the switch they set was not checked (source: [Randomlocke Design → Package Behaviour](../../../games/anil/explanation/randomlocke-design.md#package-behaviour)).
- **The Showdown export inside Showdown.** The copied text was checked against Showdown's documented team format and names, not pasted into Showdown's teambuilder (source: [Runtime → Randomlocke Mod](../../../games/anil/reference/runtime.md#randomlocke-mod)).
- **Parts of the healing, candy and League facts:** the Pokévial, the candy cups other than Ciudad Verde's and the League lobby's, and everything about the League but the blocked bag in Lorelei's battle are read from the game's code and data ([Healing and Rare Candies](#healing-and-rare-candies); [The Pokémon League](#the-pokémon-league)).
- **Reaching the Hall of Fame and the credits in play.** The entry and the credits event were seen run by the tooling, the entry by script and the credits by moving the player onto their map, not reached by beating the champion (source: [Nuzlocke](../../../games/anil/reference/nuzlocke.md)).

## The Group's Rules

The group's competition rules: the group's own text, with the owner's additions, set 2026-10-02 ([Competition Format → Decisions](../explanation/competition-format.md#decisions)). The game enforces none of them except the eggs and the Showdown export, which the mod provides; every other rule is honoured by the players. Why the competition is shaped this way is in [Competition Format](../explanation/competition-format.md).

The group's text, verbatim but for its last sentence:

> Cada semana, un combate entre nosotros, aka, jornada de liga. Cada viernes se anuncian los emparejamientos, los primeros 5 se aseguran ser diferentes, los ultimos 3 son totalmente random. Cada combate equipo de 6 pokemons (si no tienes 6 te jodes) a bo3. El ganador, obtiene un huevo (captura extra). Full flexibilidad en los combates, no hay fecha limite. Despues de cada gimnasio generas el pokepaste que usaras para el combate. La decision de los brackets del torneo seran en base a los puntos de la liga, primero contra ultimo, segundo contra penultimo etc...

Its last sentence, an optional weekly fight against an AI for an egg or the next route, is not part of series 1 and is left out ([Competition Format → Decisions](../explanation/competition-format.md#decisions)).

### Fair Play

- **No exploiting.** Saving is normal, but nobody reloads a save or restarts the game to change something that already happened: a death, a lost battle, an encounter, an item, an egg's hatch. What happens, stays. _(owner, 2026-10-02)_ The one exception is in the postgame ([The Postgame](#the-postgame)).
- **No bugs or glitches** that give an advantage (duplicating items, skipping a battle, dodging a rule and the like). When in doubt, don't ("Ante la duda, no lo hagas"). _(owner, 2026-10-02)_
- **Guides are allowed.** Anyone may look up guides to Añil's mechanics and items. _(owner, 2026-10-04)_

### The League

- **Five league rounds, after gyms 1, 2, 3, 5 and 7,** among the 6 players. Gyms 4, 6 and 8 open no round. _(owner, 2026-10-22; replaces one round per gym, 8 in all)_ Pairings are announced on Fridays, and in every round each player meets an opponent they have not fought yet, so the 5 rounds cover every opponent once.
- **Every match is a Bo3 on Pokémon Showdown,** "[Gen 9] Custom Game", with Species Clause, Sleep Clause, OHKO Clause and Evasion Moves Clause, and team preview on. Custom Game accepts the export's Level 50 Gen 1–5 teams.
- **The two players may agree to change their match's rules.** The format and clauses above are the default; a pair may play their league match under other rules only if both agree. _(owner, 2026-10-22)_
- **Before a match each player knows the other's box sheet, not their team:** every species they own, each one's possible abilities (base and hidden, not which one it has), their item bag and their TMs. Moves, the chosen ability and which 6 they bring are seen only in battle and at team preview. _(owner, 2026-10-17)_
- **Each clause means what Smogon's clause of that name means,** and nothing more: Evasion Moves Clause bans only evasion-raising moves such as Double Team and Minimize, so evasion items like Bright Powder and Lax Incense stay legal, as no Evasion Items Clause is set. _(owner, 2026-10-17)_
- **The team is the player's frozen pokepaste for that gym:** up to 6 living Pokémon. A player with fewer alive, early on or after losses, brings what they have.
- **No deadline.** A match is played whenever the two players agree, always with the pokepastes frozen at its gym, so a player may be several gyms ahead in the story.
- **No gym cap.** The story has no weekly limit on gyms; the frozen pokepastes keep the rounds fair.
- **Points:** a Bo3 win gives 1 point, a loss 0, and each combat won in the player's best Pokémon League try gives 1 more ([The Pokémon League](#the-pokémon-league-1)). _(owner, 2026-10-22; replaces Bo3 wins only)_
- **Ties:** on equal points, the player who beat the other in their league match ranks higher. With three or more tied, the most wins in the matches among them ranks higher; if they are still level, as in a loop where each beat one other, a random draw decides. Fainted Pokémon and games won never break a league tie. _(owner, 2026-10-27; replaces game difference and Pokémon difference after head-to-head, 2026-10-22, and fewer Pokémon fainted first)_

### Pokepastes

- **A pokepaste is the pause menu's Showdown export** ([The Package](#the-package)): Level 50, the real IVs, 1 EV in every stat, nicknames. Posting it to pokepast.es is optional, a way to keep the pastes easy to find. _(owner, 2026-10-02)_
- **Made right after beating each gym that opens a round** (1, 2, 3, 5 and 7), before catching anything new or levelling up. The player may rearrange the party at the PC first, then exports. That pokepaste is frozen for that gym's league match. _(owner, 2026-10-04: no levelling up)_
- **Only living Pokémon.** The export already leaves out permafainted Pokémon and eggs.

### Eggs

- **Every new game has 16 eggs,** put by the mod in the last PC box, "Huevos". A league match win opens one, and the Pokémon League opens up to 5 more ([The Pokémon League](#the-pokémon-league-1)), so at most 10 are ever opened. This is the group's "captura extra" (extra catch), not breeding. How the mod gives and hatches them is in source: [Nuzlocke → Eggs](../../../games/anil/reference/nuzlocke.md#eggs).
- **A win lets the player open one egg:** move it to the party and walk; it hatches after 100 steps. Eggs in the PC never hatch. Opening an egg is the player's word that they won; the mod does not count wins.
- **An egg may be opened later, or never.** What hatches is drawn at the moment it hatches: a random Gen 1–5 Pokémon at level 1, from the randomizer's window for the player's badge count at that moment, shiny at the normal gift odds.
- **An egg never uses a route's encounter,** received or hatched.
- **No reloading to change what an egg hatches into.** The mod does not prevent it; the rule does.
- **An egg that hatches a legendary or a mythical falls under the legendary rule** and must not be used, like any legendary. Eggs can hatch mythicals (Meloetta hatched in a check). _(owner, 2026-10-02)_

### Rules in Every Battle

These apply to every battle, in the story (wild Pokémon, trainers, gyms, the League) and on Showdown.

- **Clauses:** Species Clause (on Showdown teams), Sleep Clause (no putting more than one of the opponent's Pokémon to sleep at a time), OHKO Clause and Evasion Moves Clause.
- **No Item Clause.** The same item may be held by several Pokémon, as long as the one-of-each-shop-item rule below holds; the guide's advice when in doubt is not to buy it ("Ante las dudas, no lo compres"). _(owner, 2026-10-02)_
- **At most one of each competitive item bought in a shop.** A held battle item bought from a Poké Mart — the type Gems, Focus Sash ("Banda Aguante"), Scope Lens ("Periscopio"), Wide Lens ("Lupa"), Zoom Lens ("Telescopio"), White Herb ("Hierba Blanca"), Power Herb ("Hierba Única"), King's Rock ("Roca del Rey"), Bright Powder ("Polvo Brillo"), Eject Button ("Botón Escape"), Red Card ("Tarjeta Roja"), the incenses and any other — is bought once at most per item. The game sets no limit: its marts sell any number the player can afford. Held battle berries (type-resist, pinch and the like) count too, and so does any shop, the Battle Point shops included. Items found or received are not limited by this rule. _(owner, 2026-10-02; berries and every shop 2026-10-04)_
- **No breeding.** No Pokémon is left at the Day Care to get eggs. _(owner, 2026-10-02)_
- **No changing EVs or IVs by any means.** EVs come only from normal battles, and IVs stay as each Pokémon has them. No item that raises, lowers or resets EVs or IVs (vitamins, Mochis, feathers, EV-reducing berries, "Chapas" (bottle-cap-style IV items), and the like), and no item or training that changes the EVs a battle gives (power items, the Macho Brace, the punch-bag training). Nature mints are allowed, since they change neither, and so is Pokérus: a Pokémon that catches it is used as normal, although the game doubles its battle EVs from then on. See source: [IVs and EVs](../../../games/anil/reference/ivs-evs.md). _(owner, 2026-10-02; mints and Pokérus 2026-10-04)_
- **At most 6 shinies,** from any source. If a seventh appears, it is not caught ("Si te sale el séptimo, no lo captures"). The rule no longer says "at a time" and no longer offers releasing one to make room. _(owner, 2026-10-02)_
- **A player who owns a living shiny always has one in the party,** so every pokepaste includes one; if it dies, another living shiny from the PC takes its place. _(owner, 2026-10-02)_ The rule is held strictly, and players should try to keep their shinies alive. _(owner, 2026-10-22)_
- **Legendaries and mythicals (such as Mew or Meloetta) may be caught but never used:** not in the party, not in any pokepaste. The legendary clause still keeps the map's encounter. _(owner, 2026-10-02: mythicals count as legendaries)_ A shiny legendary or mythical is never used either: it stays in the PC and does not count as the living shiny the party must hold. It is still a shiny, so it counts toward the 6. _(owner, 2026-10-03)_

### The Pokémon League

The Elite Four ("Alto Mando") and the rival at the end of the story ([The Pokémon League](#the-pokémon-league) has the game's side).

- **The League may be reattempted as often as the player likes.** A Pokémon that dies in the League stays dead for every later attempt. _(owner, 2026-10-22)_
- **Pokémon that died in the League come back for the final tournament,** whether the player beat the League or not: they count as alive in the export the tournament uses. They are never used in the League again. _(owner, 2026-10-22)_
- **The best try counts.** A try is the League's five combats: the four Elite Four members, then the rival. The try with the most combats won, the earlier one on a tie, gives 1 league point and opens 1 egg for each combat it won, so at most 5 of each. _(owner, 2026-10-22; replaces one egg per Elite Four member and two for the rival)_

### The Postgame

- **The islands are closed.** The postgame islands are not played. _(owner, 2026-10-22)_
- **Items can still be collected on the mainland,** with the [Añil Item Atlas](https://claude.ai/artifact/CPXJZAcijQzn9JnJ8qxXz8) (the "Añil map") or without it: every item left on the maps up to the Pokémon League, under the usual rules and with no extra limit. The islands stay closed for items too: Villa Ámbar, Villa Azabache, Villa Magenta and the routes, caves and forests around them. _(owner, 2026-10-22)_
- **The legendary sidequest may be played until it turns to Sinnoh's legendaries.** Its Pokémon are rolled by the randomizer, so each may or may not be a legendary; the player fights each, and once it is beaten the game lets them catch it. Catching stops when the guide of the sidequest says it is time for Sinnoh's legendaries, after Deoxys. A legendary caught there falls under the legendary rule: caught, never used, and a shiny one still counts toward the 6 shinies. _(owner, 2026-10-22)_
- **Saving and quitting to save a Pokémon is allowed in the postgame,** an exception to [Fair Play](#fair-play): a player may quit without saving and reload so that a Pokémon does not die. _(owner, 2026-10-22)_

### Healing and the League

- **The Pokévial is allowed** ([Healing and Rare Candies](#healing-and-rare-candies)). _(owner, 2026-10-02)_
- **No healing items on the visit that starts the challenge.** The game chooses its mart bans when the buy list opens, so on the visit whose Poké Balls start the challenge it would still sell healing items, bought before or after the balls in that list (source: [Nuzlocke](../../../games/anil/reference/nuzlocke.md)). The group's rule closes that gap: those healing items are not bought, and the Poké Balls are bought alone. _(owner, 2026-10-06)_
- **The healing-items ban has no League exception:** the group does not lift the package's mart ban for the lobby's item mart, whose healing items the game keeps refusing. _(owner, 2026-10-02)_

### Final Tournament

- **Who:** the players who finished the story and did not lose the challenge. _(owner, 2026-10-02)_ Beating the League is not required: a player who never beats it still plays. _(owner, 2026-10-22)_
- **Open sheet.** Each player exports their whole PC with the [Open Sheet export](../../../site/explanation/save-export.md) (every living Pokémon with its moves, stats, items and TMs) when they decide they are done playing, and that export is their sheet for the whole tournament. Before a match each player knows the other's full sheet, and each builds a team from their own. No bans. _(owner, 2026-10-22; replaces a pokepaste made right after beating the League)_
- **Any move of the learnset.** A Pokémon on a tournament team may use any move of its rolled learnset, whatever level the learnset teaches it at, besides the moves it knows and the bag TMs it can learn. The sheet lists them all. _(owner, 2026-10-28)_
- **First round, seeded by league points:** first against last (1–6), second against fifth (2–5), third against fourth (3–4). First and second are placed in opposite halves of the bracket, so they can only meet in the final. Bo3, in the league's format and clauses. _(owner, 2026-10-22)_
- **The losers' triangular.** The 3 first-round losers play a triangular ("formato triangular") among themselves, and its winner returns to the winners' bracket. _(owner, 2026-10-22)_ Each pair plays once, a Bo3 in the league's format and clauses, and the player who wins both of their matches goes through. On equal wins, as in a 1–1–1 loop, the triangular's own tie-breaks decide among its matches, not the league's: head-to-head, then the better game difference (Bo3 games won minus lost), then the better Pokémon difference (the opponents' Pokémon fainted minus their own); if still level, the higher league seed goes through. _(owner, 2026-10-22, replacing fewer Pokémon fainted, then a random draw; kept apart from the league's tie-breaks 2026-10-27)_
- **Semifinals and final.** The triangular's winner meets the winner of the lower half's first-round match (2–5); the upper half's two winners (1–6 and 3–4) meet each other; the two semifinal winners play the final. _(owner, 2026-10-22)_

### Losing the Challenge

- **A player who loses the challenge ("¡Has perdido el desafío!") is out** of the league and the tournament. Their remaining league matches count as losses, so each opponent gets the point. The Pokémon the game revives after the loss never count.
