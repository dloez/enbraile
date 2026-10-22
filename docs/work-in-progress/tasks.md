# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

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
