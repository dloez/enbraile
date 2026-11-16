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

The wiki-style agent also saves the map's **announcement image**: the official reveal art the map got when it was announced (the publisher's blog post or press kit, or the image the wiki shows as the map's official art). It converts it to a JPEG at most 1920 px wide and under 700 KB with metadata stripped (`uv run --with pillow`), saves it as `art.jpg` in the map dir, and checks that it shows no easter-egg step or solution, such as a code, a symbol answer or a diagram of a step; a map's areas and characters are fine, found or not. It reports only yes or no, the file's dimensions and size, and the source's domain, never what the image shows. No official image, or none that passes, means no `art.jpg`, and the site keeps a drawn plan for the map.

The same agent saves a **survey image**: a community overhead map of the whole level, the top-down layout wikis and guide sites draw, ideally with area labels. It converts it to a JPEG at most 2400 px on its longer side and under 2 MB with metadata stripped, saves it as `survey.jpg`, and checks it carries no easter-egg step or solution (a marked step location, a code, a symbol answer); areas the players have not found are fine. It reports only yes or no, the dimensions and size and the source's domain. No overhead map that passes means no `survey.jpg` and no zones.

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
- L4 as spoken: <the answer exactly as it will be given to the players if they ask for it: short, in order, readable mid-round, on one line> Mentions: <IDs> [Reveals: <IDs>]
- Confirmation: <what the game does when it worked: sound, quote, visual, item>
- Conditions: <for steps that depend on rounds, enemies, items or chance, four parts, each an indented item:>
  - Essential: <enemy / item / state that must be present, and every natural way it comes about — see Map mechanics>
  - Routes: <each way to do it, with its round range, cost and reliability, e.g. "works at any round but rarely first try">
  - Single-use: <resources usable once per game / round, and when spending them is safe>
  - Doubts: <open doubts between sources>
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

In `hints.md`, every rung, `Alt`, `Heads-up` and `On success` line, and the dossier's `L4 as spoken`, ends with `Mentions: <IDs it names or implies>` (or `Mentions: none`). A rung should be written to mention as few `unknown` things as its level allows: L1 ideally none beyond what earlier steps introduced, and each higher rung adding only what it is meant to give. When a line is the one meant to give an `unknown` thing away, that ID is also listed after the Mentions as `Reveals: <IDs>` (a subset of its Mentions; usually a rung of the step that `Introduces` it). Every other ID a line mentions must already be known by the time it is said, which is what lets the site's code refuse a line naming something the players have not met. `Heads-up` lines never reveal. The language copies carry the same IDs.

### `hints.md` (no solutions)

```markdown
# Hints: <Map>

## Step 1 (<type>)
Spoiler-free title: <something that could be said aloud, e.g. "Getting started">
Done when: <what the players would report when the step is done, in the ways they might say it, e.g. "they say they found, hit or shot the thing, or saw it react, even if they add they don't know what to do next">
Requires: <Step 3, Step 4> | none
Optional: yes
- L1: … Mentions: K01
- L2: … Mentions: K01
- L3: … Mentions: K01, K07 Reveals: K07
- Alt for L2 (<they already know component, are solo, …>): <replacement for that rung> Mentions: …
- Part ladder, <the part, said plainly>:
  - L1: … Mentions: …
  - L2: … Mentions: …
  - Alt for L1 (<situation>): … Mentions: …
- Heads-up (<when to give it>): <lockout or missable warning to give unprompted, if any> Mentions: …
- On success: <what to tell them when they report the confirmation signal> Mentions: …
```

Levels 1 to 3 only; level 4 is the dossier's "L4 as spoken", kept out of this file so the blind check never reads an answer.

**The shape is strict**, because `compile` (section 4) reads it into the site's bundle and rejects anything else: one line per item, the labels exactly as above, and nothing else inside a step but plain prose lines, which it ignores; a heading that is not a step ends the step, so keep a step's lines under its own heading. `Requires` names only steps, by number, that must be done first (items and rounds stay in the dossier); `none` when there are none. `Optional: yes` appears only on optional steps. Each `Alt` names the rung it replaces, and a step may have several. A `Part ladder` holds only its indented `L<n>` and `Alt for L<n>` lines, and is used when players report one part of a multi-part step found. The dossier's step headings keep their numbers (`## Step <n>: …`), its `L4 as spoken` stays on one line, and a step's `Conditions` are written as indented `- ` items under that field, one per condition, which the bundle carries as they stand. Card text never carries a step, hint or level number (no "Step 5", "L2", "2/4"): `compile` rejects it. Write every rung using the components, the two tests, and the per-type handling from `hint-craft.md`, and respect anything `zombies/calibration.md` says about this group.

**The step's type** in its heading is one of `discovery`, `puzzle`, `arbitrary` or `execution` (`hint-craft.md` → handling by type); `compile` carries it into the bundle as the step's `kind`, which tells the live coach how the step finishes, and warns about a heading without one. Write each `Done when` to fit it: a discovery is done on the find itself, an execution only on its outcome.

**`Done when`** is for the live coach, which sees steps only by handle, never by title: it is how the coach tells from the players' own words that a step is done, records it and hands over the next step's first hint. Write it in English from the dossier's `Confirmation` and the step's goal, covering the different ways players report it ("found it", "hit it", "it reacted", "we did it but don't know what now"). Name only what the players already know while on that step; the site withholds a `Done when` that names something still unknown. `compile` warns about a step without one.

**`On success` lines** are said the moment players report the step done, immediately followed by the next step's L1. So an `On success` line is one short sentence, in the same teammate voice as the low rungs, that makes clear what they achieved or what it changed in the game, and nothing else: no advice they cannot act on, no teaser that repeats what the next L1 is about to say, no bare praise.

**This file is the script for the session.** The coach delivers these lines word for word, so write them as finished text a player will read, not as notes. The point is that every hint the players get was written with the full guide in view and checked in advance, instead of being made up mid-round. Cover the predictable situations with `Alt` lines (players who already found the place, already have the item, are playing solo) so the coach rarely has to go off script.

**Language.** Write `dossier.md` and `hints.md` in English. If `zombies/calibration.md` says the players use another language, also write `dossier.<lang>.md` (for example `dossier.es.md`): a faithful, complete translation of the dossier, same structure and same step numbers, so someone in the group who already knows the map can read it and check the guide is right. It is a review copy; `dossier.md` stays the reference, and any correction is applied to both. In the same case also write `hints.<lang>.md` (for example `hints.es.md`) with the same structure, adding each step's "L4 as spoken" as an `- L4:` line after its L3, translated once here so the wording is fixed rather than re-translated differently on every request. Every line of the English file has its translation, in the same order with the same `Mentions` and `Reveals`; the headings may be translated, but the labels (`L1`, `Alt for L2 (…)`, `Part ladder, …`, `Heads-up (…)`, `On success`) stay exactly as in English so `compile` can pair the two files; `Requires` and `Optional` are read from the English file only. Translate the sentences, not the in-game names: use area, item, and weapon names in the language `zombies/calibration.md` says the game is played in, and if that isn't English, give the localised name only when a source confirms it, otherwise keep the English name.

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

## 3b. Zones (one agent with dossier access, then a blind check)

When there is a `survey.jpg`, a subagent with the dossier reads every level 3 rung, every Alt for one and every step's `L4 as spoken`, and gives a zone to each that sends the players to a place; levels 1 and 2 never get one, since a place drawn on a map is the strongest hint there is. It writes `zones.json` in the map dir, one entry per zoned rung, keyed by the rung's address as `compile` names it: `step <n> L3`, `step <n> L4`, `step <n> Alt <k>` (the step's k-th Alt line, in file order), `step <n> part <p> L3` and `step <n> part <p> Alt <k>`. Each is an ellipse tight over the exact spot where the action happens (the console, door or pedestal, not the room), radii about 0.01–0.025 of the image's width and above 0.04 only when the action really spans an area, its centre and radii as fractions of the image's width and height, since the site shows it in a crop zoomed around it ([The Zombies Site → Zones](../../../../docs/zombies/site/explanation/site.md#zones)):

```json
{ "step 5 L3": { "x": 0.42, "y": 0.61, "rx": 0.018, "ry": 0.021 } }
```

It checks each placement by drawing the ellipse on the image (`uv run --with pillow`) as the card shows it, cropped to a 4:3 window centred on the zone at least 40% of the image's width and wide enough that the zone spans at most a third of it, and also on the whole image, and looking at the renders. Then a fresh agent with no access to the dossier gets `hints.md` and each pair of renders, and says for each zoned rung whether the zone and the rung's text point to the same place, and whether the zone gives away more than the rung says (another step's place, a later rung's detail); the first agent fixes what fails against the dossier, one round. Both report addresses, counts and verdicts only.

## 4. Compile and publish

The live coach on `zombies.enbraile.vip` reads a map only as a bundle. In the map dir, write `map.json` with the map's name in each language, its `art`, the key of one of the site's three drawn plans, shown wherever the map has no image, `image`, the announcement image's file name, when section 1 saved one, and `survey`, the survey image's, when it saved that:

```json
{ "name": { "es": "<name as the Spanish game shows it>", "en": "<English name>" }, "art": "teal | rust | furnace", "image": "art.jpg", "survey": "survey.jpg" }
```

Then, from `zombies/site/`, in the synthesis subagent:

```sh
npm run compile -- ../maps/<game>/<map>
npm run publish -- ../maps/<game>/<map>
```

`compile` reads `map.json`, `hints.md`, `hints.es.md` (the site carries every line in Spanish and English, so a bundle needs the Spanish copy whatever the players' language), `knowledge.md` (a thing is `known` in the bundle only when its status is `known`), `dossier.md` (the `L4 as spoken` and `Conditions` of each step, and the whole text as the durable copy), the map's `calibration.md` everything under `sources/`, `zones.json` and the images `map.json` names (each rejected if it is missing, over 4 MB, or not a JPEG, PNG or WebP file), checks them (a zone on a level 1 or 2 rung, on a rung that does not exist, or with no survey image is an error), and writes `bundle.json` beside them. Its errors name a file and line or a step and rung, never the text, so they can be quoted in the main conversation; fix each and run it again. Its warnings list `unknown` IDs that some line mentions but no line reveals, which the site can only deliver once the players name the thing themselves: add the missing `Reveals` unless that is intended. It prints counts only. `publish` uploads the images, then sends the bundle to the site as a new version ([How to Run and Deploy the Site](../../../../docs/zombies/site/how-to/run-and-deploy-the-site.md)). Any later change to the hints, the dossier or the zones is followed by both commands again.

## 5. Report

Back in the main conversation: number of steps, whether any sources conflicted (without saying on what), and whether the quest has points of no return. Nothing else.

## Fast prepare

If the players are already in a game: one agent, two sources (wiki plus one written guide), dossier and hints in one pass, no blind check. Mark the dossier as `fast` so a full prepare can replace it later, and compile and publish it as in section 4 so the site can coach it too.
