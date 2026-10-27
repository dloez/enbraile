# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Compare's Matchups grid

Compare's old Head-to-head matrix returns as a Matchups grid under the board's scoreboard and calc ([Team Builder → Decisions](../../pkmn/site/explanation/team-builder.md#decisions), 2026-10-27). The reader picks two of the compared teams; one team's members are the rows, the other's the columns, each named by text; each cell gives the best hit both ways as % of HP, through the module's `calcHit`, and which of the two moves first at their real Speed; a click on a cell loads that pair into the calc.

**Do:**
- [ ] Owner-run: design the grid on the Site v2 Screens canvas, desktop and phone, and sign it off; freeze the boards into `pkmn/site/design/`.
- [ ] Build it from the frozen boards.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, compare three teams, pick two for the grid, read a cell against the calc, click it and see the calc load that pair.
- Human-run: on a phone and on desktop, read a grid for two real teams.
- Reuse: `calcHit` and `attacks` in `src/analysis/compare.ts`; the old matrix in `git show 2e49ee9^:pkmn/site/src/team-analysis/components/compare-view.tsx` (`HeadToHead`).
- Neighbors: the Head to head calc in `src/teams/components/compare-view.tsx`.
- Forbidden: building before the boards are signed off and frozen.

**Touches:** `pkmn/site/src/teams/components/compare-view.tsx`, `pkmn/site/src/analysis/compare.ts`, `pkmn/site/design/`, `docs/pkmn/site/explanation/team-builder.md`
**Needs the author:** the canvas design and its sign-off.
