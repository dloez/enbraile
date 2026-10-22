# Enbraile

@docs/index.md

## Working Here

- **Docs before code.** For non-trivial work, read the owning docs from the index above before exploring code; they hold decisions and rationale the code doesn't show.
- **Categories and projects.** Code lives in `<category>/<project>/` (e.g. `pkmn/wonder/`); every doc lives in the one tree under `docs/` (`docs/<category>/`, `docs/<category>/<project>/`), never in a code folder. A category's or project's `CLAUDE.md` only adds rules to this one ([Repository Layout](docs/general/explanation/repository-layout.md)).
- **Open questions** are never resolved silently in code: ask, then record the answer as described in [Recording Decisions](docs/general/how-to/write-documentation.md#recording-decisions).
- **Don't ask what the evidence already answers.** If the code or a measurement leaves one workable option, record it as a dated decision, name it in the report, and carry on.
- **Diagnose from source first.** Read the code and form a concrete mechanical explanation before reaching for a runtime probe; use the probe to confirm or to get values the source doesn't hold.

## Code

- **No comments or docstrings**, except machine-read directives (linter, type-checker and formatter pragmas, shebangs). Refactor or move rationale to `docs/`.
- **Greenfield:** no backwards-compatibility shims or deprecation layers.
- **No tests**, in any category or project: no test files, test runners or test steps in a gate. Check a change by running it (owner, 2026-10-20). Añil's `anil check` is such a run, not a test runner: it drives the real game and prints what it saw ([Randomlocke Design → How the Checks Run](docs/pkmn/games/anil/explanation/randomlocke-design.md#how-the-checks-run)).
- Throwaway Python scripts: `uv run --with <pkg> python3 script.py`. Never `pip install`.

## Keeping Docs Current

After a change, update every doc that mentions what changed (`grep -rn <module> docs/`), and keep `docs/index.md` and the category's index in sync. Durable knowledge goes in the repo, never in local agent memory: project-wide rules → the nearest `CLAUDE.md`; path-specific rules → `.claude/rules/`; how a system works → its owning doc under `docs/`; how a workflow runs → `.claude/skills/`. How to write docs: `docs/general/how-to/write-documentation.md`.

`docs/personal/` is the owner's gitignored, non-authoritative workspace; check it when the user mentions "my notes/tasks/plans". Never stage, commit, or move anything in it unless asked.

## Work in Progress

`docs/work-in-progress/` follows the work-in-progress layout of the `/scope` skill (`~/.claude/skills/scope/SKILL.md`), which owns it together with `/next-task` and `/work-queue`; read it there before adding a question, task or idea. Never restate that layout in this repo.

## Commit & PR Conventions

- Lowercase, single-line, present tense: `<category>: <short description>` (e.g. `pkmn: add randomlocke rules`). The prefix is the category alone, never a project or game path (`pkmn:`, not `pkmn/games/anil:`). Body only if genuinely complex.
- No agent signatures or co-author trailers, in commits or PRs.
- Never force push.
- Never commit secrets.
