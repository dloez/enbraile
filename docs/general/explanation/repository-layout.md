# Repository Layout

Enbraile holds every app and tool the group builds. Work is grouped first by category (a topic such as Pokémon), then by project inside it, so tools that share a subject also share its docs. Everything is one git repository. Code and docs are kept apart: code lives in the category's folder, and every doc lives in the one tree under `docs/`.

## Code

| Level | Path | Holds |
|-------|------|-------|
| Category | `<category>/` (e.g. `pkmn/`) | The category's projects, and a short `CLAUDE.md` that imports the category's docs index |
| Project | `<category>/<project>/` (e.g. `pkmn/wonder/`) | The project's code, and a `CLAUDE.md` only when the project has rules of its own |
| Game | `pkmn/games/<game>/` (e.g. `pkmn/games/anil/`) | Files tied to one game, such as the scripts that read its saves; what every game uses stays in a project |

A category's or project's `CLAUDE.md` only adds to the root one; it never repeats it, and it holds no docs.

## Docs

| Path | Owns |
|------|------|
| `docs/general/` | Conventions for every category: docs system, layout, tooling |
| `docs/<category>/index.md` | The category's index: its domains and projects |
| `docs/<category>/domains/<domain>/` | What the category's projects share: rules, facts |
| `docs/pkmn/games/<game>/` | One game's facts and tooling, with the same three folders |
| `docs/pkmn/series/<n>/` | One series' rulebook: its rules, dictionary and format, with the same three folders |
| `docs/<category>/<project>/` | One project's design, with the usual `explanation/`, `how-to/` and `reference/` folders |
| `docs/work-in-progress/` | The one queue, open questions, scope docs and plans for everything |

A fact belongs to the lowest level that every reader of it shares: a rule of a series serves every Pokémon tool, so it lives in that series' rulebook, not under one project.

## Games and Series

A game is the build the group plays and its tooling (`pkmn/games/<game>/`, `docs/pkmn/games/<game>/`); a series is one playthrough of a game by the group under its rules. Series are numbered, since a game may be replayed in a later series and a number stays unique: series 1 is Añil, in `docs/pkmn/series/1/`. Each series has one rulebook holding every rule of that series, whether it concerns the game (Nuzlocke, randomizer, Gen 1–5 limits, level caps, locked options) or the PvP part (league, eggs, final tournament); there is no separate rulebook for a game.

## Decisions

- **Docs follow Wonder's conventions** (Diataxis, dated decisions, open questions, a task queue, path-scoped rules in `.claude/rules/`), not Unlit's. **Why:** the owner's choice; Wonder is the first project to move here. _(owner, 2026-10-15)_
- **One docs tree at the root**, organised by category and project; code folders hold no docs. Root, category and project each owning a `docs/` was rejected. _(owner, 2026-10-15; replaces the same day's per-level docs)_
- **One work queue and one open-questions tracker** for every category and project, in `docs/work-in-progress/`. **Why:** follows from the single tree. _(settled 2026-10-15)_
- **One monorepo:** every category and project lives in the one Enbraile git repository; no project keeps a repository of its own. _(owner, 2026-10-15)_
- **Pokémon series' files are grouped by game** in `pkmn/games/<game>/`, docs in `docs/pkmn/games/<game>/`, starting with `anil/` for the first series; shared projects such as the site stay at `pkmn/<project>/`. _(owner, 2026-10-20)_
- **A game and a series are different things:** a game is the build and its tooling, a series one playthrough of it by the group; a game may be replayed in a later series. **Why:** the owner: "we may replay games". _(owner, 2026-10-21)_
- **Series are numbered,** series 1 being Añil, with their docs in `docs/pkmn/series/<n>/`. **Why:** a number stays unique when a game is replayed. _(owner, 2026-10-21)_
- **One rulebook per series,** in `docs/pkmn/series/<n>/`, holding every rule of that series, game and PvP alike; no separate rulebook for a game. **Why:** the owner: "there are nothing as game rules … we do not have to split in series and game". _(owner, 2026-10-21)_
- **The shared Pokémon material moves now, before Wonder:** the rulebook and competition format into `docs/pkmn/series/1/`, the Randomlocke mod and Añil's tooling into `pkmn/games/anil/`, and Wonder's facts about Añil itself into `docs/pkmn/games/anil/`. Everything is copied; Wonder's repository is left untouched. **Why:** the owner, scoping the Añil tooling. _(owner, 2026-10-21; closes "Shared Pokémon material before Wonder moves")_
- **Wonder will live in `pkmn/wonder/`**, its docs in `docs/pkmn/wonder/`, but it is not migrated yet. _(owner, 2026-10-15)_
