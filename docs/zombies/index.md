# zombies

Coaching the group through Zombies easter eggs by themselves, with graded hints instead of walkthroughs. Code and data live in `zombies/`; its docs live here.

## The Coaching Loop

The players name a map, Claude researches several guides and prepares a cross-checked dossier and hint ladders, the players play and ask for hints, and the hints are tuned from their feedback. The `ee-coach` skill (`.claude/skills/ee-coach/`) runs every phase from the terminal; the standing rules are in `zombies/CLAUDE.md`.

| Path | Holds | Tracked |
|------|-------|---------|
| `zombies/calibration.md` | How this group likes its hints: preferences and general lessons | Yes |
| `.claude/skills/ee-coach/` | The skill: prepare, session, moving a session to the site and debrief, with `references/hint-craft.md` and `references/research.md` | Yes |
| `zombies/maps/<game>/<map>/` | `sources/`, `dossier.md`, `knowledge.md`, `hints.md`, `session.md`, `import.json`, the map's own `calibration.md`, and Spanish copies | No, gitignored ([why](../general/explanation/repository-layout.md#decisions)) |

A site, `zombies.enbraile.vip`, is being built in `zombies/site/`, where members start or join an attempt (stored as a run) on a published map and talk in its chat, and which deploys to Vercel. The bot's [zombies module](bot/explanation/bot.md) brings Cari into the run's voice call. What is still open for both is scoped in [Zombies Coach](../work-in-progress/zombies-coach/discovery.md).

## Site

| Document | Type | Description |
|----------|------|-------------|
| [The Zombies Site](site/explanation/site.md) | Explanation | How the site is built, its database and the map bundles Claude publishes to it |
| [Run and Deploy the Site](site/how-to/run-and-deploy-the-site.md) | How-to | Run the site locally, publish a map to it, and deploy it |
| [Site Design System](site/reference/design-system.md) | Reference | The site's look, from the frozen boards in `zombies/site/design/` |

## Bot

| Document | Type | Description |
|----------|------|-------------|
| [The Zombies Bot Module](bot/explanation/bot.md) | Explanation | How the bot brings Cari into a run's voice call, hears «cari …» and speaks the site's answer |
