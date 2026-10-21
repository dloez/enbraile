# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn: update series 1's rulebook with the latest changes

The group's rules have changed since Wonder's rulebook was written; series 1's rulebook takes those changes.

**Do:**
- [ ] Get the list of changes from the owner, rule by rule.
- [ ] Apply them to `docs/pkmn/series/1/` (rules, dictionary, format), each change dated in the owning doc's Decisions.
- [ ] Note every change the mod (`pkmn/games/anil/src/anil/mod/`), the rules guard or `anil check` enforces, as a new entry in this queue; this entry changes docs only.

**Acceptance:**
- Claude-run: every link under `docs/pkmn/series/1/` resolves; each change appears in the rulebook and in a dated decision.
- Human-run: read the updated rulebook and confirm it is the one you play.
- Reuse: `docs/pkmn/series/1/` from the entry before.
- Neighbors: none.
- Forbidden: changing code; guessing a rule not given by the owner.

**Touches:** `docs/pkmn/series/1/`, `docs/work-in-progress/tasks.md`
**Needs the author:** which rules changed, and how? Also: are the two League rules dated 2026-10-17 (the opponent's box sheet is known before a match; clauses mean Smogon's) settled? They came from uncommitted edits in Wonder's working tree. And with eggs opening on league wins only, at most 8 of the mod's 16 eggs can open: does the egg count change?

## pkmn/games/anil: check the mod against the live game

`anil check NAME|GROUP` proves each rule of the mod on the real game, as `wonder check` does ([Surfaces](anil-tooling-discovery.md#surfaces)).

**Do:**
- [ ] Copy the rest of Wonder's `harness/check.py` into `src/anil/harness/check.py` (which already holds the game-database check) with its groups, dropping checks of anything not migrated (the egg guard, real runs, the panel).
- [ ] Docs: `docs/pkmn/games/anil/how-to/check-the-mod.md`; Wonder's randomlocke-design "How the Checks Run" section and its Checks decisions into `docs/pkmn/games/anil/explanation/randomlocke-design.md`; the root `CLAUDE.md`'s no-tests rule names `anil check` as a tool that runs the game, not a test runner.
- [ ] Update the lines that say `anil check` is not here yet: Damage Calc Design → Checks ("Neither is in `anil.harness.check` yet", and its `wonder check calc` / `calc-moves`), Runtime Design → Project Layout (the `anil.harness.check` seam) and the Runtime Reference's intro (`check` among the commands `anil` does not have yet).

**Acceptance:**
- Claude-run: the gate; `uv run anil check all` passes, with the time it took; compare its check list with `wonder check all`'s and name every check dropped.
- Human-run: none beyond reading the dropped-check list.
- Reuse: Wonder's `check.py`, copied.
- Neighbors: `src/anil/harness/rules.py`.
- Forbidden: pytest or any runner; wiring `anil check` into the gate.

**Touches:** `pkmn/games/anil/src/`, `docs/pkmn/games/anil/`, `CLAUDE.md`
**Needs the author:** the unattended pass of 2026-10-21 was stopped by Claude Code's auto-mode permission check after copying Wonder's 8,935-line `check.py` (later edits, lint and even reads in the worktree were denied as "Untrusted Code Integration" / "Irreversible Local Destruction"). Its partial copy, renamed but not linted, is on branch `wq/anil-check`. Allow this work (or run it attended with `/next-task`), and say whether to build on that branch or start over.

## pkmn/games/anil: keep or drop the League guard

The rules guard refuses League entry below level 75 and items inside the League ([Rules Engine Design → Coverage](../pkmn/games/anil/explanation/rules-engine-design.md#coverage)), which were Wonder's own rules; series 1's rulebook does not carry them.

**Do:**
- [ ] With the owner's answer, keep the guard and add the rules to `docs/pkmn/series/1/reference/rules.md`, or drop `LEAGUE_RULE`, `league_refusal`, `league_item_refusal` and the `league` blocks from `src/anil/harness/rules.py` and the doc's rows (and any League case `anil check` has by then in `src/anil/harness/check.py`).

**Acceptance:**
- Claude-run: the gate; `uv run anil rules check walk --map 172` below 75 matches the answer.
- Human-run: none.
- Reuse: `src/anil/harness/rules.py`.
- Neighbors: none.
- Forbidden: deciding without the owner.

**Touches:** `pkmn/games/anil/src/anil/harness/rules.py`, `pkmn/games/anil/src/anil/harness/check.py`, `docs/pkmn/games/anil/explanation/rules-engine-design.md`, `docs/pkmn/series/1/`
**After:** pkmn: update series 1's rulebook with the latest changes
**Needs the author:** are "everyone at 75 before the League" and "no items inside the League" series 1 rules? Keep the guard (and write them into the rulebook) or drop it?

## pkmn/games/anil: bring the knowledge view's design over

`anil.harness.knowledge` came over whole with the calc, but its design is still only Wonder's (`docs/subsystems/harness/explanation/knowledge-view-design.md`), which Damage Calc Design and Battle Layer Design cite as "Knowledge View Design (Wonder: …)"; the harness design belongs under `docs/pkmn/` ([Goal and Success](anil-tooling-discovery.md#goal-and-success)).

**Do:**
- [ ] Copy it into `docs/pkmn/games/anil/explanation/knowledge-view-design.md` as the other layer docs were copied (a provenance line, names `anil`, sessions named as Wonder's), without its Panel section and agent references; repoint every "Knowledge View Design (Wonder: …)" citation in `docs/pkmn/`; add it to `docs/pkmn/index.md`'s Añil row and `pkmn/games/anil/CLAUDE.md`'s doc list.

**Acceptance:**
- Claude-run: ``grep -rn "Wonder: `docs/subsystems/harness/explanation/knowledge-view-design" docs/pkmn/`` prints nothing; every relative link under `docs/pkmn/` resolves; the doc's names match `src/anil/harness/knowledge.py`.
- Human-run: none.
- Reuse: Wonder's doc, copied; `docs/pkmn/games/anil/explanation/damage-calc-design.md` → The Knowledge View.
- Neighbors: `docs/pkmn/games/anil/explanation/battle-layer-design.md`.
- Forbidden: changing code; rewriting decisions.

**Touches:** `docs/pkmn/games/anil/explanation/`, `docs/pkmn/index.md`, `pkmn/games/anil/CLAUDE.md`

## pkmn/games/anil: fold the Añil tooling scope into the game's docs

Once no entry links [Añil Tooling: Discovery](anil-tooling-discovery.md), its lasting content moves to its permanent place and it is deleted ([Lifecycle](index.md#lifecycle)). Runtime Design → Project Layout cites "the discovery's renames".

**Do:**
- [ ] Move every answer of `anil-tooling-discovery.md` not already in `docs/pkmn/` or `docs/general/` into its owning doc's Decisions, dated as the scope dates it; repoint every mention of it, then delete it and drop it from the Work in Progress lists of `docs/index.md` and `docs/work-in-progress/index.md`.

**Acceptance:**
- Claude-run: `grep -rn "anil-tooling-discovery\|the discovery's" docs/ CLAUDE.md pkmn/ --include=*.md` prints nothing; every relative link under `docs/` resolves; the two Work in Progress lists name the same docs.
- Human-run: from a clean clone, walk the scope's "When is it done?": `anil install`, a new game starting the Randomlocke, `anil install --harness`, `anil run`, `anil state`, `anil go`, `anil battle …`, `anil rules …`, `anil check all`.
- Reuse: `docs/pkmn/games/anil/explanation/runtime-design.md` → Decisions.
- Neighbors: `docs/general/explanation/repository-layout.md`.
- Forbidden: changing code; turning a scope answer the owner did not give into a decision.

**Touches:** `docs/work-in-progress/anil-tooling-discovery.md`, `docs/work-in-progress/index.md`, `docs/index.md`, `docs/pkmn/`, `docs/general/`
**After:** pkmn/games/anil: check the mod against the live game; pkmn/games/anil: bring Añil's game facts over; pkmn/games/anil: clear stale and Wonder-only lines from the runtime and layer docs; pkmn/games/anil: bring the knowledge view's design over

## pkmn/site: decide on Team Analysis's explanatory legends

Team Analysis's compare-view legends carry explanatory lines (e.g. "shaded: best switch-in below 1.00 weighted bulk"), which the site's "no helper text" rule forbids ([Design System](../pkmn/site/reference/design-system.md)). The pool view has one of the same kind: "Shading is the percentile in the pool. L legendary, M mythical." (`src/team-analysis/components/pool-view.tsx`).

**Do:**
- [ ] Ask the owner whether the legends stay as an exception or go; record the answer in `docs/pkmn/site/explanation/site.md` → Decisions and apply it; if they stay, name the exception in `design-system.md`'s "No helper text" rule.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: open `/team-analysis` → Compare with two teams and check the legends match the decision.
- Reuse: none.
- Neighbors: none.
- Forbidden: removing a legend's key (colours, symbols) along with its prose.

**Touches:** `pkmn/site/src/team-analysis/`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/reference/design-system.md`
**Needs the author:** do the compare legends' explanations stay as an exception to "no helper text", or go? And the pool view's shading line?

## pkmn/site: decide whether tools may import each other's data

The design-system cleanup moved every shared component into `src/components/`, but Open Sheet still imports `carryTeam` from `src/team-analysis/drafts.ts` to hand a team over to Team Analysis. The cleanup read "no tool imports from another tool's folder" as covering UI only ([site.md → Decisions](../pkmn/site/explanation/site.md#decisions)), and that decision ("One shared version of each UI piece") is written as settled 2026-10-21 although the owner has not answered.

**Do:**
- [ ] Ask the owner; if the rule covers every import, move the hand-over into a shared module (e.g. `src/lib/`), and record the answer in `docs/pkmn/site/explanation/site.md` → Decisions, rewriting the "One shared version of each UI piece" entry, and `design-system.md`.

**Acceptance:**
- Claude-run: `npm run gate` from `pkmn/site/`; `grep -rn "@/team-analysis\|@/open-sheet" pkmn/site/src/open-sheet pkmn/site/src/team-analysis` matches the decision.
- Human-run: in Open Sheet, "Open in Team Analysis" still carries the team over.
- Reuse: `src/team-analysis/drafts.ts`.
- Neighbors: `src/analysis/`.
- Forbidden: changing the hand-over's behaviour.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`
**Needs the author:** does "no tool imports from another tool's folder" cover data hand-overs like `carryTeam`, or only UI?
