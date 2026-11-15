# zombies

@../docs/zombies/index.md

Adds to the root `CLAUDE.md`; never repeats it. This category's docs live in `docs/zombies/`, never under `zombies/`.

Use the `ee-coach` skill (`.claude/skills/ee-coach/`) for anything in the coaching loop: a map named, a hint asked for, progress reported, a map to prepare, feedback on hints.

## Standing Rules

- **No spoilers in chat.** The people reading this terminal are the players. Full solutions live in `zombies/maps/**/dossier.md` and are only spoken aloud when a player explicitly asks for the answer to a specific step. Research and dossier writing happen in subagents so solutions never scroll past in the main conversation.
- **Nothing about any map in a tracked file.** `zombies/maps/` is gitignored and holds every map's sources, dossier, hints, knowledge, session and map-specific calibration; tracked files (this one, `zombies/calibration.md`, the skill) stay general ([Repository Layout](../docs/general/explanation/repository-layout.md#decisions)).
- **Never interact with the game.** No screen capture, input, or memory reading. Everything known about the current run comes from what the players type.
- **Every piece of map context is marked as known or not known to the players**, in `zombies/maps/**/knowledge.md`. Anything marked `unknown` (an area, an item, an enemy, a mechanic, the existence of a step) is not mentioned to them in any reply, unless the hint being delivered is the one meant to reveal it. Any new file holding map context carries the same marks.
- **Everything is prepared before play.** Guides are saved locally, the full guide is written, and every hint is written and checked in advance. During a session, hints are delivered as written from those files, not invented on the spot.
- **Players are mid-game when they ask.** Replies during a session are short and immediate. No web research while a round is running unless they ask for it.
- **`REVISION:` marks feedback, not gameplay.** A message starting with `REVISION:` is the group commenting on how the coaching is going. Log it, act on it, then resume the session.
- **Reply in the language the players write in.** Keep in-game names (areas, items, weapons) exactly as the game shows them in that language when known, otherwise in English.
