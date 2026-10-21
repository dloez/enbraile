# Dialog Design

How the harness presses C on an event and drives any dialog to its end, whether an event the caller started or one that interrupted a walk: messages, choices, number input, item pickups, healing, signs, NPCs, autorun cutscenes, step messages and trainer speech up to the battle. Scoped with the owner on 2026-10-01 and built the same day. The code is `anil.harness.dialog`, with its message, choice, number and wait steps and the transcript in `anil.harness.steps` and `StateChanges` in `anil.harness.changes`, both shared with the menu layer ([Menu Design](menu-design.md)), and the live `cursor`, `value` and `digit` payload fields in `anil_context.rb`. It is copied from Wonder's dialog design (Wonder: `docs/subsystems/harness/explanation/dialog-design.md`), where it was built and checked against the game, without Wonder's agent and control panel. Sessions named as evidence ran under Wonder's harness, whose commands, files and bridge module read `wonder` where `anil`'s read `anil` ([Runtime Reference](../reference/runtime.md)).

It builds on [Runtime Design](runtime-design.md) (context, payloads, lockstep, `note`) and [Navigation Design](navigation-design.md) (the ready-to-interact stop and `interrupted`). Game facts cited here are owned by [Runtime](../reference/runtime.md) and [State](../reference/state.md#event-interpreter), where each one names how it was verified. Script references are to Añil's `game/extracted/es-v4.14/scripts/` and `plugins/`. The layer needs only Python in WSL and the existing bridge: no Windows-side pieces, and no secrets or config.

## What the Layer Does

Two entry points share one driver loop:

- `interact(driver, event, answers)` checks the start state, presses C once on the event, then runs the loop.
- `continue_dialog(driver, answers)` runs the loop on a dialog already open or an event already running, never starting one: after an `interrupted` walk, and to resume after a `decision`. It is refused on the idle overworld and in any context that would end the call `handoff` (battle, menu, special, unknown).

An interruption or a resumed decision has no event to press C on, which is why the loop has its own entry point. Both return a `DialogResult`.

Judgment stays out of the harness: the caller passes ordered answers, each consumed by the next choice or number input. A choice answer must match a shown option word by word (as navigation compares prompts); a number answer must be an integer within the shown range. With no answer left, or one that does not fit, the call ends `decision` and leaves the choice open, so the call never guesses; the `decision`-then-resume shape lets the caller decide the answer and call again. Plain messages are advanced without answers.

Each call reads the live game and holds no state between calls; calling again continues from wherever the game is. Every press goes through `anil.harness.drive.Driver.advance`, so the record and replay cover it, and snapshots undo it in the game.

## Scope Edges

Out: battles, menu scripts (shop, PC, bag, party, pause menu), naming, evolution and move-learning screens. All end the call as `handoff` and are touched by nothing here. The naming, move-learning, evolution and level-up chains are then driven by `continue_menu`, and the mart's lists and the PC's storage box by `buy`, `sell` and `pc` ([Menu Design](menu-design.md)). Navigation is unchanged and never called from this layer: chaining a walk, an interruption and a press is the caller's job (the owner by hand, a later caller of the harness). The owner prefers separate primitives, easier to follow in the record and freer to recombine, and navigation keeps its rule that it never presses through anything it did not start.

## Results

`DialogResult` holds `outcome`, `reason` (one line), `started` and `tick`, `context` at the end, `transcript`, `decision` (only for `decision`), `unused` answers, `changes`, and the bridge `events` seen during the call. Outcomes:

- `finished`: back to idle overworld, interpreter stopped, nothing open.
- `no_effect`: `interact`'s C started nothing within `START_TICKS` (20) ticks, an empty or decorative page.
- `decision`: a choice or number is open with no fitting answer. `decision` holds `kind` (`choice` or `number`), the `prompt` (the message above it, if any), and `options` with `cursor`, or `minimum`, `maximum`, `value` and `digit`.
- `handoff`: a battle, menu, special or unknown context opened ([Handoff](#handoff)).
- `stuck`: no progress ([Wait Step and Stuck](#wait-step-and-stuck)); the result carries the stack (`frames`) beside its context.
- `refused`: the start state does not allow the call.

## Interact Start

`interact` presses C only when all hold, else `refused` with the failing check as reason: (1) idle on the overworld (context `overworld`, not moving, no interpreter running); (2) standing where navigation's event target stops, a facing tile (across a counter included) facing the event, or on the footprint of an over-trigger action event, reusing `anil.harness.navigate`'s rules; (3) the event's live page is action or event-touch. A player-touch page is refused as "starts by stepping onto it", an event with no active page as "no active page".

C on the overworld starts the action page in front or underfoot and the event-touch page in front, never a player-touch page (`037_Scene_Map.rb:220-221`); idle is required so C cannot advance another message or open the Surf message, which C on a water tile in front starts (`037_Scene_Map.rb:192`, `:224-227`, through `:on_player_interact`).

## Driver Loop

Each step reads the context and payloads and does one thing:

| Context | Step | Ends the call |
|---------|------|---------------|
| `message` | Record the line, then press C and release on alternate ticks until the message payload is gone or a new one (another entry tick) opens; the item-found popup, which has no payload, until its context changes | No |
| `choice` | Take the next answer; move the cursor to the matched option, confirm it landed, press C; record the answer | `decision` when no answer fits |
| `number` | Take the next answer; step `value` to it digit by digit (moving `digit`), confirm, press C; record the answer | `decision` when no answer fits |
| `event`, `transition` | Wait step: no input | No |
| `overworld`, interpreter stopped | — | `finished` |
| battle exists, `menu`, `special`, `unknown`, any battle context | — | `handoff` |

A message advances by C pressed and released on alternate ticks, since `trigger?` fires only on the first tick of a press: the first press completes scrolling text, the next closes the box. The payload wrapper is entered once per message, so it marks one box exactly; the stack signature can change too early or too late, because a following box re-enters the same loop.

The cursor is never counted from the start: the step presses up or down one at a time, reads the live `cursor` or `value` back, and presses C only once it is on the answer, ending `stuck` if it never lands. Counting presses would pick a wrong option silently if a menu wraps or skips, and a wrong answer can release a Pokémon or decline a gift. The payloads alone carry only the starting `default` and `initial`, because the window holding the live cursor is created inside `pbShowCommands` and `pbChooseNumber`; the live fields are in [Runtime → Payload Wrappers](../reference/runtime.md#payload-wrappers).

### Wait Step and Stuck

In `event` and `transition` the step presses nothing and advances up to `WAIT_TICKS` (300) until the signature or payloads change. The call ends `stuck` after `STUCK_STEPS` (3) steps in a row with no progress (no new message, no answer given, no context change). 300 ticks cover long scripted walks and the item fanfare; three empty steps (900 ticks, about a second of wall time at max) separate a hang from a slow cutscene. Parallel-process events do not run in the map interpreter, so they never hold `finished` back.

### Handoff

A handoff stops on the first tick a battle exists (`AnilBridge.battle`, set by the `pbStartBattle` hook), before any battle text, and on the first tick of any `menu`, `special`, `unknown` or battle context, touching nothing. Everything in a battle, its intro text included, belongs to the battle layer, whose `continue_battle` drives it on ([Battle Layer Design](battle-layer-design.md)). An `unknown` stack is logged to `unknown_contexts.jsonl`; screens met while verifying got [context table](../reference/runtime.md#context-table) lines.

## Transcript

Each line is either a message, with `raw` (the payload text as passed) and `text` (substituted), or an answer, with the prompt, options or range, and the answer chosen. `text` comes from a Python copy of the game's substitutions in `pbMessageDisplay` (`093_Messages.rb:421-480`): `\PN` (player name), `\PM` (money), `\v[n]` (variable), `\N[n]`, `\n` and `<br>` (line breaks), Añil's gendered endings `\@a` and `\@`, and the `\PG` / `\POG` pair are filled from state; colour and markup (`\c[n]`, `\b`, `\r`, `\[XXXXXXXX]`, `<b>` and the tags under [Decisions → Transcript](#transcript-1)), the windowskin code `\w[]`, the sound codes `\se[]` and `\me[]`, waits, speed codes, `\x01` and the rest of the parser's control codes (faces, the money, coin and battle points windows, window placement, `\ch[]` and `\sign[]`, under [Decisions → Transcript](#transcript-1)) are stripped; any other code is left in. A speaker's name shown in Añil's name box is set by a script call (`NameBox.load`, `429_Mostrar_nombres_NPCs.rb`), not by the text, so the transcript does not carry it. The transcript is read in the command's output, the logs and the record (NPC hints, item names); keeping `raw` means a missed code is visible and never lost.

## Changes

At the start and end of each call the harness reads the typed state and the whole switch, variable and self-switch arrays, and reports in `changes` (type `StateChanges`) only what differs: items by name with the count change, money, the Pokévial's charges, party (members added or removed by slot; per member species, nickname, level, HP, status, held item, moves, PP and exp share), map and position, and each changed switch, variable and self-switch with old and new values. The transcript says what the game claimed, `changes` what happened; a caller needs the latter (did the HM arrive, did the gift join). PC boxes are left out here: an event touches boxes only when the party is full, which still shows in flags and text. Only the menu layer's `pc` compares them ([Menu Design → Results](menu-design.md#results)).

## Commands

- `anil interact <map> <event> [--answer TEXT]...` runs `interact`.
- `anil dialog [--answer TEXT]...` runs `continue_dialog`.

Both attach as the driver, print each line as it happens, then the outcome, reason, decision, unused answers and changes (and the stack for `stuck`); they exit 0 on `finished` or `no_effect`, else 1.

## Observability

Each call writes `dialog` entries to `record.jsonl` through `note`, with a `stage` field: `start`, one `line` per transcript line, and `result`. The entry fields are in [Runtime → Session Record](../reference/runtime.md#session-record). Replay skips the kind; the presses are ordinary advances and replay reproduces them. Steps log to the `harness.dialog` logger.

## Decisions

### Scope and Interfaces

- **One driver for interacting and for interruptions:** both are message, choice and number contexts. The owner chose this over interacting with a target event alone and over adding menus. _(settled 2026-10-01)_
- **Battles, menus and special screens are out** and end the call `handoff`; navigation is never called from this layer and no chained call is planned. _(settled 2026-10-01)_
- **Two entry points, `interact` and `continue_dialog`.** `settle` was rejected as the second's name: it says little, and `anil.harness.drive` then had a `settle` meaning "advance with no input until `moving` changes" (since renamed `wait_until_still`). _(settled 2026-10-01)_
- **Ordered answers, never guessed:** a call with no fitting answer ends `decision` and leaves the choice open. Answers keyed by prompt were rejected as verbose (prompts carry control codes); one answer per call is what passing no answers already gives. _(settled 2026-10-01)_
- **Names:** the outcome is `finished`, not `done`, because `anil.harness.navigate` then had a `Done` class with another meaning (since renamed `Reached`); the result type is `DialogResult`, not `Dialog`, so it does not clash with the module. `Decision` names the range `minimum` and `maximum`, as the answer lines do, rather than the payload's `min` and `max`. _(settled 2026-10-01)_

### Live Fields

- **A bridge hook adds the live `cursor` to choice payloads and `value` to number payloads,** not one shared `index`, so the step reads where the cursor is rather than counting presses. _(settled 2026-10-01)_
- **The number payload also carries the live `digit`** (the selected digit, 0 the leftmost). Forced by evidence: up and down change only the selected digit, wrapping 0 to 9 with no carry, and left and right move it ([Runtime → Payload Wrappers](../reference/runtime.md#payload-wrappers)), so `value` alone cannot reach a number of two digits or more without counting left and right presses. _(settled 2026-10-01)_

### Driver Loop

- **Each step reads two paths:** the interpreter flag and `AnilBridge.battle.object_id`, which is `nil` with no battle. A read path that reaches `nil` answers `nil` for whatever follows, so `AnilBridge.battle.nil?` cannot be read. _(settled 2026-10-01)_
- **The message step** presses C and releases until the payloads change; a signature change alone ends the press only when the context, screen or payload set changed. A line is recorded once per payload (its entry tick and text). _(settled 2026-10-01)_
- **The choice step** presses up or down once (one tick, then one released), reads `cursor` back, and gives up as `stuck` after three presses per option. A payload with no live `cursor` yet is waited on for up to 20 ticks. _(settled 2026-10-01)_
- **The number step learns each digit's place:** the payload has no digit count, so on a digit it has not yet seen the step presses up once and takes the place from the change in `value` (+1 place, or -9 places on a 9). It then sets that digit with up or down, the shorter way round, and moves left or right toward the highest place still wrong. A target of the other sign ends `stuck`: the sign position is not handled. _(settled 2026-10-01)_
- **Input sampling (forced by evidence):** the C that closed an event's last box re-triggered the event in the same tick; the bridge now drops triggers on a second `Input.update` in a tick ([Runtime Design → Input and Control](runtime-design.md#input-and-control)), so the last box closing never re-triggers the NPC in front. _(settled 2026-10-01)_
- **A press of C that closes nothing ends `stuck`:** after an answer, C is pressed until the payloads change, up to 120 ticks. The answer is already in the transcript then, so `unused` does not list it. _(settled 2026-10-01)_
- **The item-found popup is a message:** Añil's popup naming a newly received item waits only for C or B, so its context table line gives `message` (`item_found`) and the message step closes it with C. It carries no payload and adds no transcript line; the item shows in `changes`. Handing it off would end every first pickup of an item `handoff` mid-event, and the layer's scope already includes item pickups ([Runtime → Context Table](../reference/runtime.md#context-table)). _(build choice, 2026-10-02)_
- **Wait and stuck limits:** `WAIT_TICKS` 300 and `STUCK_STEPS` 3, as under [Wait Step and Stuck](#wait-step-and-stuck). "Busy" was dropped as a second name for the same wait. _(settled 2026-10-01)_
- **Handoff on the first tick,** before any battle text, touching nothing. _(settled 2026-10-01)_

### Interact

- **The start checks run in order** (idle, not moving, the map, the live event and its page, the trigger, then the position) and the first that fails is the reason. Idle needs the context `overworld` with no payloads and no battle; `classify` names it `event` while the interpreter runs, so that check covers the interpreter too. The position check builds navigation's `Atlas` from a live-world read and asks `facing_tiles` and `over_trigger`, so the across-counter and footprint cases are navigation's own; the player's direction must equal the one `facing_tiles` gives for the tile. Autorun and parallel-process pages are refused as not started by C. _(settled 2026-10-01)_
- **The press is one tick of C**, then single released ticks, looking after each, until the context leaves the idle overworld or a battle exists, up to `START_TICKS` (20); then the driver loop takes over from that look. _(settled 2026-10-01)_

### Transcript

- **Substituted in Python, `raw` kept:** capturing expanded text in the game was rejected, since the window's own markup still needs stripping and it is one more bridge hook. _(settled 2026-10-01)_
- **Control codes stripped as the game's parser does (forced by evidence):** `pbMessageDisplay` rewrites `\sign[x]` to `\op\cl\ts[]\w[x]` before anything else (`093_Messages.rb:424-426`), then its control loop removes every match of `\(f|ff|ts|cl|me|se|wt|wtnp|ch)\[...\]` and of the bare `\g`, `\cn`, `\pt`, `\wd`, `\wm`, `\op`, `\cl`, `\wu`, `\sh`, `\.`, `\|`, `\!` and `\^`, any case (`:493`), acting on them rather than showing them (the sound codes among them have their own entry below). Faces, the money and coin windows, window placement, `\ch[]` and `\sign[]` were first left in, with the battle points window `\pt` missed; a whiteout line read `\wmHas vuelto corriendo a casa...` while the game shows none of it, so the transcript now copies the rewrite and the regex whole; in session `20261003-200117` the whiteout's `\w[]\wm\c[13]\l[3]Has vuelto corriendo a casa...` read `Has vuelto corriendo a casa...`. Markup tags stripped: `b`, `i`, `u`, `s`, `o`, `ac`, `ar`, `al`, `outln`, `outln2`, `c2`, `c3`, `fs`, `fn`, `icon` (`<icon=X>`, `092_DrawText.rb:334`). _(settled 2026-10-01; `\PM` and the tag list moved to Añil's substitutions 2026-10-02, `\me[]` to the sound codes 2026-10-03; the codes once left in stripped 2026-10-03, forced by evidence)_
- **The sound codes `\se[]` and `\me[]` are stripped (forced by evidence):** the TM messages of the bag carry `\se[PC access]` and `\se[]` ([Menus → Bag](../reference/menus.md#bag)), the save message carries `\me[GUI save game]` ([Menus → Save](../reference/menus.md#save)), and `pbMessageDisplay` plays the sound rather than showing it (`093_Messages.rb:493`, `:652-655`), so the transcript removes both with the waits and speed codes. _(forced by evidence: `\se[]` 2026-10-02, `\me[]` 2026-10-03)_
- **Añil's substitutions (forced by evidence):** v21's `pbMessageDisplay` removes `\w[]` itself, so the transcript strips it too. `\PM` reads the amount with thousands commas, then `$`, as `_INTL("{1}$", money.to_s_formatted)` gives. `\@a` becomes `a` for a female player and nothing for a male one, and `\@` becomes `a` or `o`, read from `$player.female?` and `$player.male?` only when the text holds the code. Both read false at the intro's name entry (session `20261002-025936`); when neither holds, the game leaves the codes in, and so does the transcript. The markup list follows `FORMATREGEXP` (`092_DrawText.rb:75`), adding `c`, `r`, `pg`, `pog` and `img`, and `<br>` becomes a line break. _(settled 2026-10-02)_

### Changes

- **`changes` stays exact, objects included:** a game variable holding an object, such as variable 1 holding a party Pokémon left there by a script, is compared and reported whole, before and after, as the bridge returns it; a person-facing shortening belongs in what prints it, never in the data. _(settled 2026-10-03 by the owner)_
- **`changes` is on every result, `refused` included:** both reads happen whatever the outcome. `anil.harness.state.read_flags` reads the three arrays; the typed read is `read_state` with its unknown-context logging off, since the call's own look already logs it. Boxes are still read by `read_state` but not compared. _(settled 2026-10-01)_
- **Compared as the game reads them:** a switch is on when it is neither `nil` nor `false`, a variable that is `nil` counts as 0, and a self-switch with no entry is off. Items are summed by ID over all pockets. A party slot present on both sides is `changed` when its species, nickname, level, HP, status, held item, move names, PP or exp share differ, listing only those; `added` and `removed` carry the species. The Pokévial's charges are compared as one number. _(settled 2026-10-01; the nickname added 2026-10-02 for the menu layer's naming and the held item the same day for its gives, the exp share and the Pokévial's charges 2026-10-03 for `set_exp_share` and `use_vial`, [Menu Design → Results](menu-design.md#results))_

### Record

- **Record kind `dialog` with a `stage` field,** not an `event` field, which collides with game events; navigation's entries, first written with `event`, use `stage` too since 2026-10-01. Replay skips the kind. The record's `result` carries `changes` with its empty lists and `null` fields left out. _(settled 2026-10-01)_

## Open

- None.
