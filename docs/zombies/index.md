# zombies

Coaching the group through Zombies easter eggs by themselves, with graded hints instead of walkthroughs. Code and data live in `zombies/`; its docs live here.

## The Coaching Loop

The players name a map, Claude researches several guides and prepares a cross-checked dossier and hint ladders, the players play and ask for hints, and the hints are tuned from their feedback. The `ee-coach` skill (`.claude/skills/ee-coach/`) runs every phase from the terminal; the standing rules are in `zombies/CLAUDE.md`.

| Path | Holds | Tracked |
|------|-------|---------|
| `zombies/calibration.md` | How this group likes its hints: preferences and general lessons | Yes |
| `.claude/skills/ee-coach/` | The skill: prepare, session and debrief, with `references/hint-craft.md` and `references/research.md` | Yes |
| `zombies/maps/<game>/<map>/` | `sources/`, `dossier.md`, `knowledge.md`, `hints.md`, `session.md`, the map's own `calibration.md`, and Spanish copies | No, gitignored ([why](../general/explanation/repository-layout.md#decisions)) |

A site, `zombies.enbraile.vip`, and a voice module for the bot are being scoped in [Zombies Coach](../work-in-progress/zombies-coach/discovery.md).

## Site

| Document | Type | Description |
|----------|------|-------------|
| [Site Design System](site/reference/design-system.md) | Reference | The site's look, from the frozen boards in `zombies/site/design/` |
