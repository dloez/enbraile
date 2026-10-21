# Knowledge View Design

How the harness draws the story run's combat line in one place: the tags every fact carries, the story policy that filters by them, the battle filtered down to what a player sees, and opponents' reveals recorded by the bridge and remembered in the save. The policy itself is Wonder's Knowledge Policy (Wonder: `docs/general/explanation/knowledge-policy.md`); this doc owns the view as built. Scoped with the owner on 2026-10-03 and built in this order: the reveal hooks and save variable, the view over the static and rolled data, then the live state and battle through the view. The code is `anil.harness.knowledge`, with the reveal memory read by `anil.harness.state` and the hooks in the bridge's `anil_events.rb` ([Runtime Design → Project Layout](runtime-design.md#project-layout)). It is copied from Wonder's knowledge view design (`docs/subsystems/harness/explanation/knowledge-view-design.md` in Wonder), where it was built and checked against the game, without Wonder's agent, tool API and control panel. Sessions named as evidence ran under Wonder's harness, whose commands, files and bridge module read `wonder` where `anil`'s read `anil` ([Runtime Reference](../reference/runtime.md)). Its one reader here is the damage calc that `anil battle` prints ([Damage Calc Design → The Knowledge View](damage-calc-design.md#the-knowledge-view)).

It builds on [Game Database Design](game-database-design.md) (the tags, the static lookups and the live reads of the run's rolled data) and [Runtime Design → Events](runtime-design.md#events) (the event ring the hooks extend). Game facts cited here are owned by [Runtime → Events](../reference/runtime.md#events) (the hooks as verified and the `reveal` wire format), [State → Reveals](../reference/state.md#reveals) (the save variable's layout) and [State → Battle](../reference/state.md#battle) (what the screen shows of a battler), where each names how it was verified. The view needs only Python in WSL and Ruby in the game for the hooks: no Windows-side pieces, no secrets or config, and no models.

## What the View Does

A `KnowledgeView(policy, connection)` takes a policy and the game database's connection and answers typed queries that mirror the harness:

- **The static data:** species, move, ability, item, type, status, trainer type, trainer, matchup and locations from `anil.harness.gamedb`.
- **The run's rolled data:** `random(session)` reads the running game through `anil.harness.random` (the ability table, learnsets, TM compatibility and TM moves, the starters, the wild tables, the remembered trainer teams and the TM marts) and returns `KnownRandom`.
- **The live state:** `state(game_state)` is a pure function of one `anil.harness.state` read and returns `KnownState`; `battle(battle, reveals)` and `events(events)` view a battle and an event list on their own, and `reveals(reveals)` the reveal memory.
- **The verbs' results:** `go(result)`, `dialog(result)`, `menu(result)` and `battle_result(result)` view what `anil.harness.navigate`'s `go`, `anil.harness.dialog`'s verbs, `anil.harness.menu`'s and `anil.harness.storage`'s verbs and `anil.harness.battle`'s verbs return, and `changes(changes)` their state changes. In Wonder they served the tool API's action tools; nothing here reads them.

A withheld field is the explicit `hidden` marker, so "holds no item" differs from "item not known". A wholly withheld record (an unowned species' rolled learnset) reads as hidden, not missing, and a fact the game has not rolled yet stays `None`, as `anil.harness.random` reads it. The view is a pure function of what it reads and holds nothing of its own.

## Scope Edges

Out: model-facing tool definitions and prompt text, which were Wonder's agent's and stay in Wonder; a PvP policy, whose source (the Showdown protocol) is deferred; run memory beyond battle reveals; the rules engine, damage and threat calculation, plan validation and the battle subsystem. Harness code (navigation, dialog, the menu layer, the checks) keeps its full access; only model-facing paths went through the view in Wonder, and here only the calc's inputs do.

The view never makes the game roll anything (Knowledge Policy → Story Run (Wonder: `docs/general/explanation/knowledge-policy.md` → Story Run)): it reads what `anil.harness.random` reads. The reveal hooks only record, and never call the RNG or a getter that rolls or memoizes, so replays and digests are unchanged.

## Tags and Policy

Every fact carries one of six tags (the `Tag` type in `anil.harness.gamedb`): the game database's five, with `own` and `world` widened to the live state, and `revealed`.

- `world`: the static data, as the game database tags it, and also the map, switches, variables, self-switches and the interpreter command.
- `own`: the rolled data of a species the Pokédex marks owned, and also our own side's live state: party, bag, PC boxes, the Pokévial, trainer, money, badges, position, the maps whose first encounter is used and the maps visited, and our battlers.
- `opponent_species`: a rolled team's or wild table's species, and an opposing battler's species and form as the screen shows them.
- `revealed`: an opposing battler's on-screen facts while it is on the field, its remembered reveals, the weather and terrain, the opposing Pokémon left, and battle text and `reveal` events.
- `opponent_hidden`: everything else about an opponent, and `debug_log` events.
- `unowned_random`: the rolled data of a species never owned.

A policy is data, a `frozenset` of the tags it allows. `STORY` allows `world`, `own`, `opponent_species` and `revealed`. Only the story policy is built; PvP adds its own when its source exists. Battle text is public, so it passes as `revealed`, and the facts it names are exactly the reveals the memory records; `PBDebug.log` lines are omniscient ([Runtime Design → Events](runtime-design.md#events)) and stay `opponent_hidden`.

## Battle Reveals

What counts as revealed and for how long is the policy's (Knowledge Policy → Story Run (Wonder: `docs/general/explanation/knowledge-policy.md` → Story Run)); here is how it is caught and kept.

### The Hooks

The bridge hooks the game's own reveal points in `anil_events.rb`, beside the battle text hooks, and writes structured `reveal` events (battler index, side, trainer, slot, fact and `via`) to the event ring and the session record ([Runtime → Events](../reference/runtime.md#events) for the wire format and how each hook was verified). Every reveal hook it installs, with the battle text hooks the text match reads:

| Hook | What it catches |
|------|-----------------|
| `Battle#pbDisplay`, `#pbDisplayPaused`, `#pbDisplayBrief` | The battle text, matched for items and abilities that are shown only in text (Frisk, Knock Off, Thief, Leftovers' line, a berry's line); and the side and field effects that started or ended since the last line ([Shown Effects](#shown-effects)) |
| `Battle#pbAttackPhase` | Takes the effects' baseline again as a round's moves begin, so a change made in the command phase is not shown until the effect starts or ends again ([Shown Effects](#shown-effects)) |
| `pbLoadTrainer` | Stamps the PBS key it was called with on the trainer it returns, as `@anil_trainer_id` |
| `Battle#pbStartBattle` | Sets up the per-battle state at the battle's start (the opposing starting items an item's `own` is judged by) and clears it at the start and end (the wild reveals, the held items, the Illusion lists) |
| `Battle#pbShowAbilitySplash`, `Battle#pbReplaceAbilitySplash` | An ability its splash shows |
| `Battle#pbSendOut` | A `send_out` event per opposing Pokémon sent out, with the species its databox shows |
| `Battle::Move#pbDisplayUseMessage` | A move as its use is announced; every override reaches the base method through `super` when the name is shown |
| `Battle::Battler#pbUseMove` | The window in which the two lines that name a move outside `pbDisplayUseMessage` are matched as text for that battler |
| `Battle::Battler#pbHeldItemTriggered`, `Battle::Battler#pbConsumeItem` | An item triggered or consumed |
| `Battle::Battler#pbRemoveItem` | The item the battler was shown holding is gone (eaten, used up), for the held item |
| `Battle::Move::UserTargetSwapItems#pbEffectAgainstTarget` | Trick and Switcheroo: keeps, while the swap runs, each opposing battler's item and name with our battler, so the line that names only our battler (`{1} obtuvo {2}.`) is read as a reveal of the opposing one |
| `AnilBridge.reveal_refusal` (not a hook: an eval the battle layer runs) | A battle verb's refusal from the game's own switch, run or item check, its line matched as battle text, so a trapping foe's ability or item is recorded as trying the action would have shown it ([Battle Layer Design → Build Choices](battle-layer-design.md#build-choices)) |
| `Battle::AbilityEffects.triggerOnBeingHit`, `Battle::Battler#pbOnLosingAbility`, `Battle::AbilityEffects.triggerOnSwitchIn` | The three methods that clear `@effects[PBEffects::Illusion]`: the hit, Gastro Acid and the like, and Neutralizing Gas. `triggerOnBeingHit` is also called at Mega Evolution for a battler with Illusion (`157_Battle_ActionOther.rb:141-143`), so a break there is caught too |

The scope named four reveal points first: the ability splash (`pbShowAbilitySplash`), the move announcement (`pbDisplayUseMessage`), the item trigger and consumption (`pbHeldItemTriggered`, `pbConsumeItem`) and the send-out (`pbSendOut`); the rest were added as the build showed the gaps they cover. The bridge's other event hook, on `PBDebug.log`, records no reveal ([Runtime Design → Events](runtime-design.md#events)).

### What Is Recorded

- Only the opposing side (odd battler indices) is recorded; our side never is.
- A `reveal` event is sent only when its fact is new to the store, so a fact seen by a hook and by the text, or seen again in a refight, gives one event. The stored fact is `kind`, `id` and `own`; the event adds `via`.
- `own` keeps the raw fact honest without interpreting it in Ruby: a move counts as its own only when it is one of the battler's move slots (by identity) and it is not transformed, an ability only when it is the Pokémon's `ability_id`, an item only when it is the one held at the battle's start. Called moves, Struggle and a transformed Pokémon's moves are still recorded, as the screen showed them.
- Text reveals match a battle text that names the opposing battler as the text does (`El X rival`, `el X salvaje`) and the name of an item it has held this battle (its starting item, and any it was seen holding at an earlier text) or of its current or own ability. Items held earlier count because Knock Off and Incinerate remove the item before their line names it. A text that names the opposing battler and an item of ours with the same name (its own Leftovers when it knocks off ours) is a false match, accepted as rare.
- The trainer id is the PBS key `pbLoadTrainer` was called with, since a rival's name can replace the key's name on the trainer; a trainer not loaded that way falls back to its type, name and version.
- A send-out's species is not stored: databox facts are read live.

### The Memory

The memory is kept in the save, in `$PokemonGlobal@anil_reveals` ([State → Reveals](../reference/state.md#reveals)), so it is saved, loaded, snapshotted and restored with the game and can never disagree with it. Ruby records only raw facts; `anil.harness.state` alone reads them, with the state read and through `read_reveals`, and the view interprets them.

- `"trainers"`: per trainer id and party slot, kept for the rest of the run.
- `"wild"`: the running wild battle's reveals, emptied when a battle starts and when it ends.
- `"effects"`: per side and for the field, the side and field effects a battle line has shown in this battle, with the turn of the line that started each and the layers of Spikes and Toxic Spikes, emptied with `"wild"` ([Shown Effects](#shown-effects)).
- `"held"`: per opposing party index, the item the screen last showed the Pokémon holding in this battle, or none once it is gone, emptied with `"wild"`. An item reveal sets it to the item when the battler still holds it and to none when it does not (Knock Off's line comes after the removal); the `pbRemoveItem` wrapper sets none when the battler loses the item it was shown holding; a line naming an item it now holds (Trick, Thief, Symbiosis) sets that item; a Trick or Switcheroo line read through the swap wrapper leaves it on the item it received when that was already shown, and none otherwise, since the swap's lines come in either order. A change of the held item alone gives no `reveal` event.

### Shown Effects

Screens, Tailwind, Trick Room, hazards and the other timed side and field effects are announced in battle text, which is public, so the view shows them (Knowledge Policy → Decisions (Wonder: `docs/general/explanation/knowledge-policy.md` → Decisions), "Announced side and field effects are revealed"); an effect no line announced stays hidden. The bridge does not parse the lines: the game sets an effect and then shows its line, so when a line is about to be shown the `pbDisplay` wrappers compare a fixed list of effects with a baseline and record each that started or ended since ([Runtime → Events](../reference/runtime.md#events), "Shown side and field effects", for the list). The baseline is taken at the battle's start, again after each line returns and as each attack phase starts, so a change made while the battle waits (at the command menu or on a line awaiting a key, the only times the harness can eval) is absorbed without being shown, and an effect it set stays hidden until it ends.

- Our side is recorded too, so a foe's Stealth Rock shows on our side.
- A counter is recorded only as set, never by its value, since a value of 8 would show the setter's Light Clay; the view counts the turns since the start line instead. Spikes and Toxic Spikes keep their layers, each of which is announced.
- An effect that ends with no line of its own is dropped at the next line shown.

### Illusion

The screen shows an Illusion's disguised species and databox until it breaks, so a fact shown while disguised is filed under the slot of the Pokémon it appears as: the last Pokémon in the battler's party with the disguise's personal ID, the match the view makes. Each fact newly filed that way is also kept, outside the save, in a per-battle list for the true Pokémon.

The break is found by the three wrappers in the table, comparing each opposing battler's Illusion before and after. `pbOnLosingAbility` and `triggerOnSwitchIn` count only when the battler is not transformed, since only then does the game change the sprite and print a line. At the break each listed fact leaves the disguise's slot (an emptied slot is removed) and joins the true slot, with a `reveal` event whose `via` names the wrapped method when it is new there. The true slot also gets the ability `ILLUSION`, `own` when it is the Pokémon's `ability_id`, whether or not any fact was listed. The hit's line, `¡La ilusión de {1} desapareció!` from the Animated Pokémon plugin's `OnBeingHit` handler, which replaces the base script's, names no ability ([Runtime → Events](../reference/runtime.md#events)), so the break itself records it; Gastro Acid's line names the ability, so the text has already recorded it and the break adds no second event.

- A fact the disguise's own Pokémon then shows undisguised is dropped from the list, so a break never takes it away.
- A fact already under the disguise's slot when the disguised Pokémon shows it (from an earlier fight in which the Illusion never broke) is not listed, so a later break leaves it with the disguise: a refight does not reclaim it.
- The list is emptied when a battle starts and ends, so facts from a fight in which the Illusion never broke stay with the disguise. A snapshot is neither saved nor restored during a battle (`anil_snapshot.rb` `idle_problem`), so the list never outlives a restore.
- The held item is keyed by the shown Pokémon's index, so under an Illusion it belongs to the disguise. Only what the disguised Pokémon set moves at the break: the bridge keeps, for the battle, the entry each disguise had before the disguised Pokémon first set it (or that it had none), and at the break the disguised Pokémon's last entry goes to its own index and the disguise gets back what it had. An entry set by the Pokémon the disguise shows, while it is out itself, drops that record, so it stays where it is.

## The View's Models

A record whose fields all share one tag (species, move, ability, item, type, status, trainer type, matchup, location, ability table entry, learnset, TM compatibility, TM move, TM mart) passes as the harness's own record or is `hidden` whole. A record whose fields carry different tags becomes a view model with each field allowed or `hidden`: `KnownTrainer` (each PBS member `hidden` whole, as its one tag covers it), `KnownStarter`, `KnownWildSlot`, `KnownOpponent` and `KnownTeam`, gathered in `KnownRandom`. The Pokédex owned set is `own`. A starter's level follows its species' tag, `world`, since its level is the lab's fixed level, as a gift Pokémon's level is a `world` location fact.

The live state:

- `KnownState` passes our side (context, trainer, party, bag, Pokévial, boxes, position, transfer, the maps whose first encounter is used and the visited maps) as `own` and the interpreter command, switches, variables and self-switches as `world`. A battle payload's `battler` object is replaced by its index, since its dump reaches into the battle's own variables.
- `KnownBattle` passes the kind, trainers, their ids, the turn, the decision, and the battle's rules `balls` (false when `disablePokeBalls` is set) and `can_run` (the battle's `canRun`); weather and terrain as `revealed` and their durations, the opposing side's raw effects and the raw field effects as `opponent_hidden`; `shown_effects`, the effects the battle text has shown on either side and the field (`KnownEffect`: side, effect, `since_turn`, the turn of its start line, `turns`, the turns ended since, and `layers` for Spikes and Toxic Spikes), as `revealed`; our battlers (with their battler effects by name, [State → Battle](../reference/state.md#battle), among them `moves_used`, the moves each has used since it came in, which no foe's view carries), our party and our side's effects as `own`; and `remaining`, the opposing party's able Pokémon, as `revealed`.
- `KnownFoe`, an opposing battler on the field: its species and form as the screen shows them are `opponent_species`; the shown name, level, gender, shiny mark, status, fainted flag, databox types, Transform species, HP as the per cent the databox prints, and stat stages are `revealed`; its stats and effects `opponent_hidden`. Its moves are its remembered own moves padded to four with `hidden`, its ability its remembered own one or `hidden`, and `shown` lists every remembered fact with its `own` flag. Its item is two fields: `remembered_item`, its remembered own item or `hidden`, what a refight starts from; and `held_item`, what the screen has shown it holding in this battle (`hidden` until a line shows an item, that item once one does, none once a line shows it eaten, used up, knocked off or stolen, until a line shows it gain another).
- While an Illusion holds, the battler's remembered facts, trainer and slot are those of the Pokémon it appears as, found by the disguise's personal ID in the opposing party (the last match). A `send_out` event passes without its `illusion` flag, trainer and slot, which would name the disguised Pokémon's true place before the screen does. A fact shown while disguised is already filed under the disguise's slot by the hooks, so the view needs no screening of it.
- The opposing party (`KnownMember`) is each Pokémon's species (`opponent_species`) and its remembered facts (`revealed`); a benched Pokémon not yet seen shows its species alone.
- The databox types come from the Type Icons plugin's own method on each databox sprite; a read error on one of those paths (no such sprite, a battler without a Pokémon) leaves that battler's types unread rather than failing the state read.
- The verbs' results (`KnownGo`, `KnownDialog`, `KnownMenu`, and `KnownBattleResult` below) pass the outcome, reason, ticks, target and counts; the context screened as `KnownState` screens it, the position and a menu result's transcript and pending decision as `own`, a dialog's transcript and pending decision as `world`, the text the screen showed; their events through `events`. `KnownChanges` passes the items, money, Pokévial, party, boxes and position changed as `own` and the switches, variables and self-switches as `world`. The route `go` planned and the call stack's frames are not passed: they are the harness's own working, not anything the game shows.
- `KnownBattleResult`, a battle verb's result, passes the outcome, reason, ticks and the battle's outcome; the context screened, the pending decision as `own` and the transcript, the battle text the screen showed, as `revealed`; `KnownChanges` and the events as above. Its `battle_changes` (`KnownBattleChanges`) is the view's own diff of the battle at the call's two ends: the turn, the weather and terrain as `revealed`, and each battler added, removed or changed (`KnownBattlerChange`: index, side, species), our battlers' fields as the battle layer's diff gives them, `own`, and a foe's as the screen shows them, `revealed`: its species as shown, its HP as the per cent the databox prints, its status, fainted flag and non-zero stages, without its party index, which under an Illusion would name the disguised Pokémon.
- Events the policy withholds are dropped rather than marked `hidden`, since how many `debug_log` lines a turn produced is itself a trace of hidden facts.

## Commands

The view has no command of its own. `anil battle` builds a story-policy `KnowledgeView` over the game database of the build `--build` names and prints the damage calc it feeds ([Damage Calc Design → Battle Annotations](damage-calc-design.md#battle-annotations)). Wonder's `wonder know` commands, which printed the view and the memory through the story policy, do not come over.

## Observability

`reveal` events land in `record.jsonl` beside the battle text, and replay skips them as it skips other events. `anil state` prints the newest events after the state, `reveal` among them ([Runtime → Events](../reference/runtime.md#events)). Each piece was verified against trainer and wild battles in Wonder ([Runtime → Events](../reference/runtime.md#events)).

## Re-running and Rollback

The reveal memory rewinds with the save and snapshots. Reverting means removing the hooks; a save that already carries the variable still loads, since Marshal keeps any instance variable. A mod-only install has no bridge, so it neither records nor carries reveals; only `anil install --harness` deploys the hooks. A redeploy of the hooks changes the bridge hash.

## Decisions

### Scope and Interfaces

- **An `anil.harness.knowledge` module that applies the story policy by tag to the game database, the rolled data and the live state,** with battles filtered down to what a player sees and opponents' reveals recorded and remembered; `wonder know` shows what a model would see. A thin tag filter, which would leave the live state and battle untagged, and model-facing tools, whose consumers were not designed yet, were rejected. _(owner, settled 2026-10-03)_
- **Battle reveals are built with the view,** moving them out of the deferred run memory, which [Game Database Design](game-database-design.md#decisions) had made their owner. Without reveals the view could only hide everything in battle or leak everything. _(owner, settled 2026-10-03)_
- **Reveals are caught by bridge hooks at the game's own reveal points,** and text-only reveals by matching the opposing battler's true item or ability name in the battle text. Parsing all of the Spanish battle text, fragile and ambiguous when the same species is on both sides, and diffing live battle state, which misses ability and item triggers and depends on poll timing, were rejected. _(owner, settled 2026-10-03)_
- **The memory is kept in the save,** keyed by trainer id (joined as the game database joins it) and party slot, with wild reveals for the battle only. A data-root file, which would have to be rewound by hand on every restore or save reload, was rejected; per-save data belongs to the save, as in the game database. _(owner, settled 2026-10-03)_
- **Six tags, with `revealed` new,** over stretching `opponent_species` to cover reveals; `own` and `world` widened to the live state. _(owner, settled 2026-10-03)_
- **A policy is the set of tags it allows,** and only the story policy is built. It puts the combat line in one place, as Knowledge Policy → Decisions (Wonder: `docs/general/explanation/knowledge-policy.md` → Decisions) asks. _(owner, settled 2026-10-03)_
- **Withheld fields are an explicit `hidden` marker,** over dropping them, which leaves a model unable to tell "none" from "unknown". _(owner, settled 2026-10-03)_
- **`wonder know` mirrors `wonder db`, `wonder db random` and `wonder state` through the story policy,** with `wonder know reveals` for the memory: the way to spot a leak while no model consumes the view. _(owner, settled 2026-10-03)_
- **A foe's item is two fields,** `remembered_item` and `held_item`, over one field that keeps the remembered item after the screen shows it gone, and over one that reads none for the rest of the battle and leaves the remembered item to `shown`. _(owner, settled 2026-10-03)_

### Build Choices

- **The hooks live in `anil_events.rb`,** beside the battle text hooks, and record only the opposing side; an event is sent only when its fact is new to the store, and the stored fact carries `own`, never how it was seen. _(build choice, 2026-10-03)_
- **The reveal memory is read by `anil.harness.state` alone,** with the state read and through `read_reveals`; the scope had planned `anil.harness.random` to read it too, which nothing needed. _(build choice, 2026-10-03)_
- **The trainer id is the PBS key stamped by the `pbLoadTrainer` hook,** since a rival's name can replace the key's name on the trainer. _(build choice, 2026-10-03)_
- **`HIDDEN` is the one instance of `Hidden`, a view field is `Known[T]`, `T | Hidden`, and a policy is a `frozenset` of tags;** `KnowledgeView` takes the game database's connection beside the policy. _(build choice, 2026-10-03)_
- **A record of one tag passes whole or `hidden`; a record of mixed tags becomes a view model,** and a starter's level follows its species' `world` tag. _(build choice, 2026-10-03)_
- **The live view is a pure function of one state read,** which also reads the reveal memory, each battler's on-screen fields and the opposing trainers' ids; withheld events are dropped, not marked. _(build choice, 2026-10-03)_
- **Side and field effects are shown by comparing them with a baseline as each battle line is shown,** not by matching their Spanish lines: each effect has several start and end lines (the move, Court Change, Defog, Brick Break, the end of round), while the game always sets an effect before showing its line. The memory keeps the turn of the start line rather than the counter, which would show Light Clay. _(build choice, 2026-10-04)_
- **The Trick and Switcheroo line is read through a wrapper on `UserTargetSwapItems#pbEffectAgainstTarget`** (forced by evidence): session `20261003-154656` recorded nothing from `Chispa obtuvo Baya Aranja.`, whether the foe tricked Chispa or Chispa tricked it, since the line names only our battler. _(forced by evidence, 2026-10-03)_
- **The maps whose first encounter is used and the visited maps pass as `own`** (`challenge_encs`, `visited`, forced): Wonder's run memory's catch and travel checks need them, and they are non-combat facts of our own run, which the story policy allows (Knowledge Policy → Decisions (Wonder: `docs/general/explanation/knowledge-policy.md` → Decisions), Run Memory Design → Scope and Interfaces (Wonder: `docs/subsystems/harness/explanation/run-memory-design.md` → Scope and Interfaces)). _(2026-10-04)_
- **The battle's ball and run rules pass untagged, as `balls` and `can_run`,** like the battle's kind: a player learns either by trying, from the line the game shows ("¡No puedes lanzar una Poké Ball!", "¡No puedes escapar!") with no turn or item spent ([Menus → Battle](../reference/menus.md#battle)), so showing them up front hides nothing a player cannot learn for free. Verified in session `20261009-125114`: the raid nest's 2v1 read both false, a plain wild battle (a rolled Pawniard) both true. _(build choice, 2026-10-09)_
