# Repository Layout

Enbraile holds every app and tool the group builds. Work is grouped first by category (a topic such as Pokémon), then by project inside it, so tools that share a subject also share its docs. Everything is one git repository. Code and docs are kept apart: code lives in the category's folder, and every doc lives in the one tree under `docs/`.

## Code

| Level | Path | Holds |
|-------|------|-------|
| Category | `<category>/` (e.g. `pkmn/`) | The category's projects, and a short `CLAUDE.md` that imports the category's docs index |
| Project | `<category>/<project>/` (e.g. `pkmn/wonder/`) | The project's code, and a `CLAUDE.md` only when the project has rules of its own |

A category's or project's `CLAUDE.md` only adds to the root one; it never repeats it, and it holds no docs.

## Docs

| Path | Owns |
|------|------|
| `docs/general/` | Conventions for every category: docs system, layout, tooling |
| `docs/<category>/index.md` | The category's index: its domains and projects |
| `docs/<category>/domains/<domain>/` | What the category's projects share: rules, facts |
| `docs/<category>/<project>/` | One project's design, with the usual `explanation/`, `how-to/` and `reference/` folders |
| `docs/work-in-progress/` | The one queue, open questions, scope docs and plans for everything |

A fact belongs to the lowest level that every reader of it shares: a rule of the group's Randomlocke serves every Pokémon tool, so it lives in `docs/pkmn/domains/`, not under one project.

## Decisions

- **Docs follow Wonder's conventions** (Diataxis, dated decisions, open questions, a task queue, path-scoped rules in `.claude/rules/`), not Unlit's. **Why:** the owner's choice; Wonder is the first project to move here. _(owner, 2026-10-15)_
- **One docs tree at the root**, organised by category and project; code folders hold no docs. Root, category and project each owning a `docs/` was rejected. _(owner, 2026-10-15; replaces the same day's per-level docs)_
- **One work queue and one open-questions tracker** for every category and project, in `docs/work-in-progress/`. **Why:** follows from the single tree. _(settled 2026-10-15)_
- **One monorepo:** every category and project lives in the one Enbraile git repository; no project keeps a repository of its own. _(owner, 2026-10-15)_
- **Wonder will live in `pkmn/wonder/`**, its docs in `docs/pkmn/wonder/`, but it is not migrated yet. _(owner, 2026-10-15)_

## Open

- See [Open Questions → Shared Pokémon material before Wonder moves](../../work-in-progress/open-questions.md#shared-pokémon-material-before-wonder-moves).
