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

## pkmn/games/anil: fight battles with the damage calc

`anil battle …` plays any in-game battle one command at a time, with the damage calc in its results ([Surfaces](anil-tooling-discovery.md#surfaces)).

**Do:**
- [ ] Copy `harness/{battle,calc,knowledge,team}.py` and their CLI commands, as they are apart from the renames.
- [ ] Docs: Wonder's battle layer and damage calc designs into `docs/pkmn/games/anil/explanation/`.

**Acceptance:**
- Claude-run: the gate; from a snapshot at a wild battle, `uv run anil battle fight <move>` prints the calc and the battle diff.
- Human-run: watch the move play in the game window.
- Reuse: Wonder's modules, copied.
- Neighbors: `src/anil/harness/menu.py`.
- Forbidden: the agent's battle policy or pilots.

**Touches:** `pkmn/games/anil/src/`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`
**After:** pkmn/games/anil: walk, talk and use the menus

## pkmn/games/anil: guard and audit the series rules

`anil rules check …`, `audit` and `freeze` refuse and audit actions against the rules, with the bridge's rules hooks, without the egg guard ([Data, Secrets and Config](anil-tooling-discovery.md#data-secrets-and-config)).

**Do:**
- [ ] Copy `harness/rules.py` without `EGG_RULE`, `egg_refusal` and any `runs` import; `wonder_rules.rb` as `anil_rules.rb`, putting `rules_bought` and `rules_shiny` back into `BRIDGE_KINDS` in `anil_record.rb` and filling the state's rules ledger; the CLI commands.
- [ ] Docs: Wonder's rules engine design into `docs/pkmn/games/anil/explanation/`, linking series 1's rulebook.

**Acceptance:**
- Claude-run: the gate; `uv run anil rules audit` on a running game prints the ledger; `grep -n -i "egg\|wonder fight" pkmn/games/anil/src/anil/harness/rules.py` shows no egg guard.
- Human-run: buy a banned mart item through `anil menu` and see it refused, naming the rule.
- Reuse: Wonder's `rules.py`, copied.
- Neighbors: `src/anil/harness/battle.py`.
- Forbidden: `runs`, rounds, pastes, Wonder fights.

**Touches:** `pkmn/games/anil/src/`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`
**After:** pkmn/games/anil: fight battles with the damage calc

## pkmn/games/anil: check the mod against the live game

`anil check NAME|GROUP` proves each rule of the mod on the real game, as `wonder check` does ([Surfaces](anil-tooling-discovery.md#surfaces)).

**Do:**
- [ ] Copy the rest of Wonder's `harness/check.py` into `src/anil/harness/check.py` (which already holds the game-database check) with its groups, dropping checks of anything not migrated (the egg guard, real runs, the panel).
- [ ] Docs: `docs/pkmn/games/anil/how-to/check-the-mod.md`; Wonder's randomlocke-design "How the Checks Run" section and its Checks decisions into `docs/pkmn/games/anil/explanation/randomlocke-design.md`; the root `CLAUDE.md`'s no-tests rule names `anil check` as a tool that runs the game, not a test runner.

**Acceptance:**
- Claude-run: the gate; `uv run anil check all` passes, with the time it took; compare its check list with `wonder check all`'s and name every check dropped.
- Human-run: none beyond reading the dropped-check list.
- Reuse: Wonder's `check.py`, copied.
- Neighbors: `src/anil/harness/rules.py`.
- Forbidden: pytest or any runner; wiring `anil check` into the gate.

**Touches:** `pkmn/games/anil/src/`, `docs/pkmn/games/anil/`, `CLAUDE.md`
**After:** pkmn/games/anil: guard and audit the series rules

## pkmn/games/anil: bring Añil's game facts over

Wonder's verified facts about Añil (`docs/domains/game/`) move into `docs/pkmn/games/anil/`, so the tooling's docs cite this repo ([Games and Series](anil-tooling-discovery.md#games-and-series)).

**Do:**
- [ ] Copy `docs/domains/game/reference/*` and `explanation/game-setup.md` into `docs/pkmn/games/anil/`, dropping rules (now in series 1) and agent references; repoint every "Wonder: `docs/domains/game/…`" and ``source: `docs/domains/game/…` `` citation in `docs/pkmn/`, including series 1's rulebook (whose `rules.md` also cites Wonder's runtime "Bridge Start", now in `docs/pkmn/games/anil/reference/runtime.md`).

**Acceptance:**
- Claude-run: `grep -rn "Wonder:\|docs/domains/game" docs/pkmn/` prints nothing (series 1's rulebook cites game facts as ``source: `docs/domains/game/…` ``); every relative link under `docs/pkmn/` resolves.
- Human-run: none.
- Reuse: Wonder's game docs, copied.
- Neighbors: `docs/pkmn/games/anil/reference/open-sheet-json.md`.
- Forbidden: rewriting facts; they were verified on the game.

**Touches:** `docs/pkmn/`
**After:** pkmn/games/anil: check the mod against the live game

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

## pkmn/site: fold the Team Analysis scope into the site docs

No entry links [Team Analysis: Discovery](team-analysis-discovery.md) any more, so its lasting content moves to its permanent place and it is deleted ([Lifecycle](index.md#lifecycle)). Permanent docs still cite it as their source (`docs/pkmn/site/explanation/site.md`, `open-sheet.md`, `docs/pkmn/index.md`'s Site row).

**Do:**
- [ ] Move every decision and fact of `team-analysis-discovery.md` not already in `docs/pkmn/site/` into its owning doc there (dated decisions in `site.md` or `open-sheet.md` → Decisions), then repoint every link to it and delete it.
- [ ] Drop Team Analysis from the Work in Progress lists of `docs/index.md` and `docs/work-in-progress/index.md`.

**Acceptance:**
- Claude-run: `grep -rn "team-analysis-discovery" docs/ CLAUDE.md pkmn/ --include=*.md` prints nothing; every relative link under `docs/` resolves; the two Work in Progress lists name the same docs.
- Human-run: none.
- Reuse: `docs/pkmn/site/explanation/site.md` → Decisions.
- Neighbors: `docs/pkmn/site/reference/design-system.md`.
- Forbidden: changing code; restating a fact the site docs already own; turning a scope answer the owner did not give into a decision.

**Touches:** `docs/work-in-progress/team-analysis-discovery.md`, `docs/work-in-progress/index.md`, `docs/index.md`, `docs/pkmn/index.md`, `docs/pkmn/site/`
