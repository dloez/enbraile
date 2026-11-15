# Research and dossier building

All of this runs in subagents that write to files. The main conversation should only ever see "done, N steps, these open questions", never solution text, because the players read the terminal. Tell each subagent that explicitly: write findings to the file, return a short spoiler-free status.

Work in `zombies/maps/<game>/<map>/` (lowercase, hyphenated). It is gitignored; nothing about the map goes into a tracked file.

## 1. Gather sources (parallel)

Spawn three research agents at once, each on a different kind of source so that errors don't share an origin:

1. **Wiki-style reference** (the fandom/community wiki page for the map's quest). Usually the most complete, sometimes stale.
2. **Written guide from a games site** (a step-by-step article). Usually clearer on practical detail and locations.
3. **Community sources** (video guide descriptions or transcripts, Reddit threads, patch notes). Best for solo/co-op differences, bugs, patched steps, and the tricks that make hard steps manageable.

Each agent first saves the page text it used, unedited, as `sources/raw/<n>-<short-name>.txt`, so the guide can be rebuilt or re-checked later without going back to the web (pages change and disappear). Then each agent writes `sources/<n>-<short-name>.md` with: URLs used, publication or update date, and the quest as that source tells it, step by step, keeping the exact in-game names of areas, items, and enemies. Each should note anything the source itself flags as random per game, player-count dependent, missable, or bugged.

Give each agent the game, map, quest, and player count. If a source can't be fetched, the agent finds another of the same kind rather than giving up.

## 2. Synthesise the dossier (one agent)

One agent reads all of `sources/`, plus `zombies/calibration.md` and `.claude/skills/ee-coach/references/hint-craft.md`, and writes two files.

### `dossier.md` (spoilers)

```markdown
# <Map>: <quest name>
Game: … | Players researched for: … | Researched: <date>
Sources: <list>

## Before you start
Setup the quest depends on (power, Pack-a-Punch, wonder weapon, specific perks or equipment), and
anything missable or order-sensitive across the whole quest.

## Map mechanics
How the map behaves on its own, independent of the quest: which special enemies spawn naturally and
how often (by round), round-based events and thresholds, what restocks or respawns, what moves,
single-use resources (once per game / once per round). The coach uses this to tell a real block from
a false one: a step that "needs an enemy" is not blocked if that enemy turns up by itself every few
rounds. Every step's Conditions must be checked against this section.

## Step 1: <descriptive title>
- Type: discovery | puzzle | arbitrary | execution
- Requires: <earlier steps, items, round conditions>
- Where / What / How / When: <the four components, each on its own line>
- Full solution: <complete instructions>
- L4 as spoken: <the answer exactly as it will be given to the players if they ask for it: short, in order, readable mid-round>
- Confirmation: <what the game does when it worked: sound, quote, visual, item>
- Conditions: <for steps that depend on rounds, enemies, items or chance, four parts:
  essential (enemy / item / state that must be present, and every natural way it comes about — see Map mechanics);
  routes (each way to do it, with its round range, cost and reliability, e.g. "works at any round but rarely first try");
  single-use resources (once per game / round) and when spending them is safe;
  open doubts between sources>
- Fail states and lockouts: <what resets or blocks it, how to retry>
- Varies: <random elements and how to read them; solo vs co-op differences>
- Source agreement: <all agree | conflict, with which source says what and which is likelier and why>
```

Split steps where a player would feel a new "what now?" moment. A guide's single step that hides three separate discoveries becomes three steps here, because each needs its own hints.

Where sources disagree, keep both versions and mark it. Never silently pick one: during the session, a marked conflict is how the coach knows to ask the players what they see instead of insisting.

### `knowledge.md` (what the players know)

Every piece of map context carries a mark saying whether the players know it, because that decides whether it may be mentioned to them. Naming an area they haven't opened, an item they don't know exists, or an enemy they haven't met is a spoiler even inside an otherwise careful hint.

List every named thing and fact the dossier uses: areas, items and parts, weapons, enemies, mechanics, and the existence of each step.

```markdown
# What the players know: <Map>

| ID | Thing | Kind | Status | How / when | First needed in |
|---|---|---|---|---|---|
| K01 | <name> | area / item / weapon / enemy / mechanic / step | known / unknown / revealed | <"said they know it", "hint 4·L2", "reported seeing it"> | Step N |
```

- `unknown`: must not be mentioned to the players.
- `known`: the players have said or shown they know it. Free to mention.
- `revealed`: the coach told them, in a hint. Free to mention from then on.

Initial status comes from what the players said at intake. Without that, everything specific to this map starts `unknown`; only things common to the whole game series (that maps have power, perks, a Pack-a-Punch, a buildable shield, a wonder weapon) start `known`. This file is the single place where status lives, and the coach updates it during the session.

In `dossier.md`, give each thing its ID on first mention in a step, like `<name> [K07]`, and add to every step:

- `Uses: <IDs the step depends on>`
- `Introduces: <IDs the players meet for the first time in this step>`

In `hints.md`, every rung, `Alt`, `Heads-up` and `On success` line ends with `Mentions: <IDs it names or implies>` (or `Mentions: none`). A rung should be written to mention as few `unknown` things as its level allows: L1 ideally none beyond what earlier steps introduced, and each higher rung adding only what it is meant to give. The language copies carry the same IDs.

### `hints.md` (no solutions)

```markdown
# Hints: <Map>

## Step 1 (<type>)
Spoiler-free title: <something that could be said aloud, e.g. "Getting started">
- L1: …
- L2: …
- L3: …
- Alt (they already know <component>): <replacement for the rung that would otherwise tell them something they have>
- Heads-up: <lockout or missable warning to give unprompted, if any>
- On success: <what to tell them when they report the confirmation signal>
```

Levels 1 to 3 only; level 4 is the dossier's "L4 as spoken". Write every rung using the components, the two tests, and the per-type handling from `hint-craft.md`, and respect anything `zombies/calibration.md` says about this group.

**`On success` lines** are said the moment players report the step done, immediately followed by the next step's L1. So an `On success` line is one short sentence, in the same teammate voice as the low rungs, that makes clear what they achieved or what it changed in the game, and nothing else: no advice they cannot act on, no teaser that repeats what the next L1 is about to say, no bare praise.

**This file is the script for the session.** The coach delivers these lines word for word, so write them as finished text a player will read, not as notes. The point is that every hint the players get was written with the full guide in view and checked in advance, instead of being made up mid-round. Cover the predictable situations with `Alt` lines (players who already found the place, already have the item, are playing solo) so the coach rarely has to go off script.

**Language.** Write `dossier.md` and `hints.md` in English. If `zombies/calibration.md` says the players use another language, also write `dossier.<lang>.md` (for example `dossier.es.md`): a faithful, complete translation of the dossier, same structure and same step numbers, so someone in the group who already knows the map can read it and check the guide is right. It is a review copy; `dossier.md` stays the reference, and any correction is applied to both. In the same case also write `hints.<lang>.md` (for example `hints.es.md`) with the same structure, including each step's "L4 as spoken", translated once here so the wording is fixed rather than re-translated differently on every request. Translate the sentences, not the in-game names: use area, item, and weapon names in the language `zombies/calibration.md` says the game is played in, and if that isn't English, give the localised name only when a source confirms it, otherwise keep the English name.

## 3. Blind check (one agent, no access to the dossier)

This agent plays the part of a player who knows the game and the map's layout but has never done this quest. It reads **only** `hints.md` and, for every rung, writes to `hints-review.md`:

- what it would go and do after reading that hint, concretely
- whether it thinks it already knows the full step

Then the synthesis agent (or a fresh one with dossier access) compares against the dossier and rewrites failing rungs:

- The blind player can't name a concrete action at L1 or L2 → too vague, make it more concrete.
- The blind player states the complete solution at L1 or L2 → too obvious, hold a component back.
- L3 doesn't get them to the right action → the method is unclear.
- Two adjacent rungs produce the same guess → the higher one adds nothing, rewrite it.

One round of fixes is enough. The real calibration comes from the players. After the fixes, bring any `hints.<lang>.md` in line with the final English rungs, and `dossier.<lang>.md` in line with any change to "L4 as spoken".

## 4. Report

Back in the main conversation: number of steps, whether any sources conflicted (without saying on what), and whether the quest has points of no return. Nothing else.

## Fast prepare

If the players are already in a game: one agent, two sources (wiki plus one written guide), dossier and hints in one pass, no blind check. Mark the dossier as `fast` so a full prepare can replace it later.
