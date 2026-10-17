# Team Analysis: Discovery

The decisions behind bringing PokeGraph (`~/pokegraph`, a local vanilla-JS app with a Python proxy) into the pkmn site: its analysis becomes a shared module of `pkmn/site/`, a new Team Analysis tool, and a deeper analysis in [Open Sheet](open-sheet-site-discovery.md)'s Team view. Scoped with the owner on 2026-10-17.

## Goal and Success

**Q: What is being built?**
A: PokeGraph's team analysis, ported to TypeScript as one module the site shares, and used in two places: a new tool, Team Analysis, at `/team-analysis`, where a reader pastes a Showdown team; and Open Sheet's Team view, which analyses the team built from a sheet with the same module.
**Why:** the owner chose both places over the tool alone or Open Sheet alone. _(2026-10-17)_

**Q: Which of PokeGraph's features come over?**
A: All of them: the synergy, weakness, resistance and coverage graph; archetype classification with its fingerprint radar and bulk × offense map; the teambuilding checklist; member cards with real stats, pool percentiles and roles; the defensive and offensive matrices, as type multipliers or weighted by the pool; the pool analyzer; and comparing 2–4 teams, with the scoreboard and the head-to-head damage calc.
**Why:** the owner. _(2026-10-17)_

**Q: When is it done?**
A: `/team-analysis` is listed on the home page; a reader pastes a Showdown team, sets the pool, and sees everything PokeGraph shows, on desktop and phone; the Pool and Compare views work on that pool; in Open Sheet, a team's Team view shows the archetype, checklist and the deeper views, and its "Open in Team Analysis" button carries the team over.

## Scope Edges

**Q: What is out?**
A: pokepast.es links, and with them any Worker route; PokeAPI and PokeGraph's `tools/build_data.py`; PokeGraph's Python server.
**Why:** the owner kept the site static: pokepast.es sends no CORS headers, so a link would need a proxy on the Worker. _(2026-10-17)_

**Q: Does this change Open Sheet's own scope?**
A: Open Sheet's Team view still analyses the team alone and has no damage calc; comparing and the damage calc live in Team Analysis, which an Open Sheet team reaches through "Open in Team Analysis". See [Scope Edges](open-sheet-site-discovery.md#scope-edges) of the Open Sheet discovery.

## Interfaces and Integration

**Q: Where does the data come from?**
A: `@pkmn/dex`, already bundled in the site, through `Dex.forGen(n)` for the pool's generation, replacing PokeGraph's PokeAPI data and its generated `pokedex.json` and `typecharts.json`. Checked 2026-10-17 against `@pkmn/dex` 0.10.11: `forGen` returns past typings and stats (Gen 5 Clefable is Normal with 85 SpA; Gen 9's is Fairy with 95), Gen 1's single Special stat, the type-based physical/special split (Gen 3 Crunch is Special), species `tags` for Sub-Legendary, Restricted Legendary and Mythical, and `nfe` for not fully evolved. It also keeps later content in earlier generations (Moonblast and the Fairy type exist in `forGen(5)`), so moves, abilities and types are filtered by their `gen`, as PokeGraph's `notInGen` did.
**Why:** the owner chose `@pkmn/dex`, and the site already decided against runtime API calls ([Open Sheet discovery](open-sheet-site-discovery.md#interfaces-and-integration)). _(2026-10-17)_

**Q: How does a team get into Team Analysis?**
A: Pasted as Showdown text, parsed as PokeGraph's `parser.js` does (header, ability, level, Tera type, EVs, IVs, nature, moves; level 100 when no `Level:` line), or picked from the sample teams, or carried from an Open Sheet team.

**Q: How do the shared module and Open Sheet's current analysis fit together?**
A: Open Sheet's `src/open-sheet/analysis.ts` (speed order, defensive chart, coverage) becomes part of the shared module; Open Sheet's Summary keeps those three panels, on the same rules as today, beside the archetype and checklist.

## Surfaces

**Q: What does it look like?**
A: As the [Team Analysis Screens](https://claude.ai/artifact/4tyDvGNZXHqSRAvABaszfH) design in Claude Design: the Analyse view (pool bar, paste and team strip, archetype, checklist, graph with its selection panel, archetype map, speed tiers, members, matrices), the Pool view, the Compare view, Open Sheet's Team view with the Analysis section (Summary, Graph, Archetype, Members, Matrices, and a pool chip), and Analyse on a phone. It follows the site's single dark theme, fonts and tokens. Awaiting the owner's sign-off.

## Open

- See [Open Questions](open-questions.md#team-analysis-pool-in-open-sheet), [graph and charts](open-questions.md#team-analysis-graph-and-charts) and [stored drafts](open-questions.md#team-analysis-stored-drafts).

## References

- PokeGraph: `~/pokegraph/README.md`; the logic in `static/js/analysis.js`, `data.js`, `pool.js`, `types.js`, `compare.js`, `parser.js`; the graph in `graph.js`
- [Open Sheet: Site Discovery](open-sheet-site-discovery.md)
- `@pkmn/dex`: https://github.com/pkmn/ps
