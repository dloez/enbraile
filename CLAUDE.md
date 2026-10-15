# Enbraile

@docs/index.md

## Working Here

- **Docs before code.** For non-trivial work, read the owning docs from the index above before exploring code; they hold decisions and rationale the code doesn't show.
- **Categories and projects.** Code lives in `<category>/<project>/` (e.g. `pkmn/wonder/`); every doc lives in the one tree under `docs/` (`docs/<category>/`, `docs/<category>/<project>/`), never in a code folder. A category's or project's `CLAUDE.md` only adds rules to this one ([Repository Layout](docs/general/explanation/repository-layout.md)).
- **Open questions** in `docs/work-in-progress/open-questions.md` are never resolved silently in code: ask, then record the answer as described in [Recording Decisions](docs/general/how-to/write-documentation.md#recording-decisions).
- **Don't ask what the evidence already answers.** If the code or a measurement leaves one workable option, record it as a dated decision, name it in the report, and carry on.
- **Diagnose from source first.** Read the code and form a concrete mechanical explanation before reaching for a runtime probe; use the probe to confirm or to get values the source doesn't hold.

## Code

- **No comments or docstrings**, except machine-read directives (linter, type-checker and formatter pragmas, shebangs). Refactor or move rationale to `docs/`.
- **Greenfield:** no backwards-compatibility shims or deprecation layers.
- Throwaway Python scripts: `uv run --with <pkg> python3 script.py`. Never `pip install`.

## Keeping Docs Current

After a change, update every doc that mentions what changed (`grep -rn <module> docs/`), and keep `docs/index.md` and the category's index in sync. Durable knowledge goes in the repo, never in local agent memory: project-wide rules → the nearest `CLAUDE.md`; path-specific rules → `.claude/rules/`; how a system works → its owning doc under `docs/`; how a workflow runs → `.claude/skills/`. How to write docs: `docs/general/how-to/write-documentation.md`.

`docs/personal/` is the owner's gitignored, non-authoritative workspace; check it when the user mentions "my notes/tasks/plans". Never stage, commit, or move anything in it unless asked.

## Plans

Workflow: `/scope` → scope doc + tasks → `/next-task` or `/work-queue`.

- **Scope docs** (`docs/work-in-progress/`, filename contains `discovery`) hold the decisions and design for one piece of work. They never mention tasks.
- **Tasks** live in `docs/work-in-progress/tasks.md`, the single ordered queue for every category and project. Each task links to the scope section it implements when one exists, ends with manual verification steps, then its `**Touches:**` and `**After:**` scheduling lines. Tasks never restate design.
- **`/make-plan` → `/execute-plan`** only for work too entangled to split into independent tasks. Filenames contain `plan`; default location `docs/work-in-progress/`, `docs/personal/` only for "my plan", `.claude/plans/` as fallback.

## Commit & PR Conventions

- Lowercase, single-line, present tense: `<area>: <short description>` (e.g. `pkmn: add randomlocke rules`). Body only if genuinely complex.
- No agent signatures or co-author trailers, in commits or PRs.
- Never force push.
- Never commit secrets.
