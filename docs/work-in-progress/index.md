# Work in Progress

Temporary, evolving content. Treat it as proposals, not settled decisions: it may be incomplete, outdated, or superseded, so verify an approach is still current before implementing from it. Never cite a WIP doc as an authoritative source.

## Contents

| Document | Kind | Description |
|----------|------|-------------|
| [Open Questions](open-questions.md) | Tracker | Everything not yet decided |
| [Tasks](tasks.md) | Queue | The ordered work queue for `/next-task` and `/work-queue` |
| [Open Sheet](open-sheet.md) | Initiative | The first tool: a save export to JSON and a web app to browse it, for open-sheet tournament fights |
| [Open Sheet: Site Discovery](open-sheet-site-discovery.md) | Scope | Decisions behind the web app: the pkmn site's Open Sheet tool, `pkmn/site/` |
| [Team Analysis: Discovery](team-analysis-discovery.md) | Scope | Bringing PokeGraph's team analysis into the site: a Team Analysis tool and a deeper analysis in Open Sheet |
| [Open Sheet: Origin Conversation](open-sheet-origin-conversation.md) | Context | The Wonder session where the export was first discussed |

## Lifecycle

- **Initiatives** (e.g. a milestone) span several sessions. When complete, move lasting content to its permanent place under `docs/` and delete the initiative doc.
- **Scope docs** come from `/scope` (filename contains `discovery`) and never mention tasks. Once no task links to one, move its lasting content to its permanent place under `docs/` and delete it.
- **Tasks** (`tasks.md`) are one permanent queue, written by `/scope` or added directly by the owner. A task is deleted when it closes, in the same commit as its work.
- **Plans** come from `/make-plan` (filename contains `plan`), only for work too entangled for tasks. No `plans/` subdirectories. Delete a plan once fully executed and its **Documentation to update** list has been applied.
- **Open questions** are closed as described in [Recording Decisions](../general/how-to/write-documentation.md#recording-decisions).
