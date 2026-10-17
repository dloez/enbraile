# Enbraile Documentation

The home for the apps and tools our group of friends builds, grouped by category. Each category holds its own projects, with all docs in this one tree under `docs/<category>/`.

## Documentation System

This documentation follows the [Diataxis](https://diataxis.fr/) framework. We use three of the four Diataxis types (no tutorials):

- **Explanation** (`explanation/`): Understanding-oriented. Why things work the way they do, design decisions, trade-offs.
- **How-to** (`how-to/`): Problem-oriented. Step-by-step recipes.
- **Reference** (`reference/`): Information-oriented. Quick-lookup facts, dictionaries, rules.

Decisions live, dated, in the `## Decisions` section of the owning explanation doc; undecided items live in [Open Questions](work-in-progress/open-questions.md). Each fact has one owning doc. Before writing or editing docs, read [How to Write Documentation](general/how-to/write-documentation.md).

## General

| Document | Type | Description |
|----------|------|-------------|
| [Repository Layout](general/explanation/repository-layout.md) | Explanation | Categories, projects, and where their code and docs live |
| [Write Documentation](general/how-to/write-documentation.md) | How-to | How to maintain this documentation system |

## Categories

| Category | Description |
|----------|-------------|
| [pkmn](pkmn/index.md) | Pokémon: the group's Randomlocke and the tools around it |

## Work in Progress

Open questions, scope docs, and the work queue. Non-authoritative — see [lifecycle rules](work-in-progress/index.md).

- [Open Questions](work-in-progress/open-questions.md)
- [Tasks](work-in-progress/tasks.md) — the work queue
- [Team Analysis](work-in-progress/team-analysis-discovery.md) — PokeGraph's team analysis as a site tool and inside Open Sheet
