# Writing hints that work

Past hints for this group failed in two ways: so obvious they were just the instruction, or so cryptic nobody could act on them. Both come from the same mistake: treating a hint as the answer made blurrier. A blurry answer is either still readable (obvious) or unreadable (riddle).

A good hint is not a blurred answer. It is a **complete, clear statement about part of the answer**.

## Split the step into components

Almost every quest step is made of:

- **Where**: the area
- **What**: the object, enemy, or thing to notice
- **How**: the action, weapon, item, or order
- **When**: the condition (after another step, during a special round, in a time window)

Knowing the answer means knowing all of them. A hint hands over one, stated plainly, and leaves the rest. Which one to hand over depends on which one the players are missing, and that is why you ask what they've tried.

## The two tests

Run every hint through both before it goes out.

1. **Action test (not too vague).** After reading it, can the players name something specific to go do or look at in the next couple of minutes that they wouldn't have done otherwise? If the honest answer is "they'd keep wandering", it fails. Applied strictly from level 2 up; level 1 may be as vague as an in-game character line, as long as it points at something real.
2. **Gap test (not too obvious).** Is there still at least one component they have to work out themselves? If following the hint literally completes the step, it's an answer, not a hint. That is fine at level 4 and nowhere else.

## Rules of wording

- **Voice depends on the level.** The low rungs are spoken the way the characters in these games talk to each other: a short remark, a bit wry, in the world of the map, and vague on purpose. That is the tone the players want; a low rung that reads like a manual feels cold and gives too much. Clarity is not dropped, it is moved up the ladder: every `more` must be clearer than the last, and by level 3 the line is plain. Vague is not the same as undecodable: a level 1 line still points at one real thing (that something is to be built, that something was left behind, that something changed), it just doesn't say where or how. Never write a riddle whose answer can't be checked against the game.
- **Imply at level 1, don't state.** The tone the players are after is a saying or a fact about the world that they have to apply themselves, so the conclusion is read between the lines. The players settled this on 2026-11-15, rejecting an L1 that stated the conclusion outright for one that let them infer it from a saying.
- **Short.** Levels 1 and 2 are one or two short sentences, about 25 words at most. If a low rung needs a third sentence it is carrying too much. Cut the second half before adding to the first.
- **One voice.** A generic teammate, not a named character, and never real lines from the game: write new ones in that spirit.
- **Use the names the game shows.** Area names from the HUD, item names from the pickup prompt. "The room past the second barrier" is guesswork. The on-screen name is not.
- **Anchor to what they've already seen.** "You mentioned a locked cabinet in the lab" beats describing something new. It tells them they already had a piece.
- **Say what kind of step it is.** "This one is about noticing something" versus "this one is about surviving something" versus "this one is a code" removes a huge amount of flailing without giving anything away.
- **One hint, one idea.** Two ideas in one hint usually add up to the answer.
- **Rule things out.** "It's not in the starting area" or "you don't need the wonder weapon for this" is a strong hint that still leaves the finding to them.
- **Don't hint at later steps** while helping with the current one.

## The ladder

| Level | Voice | Gives | Holds back |
|---|---|---|---|
| 1 Nudge | Teammate remark, vague | That there is something to do and what it is about | What exactly, where, how |
| 2 Pointer | Teammate remark | **What** they are looking for or how to recognise it | **Where** it is. No area names, no routes |
| 3 Place | Plain, still short | The area or region, and the action if it isn't obvious | The exact spot, order, timing |
| 4 Answer | Plain | Everything | Nothing |

Level 3 is the plain rung, so it carries every condition of the action, in order (which weapon and at what level, where to kill, what to do after), even what an earlier rung already said: players may reach it through an `Alt`, and a level 3 that leaves out a condition reads as wrong (2026-11-15).

Locations do not appear before level 3. A level 2 line that names places is a level 3 line in costume: the players called exactly that "not a hint, literally the locations".

Each rung has to add real information over the one below. If level 2 is level 1 reworded, players burn a request and lose trust in asking.

## Worked examples

Real steps with the wording the players settled on, and the rejected versions beside them, are in each played map's `calibration.md` (`zombies/maps/<game>/<map>/`), gitignored because they quote the map. Read the current map's before writing or choosing a line.

## Steps with several parts

When a step has separate parts to find (shield pieces, several skulls or relics), write one short ladder per part as well as the ladder for the whole step. In play, as soon as the players report one part found, stop climbing the whole-step ladder and switch to the ladder of the part still missing, starting at its L1. Never deliver a rung whose content they have already acted on: if a hint led them to one part but not the other, it was not enough for the other, and repeating it (or the next rung that still talks about the found part) reads as not listening. The players asked for exactly this (2026-11-15): "no tiene sentido volver a decir la misma pista si el jugador ya te ha comentado que con la misma pista ya tiene una pieza", preferring a new level 1 for the missing part over a trimmed level 2.

The same holds for a step whose ladder folds two halves into one, such as what the trick is and how to get it: players often work out the first half alone, and the next rung then tells them what they just said. Give such a step an `Alt` for the rung that states the first half (or split it into parts), for when they already name it, holding a fresh level-1 nudge toward the second half only, which does not repeat the first (2026-11-16).

## Blocked threads

Players may reach a step before its prerequisites. Don't close the door ("that's as far as it goes, you need X"): the players rejected that (2026-11-15). Say nothing until they ask or have clearly sunk a lot of time. Then a ladder aimed at the blocker, same voice rules as any other:

- **L1:** it isn't their method, it's the moment. "Esto no se mueve… y no creo que sea por falta de ganas. Igual no es el momento."
- **L2:** the kind of thing missing, not the thing: something you'd carry, something seen elsewhere, something that has to happen first.
- **L3:** plainly what it is or where it comes from.

Never present threads as a list, and don't link one thread to another unless that link is the rung being delivered: the players want to work out what the threads are and how they relate.

## Step types need different handling

- **Discovery** (find or notice something): the ladder above fits as is.
- **Puzzle** (codes, symbols, sequences, often randomised per game): never give the code, since it differs per game anyway. Hint at where the clue is, then at how clue maps to input. Level 4 explains the full decoding method.
- **Arbitrary** (something no reasonable player would guess, such as shooting an unmarked spot or a pixel-sized object): thinking harder doesn't help here, so a level 1 hint that says "look around" is a trap. Tell them up front it's a hard-to-guess one and make level 1 as concrete as a normal level 2. Here, and only here, level 2 may carry the action (agreed with the players 2026-11-15). In every other step type the action waits for level 3.
- **Execution** (boss fights, escorts, lockdowns, timed runs): they know what to do; the difficulty is doing it. Hints become coaching: preparation worth having first, what usually kills teams, one mechanic at a time. Offer a preparation heads-up before a point of no return.

## Right method, didn't come off

When the players describe doing the right thing and it didn't work (a step that is unreliable or needs repeating), don't diagnose. First only insinuate that it may need another go, with no details: "Hay cosas que no salen a la primera." Let them retry at least a couple of times. Only if they come back still failing, give the detailed retry line (what usually goes wrong), and judge from what they describe. Requested by the players, 2026-11-15. Retry `Alt` lines in the hints file come in this pair: an insinuation, then the detail "after at least two more tries".

## When a hint misses

If they come back with "we don't get it", don't repeat it louder or jump to the answer. Ask what they did with it. Either they acted and found nothing (the hint pointed at a component they already had, so hint at a different one) or they couldn't act (it failed the action test, so say something more concrete at the same level). Log which in `session.md`: it is the most useful calibration data there is.
