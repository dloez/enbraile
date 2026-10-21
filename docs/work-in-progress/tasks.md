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
**After:** pkmn: give series 1 its rulebook and record games against series
**Needs the author:** which rules changed, and how? Also: are the two League rules dated 2026-10-17 (the opponent's box sheet is known before a match; clauses mean Smogon's) settled? They came from uncommitted edits in Wonder's working tree. And with eggs opening on league wins only, at most 8 of the mod's 16 eggs can open: does the egg count change?

## pkmn/games/anil: install the game with the Randomlocke mod

`uv run anil install` fetches the hash-checked Añil zip, extracts it into `pkmn/games/anil/game/`, and deploys it with the mod to the Windows working copy, so a new game there starts the Randomlocke ([Surfaces](anil-tooling-discovery.md#surfaces), [Data, Secrets and Config](anil-tooling-discovery.md#data-secrets-and-config)).

**Do:**
- [ ] Create the uv project `pkmn/games/anil/` (`pyproject.toml`, `src/anil/`, `anil` script, ruff and ty in a dev group, ruff config as Wonder's) and `pkmn/games/anil/CLAUDE.md` with the gate and the environment constraints.
- [ ] Copy `packages/randomlocke` into `src/anil/mod/` and `harness/{builds,game_files,deploy,windows}.py` into `src/anil/install/`, with the renames and defaults of the discovery doc; deploy writes the mod layer only (no bridge yet), `GAME_ROOT` is `pkmn/games/anil/game/`.
- [ ] `anil install [--build] [--no-cache] [--full]`: fetch then deploy.
- [ ] Gitignore `pkmn/games/anil/game/`. `export_data.py` and `generate_export_data.py` stay at their paths.
- [ ] Docs: `docs/pkmn/games/anil/explanation/` gets the install and mod design from Wonder's `runtime-design.md` (fetch, deploy, layers, stamp) and `randomlocke-design.md` (without the players/wonder zips), plus `how-to/install-the-game.md`; update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: the gate from `pkmn/games/anil/`; `uv run anil install` twice (second run copies nothing); `grep -rn -i wonder pkmn/games/anil/src` prints nothing.
- Human-run: open `%USERPROFILE%\Documents\Pokemon\Pokemon Anil-enbraile\Game.exe`, start a new game: the mode menus are skipped, the RULEBOOK item is in the bag, and box 50 holds 16 eggs.
- Reuse: Wonder's `game_files.py`, `deploy.py`, `builds.py`, `windows.py` and `packages/randomlocke`, copied.
- Neighbors: Wonder's `packages/harness` layout.
- Forbidden: the bridge layer, `anil package`, any agent import, changes to Wonder.

**Touches:** `pkmn/games/anil/pyproject.toml`, `pkmn/games/anil/uv.lock`, `pkmn/games/anil/src/`, `pkmn/games/anil/CLAUDE.md`, `.gitignore`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`

## pkmn/games/anil: generate the export's data from the repo

`generate_export_data.py` reads the mod's data and version from `src/anil/mod/` and the game from `game/base/es-v4.14/`, so no Wonder checkout is needed ([Reuse](anil-tooling-discovery.md#reuse)).

**Do:**
- [ ] Point `generate_export_data.py` at the in-repo paths; drop the Wonder argument.
- [ ] Regenerate `export_data.py`; update `docs/pkmn/games/anil/how-to/run-the-open-sheet-export.md` and every doc citing "Wonder's data" for the export.

**Acceptance:**
- Claude-run: `uv run pkmn/games/anil/generate_export_data.py`; `git diff --stat pkmn/games/anil/export_data.py` shows no data change against the Wonder-generated one; `grep -n wonder pkmn/games/anil/generate_export_data.py` prints nothing.
- Human-run: run the export on your save as the how-to says; the file opens in Open Sheet as before.
- Reuse: the mod's `data/` and `sources.py` in `src/anil/mod/`.
- Neighbors: none.
- Forbidden: moving `export_data.py` (players run it from its raw GitHub URL).

**Touches:** `pkmn/games/anil/generate_export_data.py`, `pkmn/games/anil/export_data.py`, `docs/pkmn/games/anil/`
**After:** pkmn/games/anil: install the game with the Randomlocke mod

## pkmn/games/anil: launch the game with the bridge and read its state

`anil install --harness` adds the bridge; `anil run` launches the game paused under it, and `anil state`, `eval`, `stack`, `shot`, `rng`, `control`, `speed`, `snapshot save|restore|list`, `replay` and `stop` work against it ([Surfaces](anil-tooling-discovery.md#surfaces)).

**Do:**
- [ ] Copy `packages/bridge` into `src/anil/bridge/` without `wonder_run.rb` and its hooks, renamed (`AnilBridge`, `anil_*.rb`); deploy's bridge layer behind `--harness`, with frame sync off.
- [ ] Copy `harness/{settings,lock,launch,investigate,context,state,changes,steps,snapshot,replay,showdown}.py` into `src/anil/harness/`, without `--real`, takeover, the panel and agent settings; the CLI commands above in `src/anil/cli.py`, with `cli/state_text.py`.
- [ ] Docs: the bridge, launch, state, snapshot and replay parts of Wonder's `runtime-design.md` and the matching facts of `domains/game/reference/runtime.md` into `docs/pkmn/games/anil/`, with `how-to/run-the-harness.md`.

**Acceptance:**
- Claude-run: the gate; `uv run anil install --harness`, `uv run anil run`, `uv run anil state` prints the party, `uv run anil snapshot save t && uv run anil snapshot restore t`, `uv run anil stop`.
- Human-run: during `anil run`, the game window opens, and after `anil control` hands over, you can play it.
- Reuse: Wonder's bridge and harness modules, copied.
- Neighbors: `src/anil/install/`.
- Forbidden: `panel`, `runs`, `memory`, pydantic-ai, any import of `agent` or `arena`.

**Touches:** `pkmn/games/anil/src/`, `pkmn/games/anil/pyproject.toml`, `pkmn/games/anil/uv.lock`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`
**After:** pkmn/games/anil: install the game with the Randomlocke mod

## pkmn/games/anil: walk, talk and use the menus

`anil go`, `interact`, `dialog`, `menu …`, `world`, `nav check` and `db …` drive the game through the world, its dialogs and menus, over the game database ([Surfaces](anil-tooling-discovery.md#surfaces)).

**Do:**
- [ ] Copy `harness/{navigate,world,dialog,menu,storage,gamedb,random,progression}.py` (with their data), with their CLI commands.
- [ ] Docs: Wonder's navigation, dialog, menu and game database designs into `docs/pkmn/games/anil/explanation/`, without agent references.

**Acceptance:**
- Claude-run: the gate; `uv run anil db check`, `uv run anil nav check`, and `uv run anil go` to a map in the opening while `anil run` is up.
- Human-run: watch `anil go` walk the player and `anil interact` open a dialog in the game window.
- Reuse: Wonder's modules, copied.
- Neighbors: `src/anil/harness/state.py`.
- Forbidden: `goals/`, `tools/`, any agent import.

**Touches:** `pkmn/games/anil/src/`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`
**After:** pkmn/games/anil: launch the game with the bridge and read its state

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
- [ ] Copy `harness/rules.py` without `EGG_RULE`, `egg_refusal` and any `runs` import; `wonder_rules.rb` as `anil_rules.rb`; the CLI commands.
- [ ] Docs: Wonder's rules engine design into `docs/pkmn/games/anil/explanation/`, linking series 1's rulebook.

**Acceptance:**
- Claude-run: the gate; `uv run anil rules audit` on a running game prints the ledger; `grep -n -i "egg\|wonder fight" pkmn/games/anil/src/anil/harness/rules.py` shows no egg guard.
- Human-run: buy a banned mart item through `anil menu` and see it refused, naming the rule.
- Reuse: Wonder's `rules.py`, copied.
- Neighbors: `src/anil/harness/battle.py`.
- Forbidden: `runs`, rounds, pastes, Wonder fights.

**Touches:** `pkmn/games/anil/src/`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`
**After:** pkmn/games/anil: fight battles with the damage calc; pkmn: give series 1 its rulebook and record games against series

## pkmn/games/anil: check the mod against the live game

`anil check NAME|GROUP` proves each rule of the mod on the real game, as `wonder check` does ([Surfaces](anil-tooling-discovery.md#surfaces)).

**Do:**
- [ ] Copy `harness/check.py` with its groups, dropping checks of anything not migrated (the egg guard, real runs, the panel).
- [ ] Docs: `docs/pkmn/games/anil/how-to/check-the-mod.md`; the root `CLAUDE.md`'s no-tests rule names `anil check` as a tool that runs the game, not a test runner.

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
- [ ] Copy `docs/domains/game/reference/*` and `explanation/game-setup.md` into `docs/pkmn/games/anil/`, dropping rules (now in series 1) and agent references; repoint every "Wonder: `docs/domains/game/…`" and ``source: `docs/domains/game/…` `` citation in `docs/pkmn/`, including series 1's rulebook.

**Acceptance:**
- Claude-run: `grep -rn "Wonder:\|docs/domains/game" docs/pkmn/` prints nothing (series 1's rulebook cites game facts as ``source: `docs/domains/game/…` ``); every relative link under `docs/pkmn/` resolves.
- Human-run: none.
- Reuse: Wonder's game docs, copied.
- Neighbors: `docs/pkmn/games/anil/reference/open-sheet-json.md`.
- Forbidden: rewriting facts; they were verified on the game.

**Touches:** `docs/pkmn/`
**After:** pkmn/games/anil: check the mod against the live game

## pkmn/site: decide on Team Analysis's explanatory legends

Team Analysis's compare-view legends carry explanatory lines (e.g. "shaded: best switch-in below 1.00 weighted bulk"), which the site's "no helper text" rule forbids ([Design System](../pkmn/site/reference/design-system.md)).

**Do:**
- [ ] Ask the owner whether the legends stay as an exception or go; record the answer in `docs/pkmn/site/explanation/site.md` → Decisions and apply it.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: open `/team-analysis` → Compare with two teams and check the legends match the decision.
- Reuse: none.
- Neighbors: none.
- Forbidden: removing a legend's key (colours, symbols) along with its prose.

**Touches:** `pkmn/site/src/team-analysis/`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** do the compare legends' explanations stay as an exception to "no helper text", or go?

## pkmn/site: decide whether tools may import each other's data

The design-system cleanup moved every shared component into `src/components/`, but Open Sheet still imports `carryTeam` from `src/team-analysis/drafts.ts` to hand a team over to Team Analysis. The cleanup read "no tool imports from another tool's folder" as covering UI only ([site.md → Decisions](../pkmn/site/explanation/site.md#decisions)).

**Do:**
- [ ] Ask the owner; if the rule covers every import, move the hand-over into a shared module (e.g. `src/lib/`), and record the answer in `docs/pkmn/site/explanation/site.md` → Decisions and `design-system.md`.

**Acceptance:**
- Claude-run: `npm run gate` from `pkmn/site/`; `grep -rn "@/team-analysis\|@/open-sheet" pkmn/site/src/open-sheet pkmn/site/src/team-analysis` matches the decision.
- Human-run: in Open Sheet, "Open in Team Analysis" still carries the team over.
- Reuse: `src/team-analysis/drafts.ts`.
- Neighbors: `src/analysis/`.
- Forbidden: changing the hand-over's behaviour.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`
**Needs the author:** does "no tool imports from another tool's folder" cover data hand-overs like `carryTeam`, or only UI?
