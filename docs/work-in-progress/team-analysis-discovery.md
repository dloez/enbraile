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
A: The module is `pkmn/site/src/analysis/`: `dex.ts` (generations, the 18 types, availability), `chart.ts` (type matchups, matchup abilities, move special cases), `paste.ts` (the Showdown parser), `member.ts` (real stats, moves, move tags), `pool.ts` (the pool, its statistics and legality), `team.ts` (defence, synergy, offence, weighted values, archetype, roles, checklist) and `samples.ts` (PokeGraph's sample teams). Open Sheet's `src/open-sheet/analysis.ts` keeps only what reads Open Sheet's own members (speed order, defensive chart, coverage), on the shared chart and types, and its Summary keeps those three panels, on the same rules as today, beside the archetype and checklist.
**Why:** those three functions take Open Sheet's members and slots; moving them into the module would make it depend on Open Sheet. _(2026-10-17)_

**Q: Which abilities change a matchup?**
A: One table for the site, PokeGraph's: Levitate and Earth Eater (Ground), Flash Fire and Well-Baked Body (Fire), Water Absorb and Storm Drain (Water), Volt Absorb, Lightning Rod and Motor Drive (Electric), Sap Sipper (Grass) as immunities; Dry Skin (immune to Water, ×1.25 from Fire); Thick Fat (Fire and Ice), Heatproof and Water Bubble (Fire) and Purifying Salt (Ghost) as halving; Fluffy (×2 from Fire); and Wonder Guard. An ability counts only from Gen 3 and in a generation that has it. Open Sheet reads it in Gen 9, which changes nothing there: the abilities it adds are Gen 7–9 ones, and the mod only rolls the 164 Gen 1–5 abilities ([Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md)).
**Why:** forced by that evidence: one table serves both places with no change to Open Sheet's results. _(2026-10-17)_

**Q: Which Pokémon make up a pool?**
A: The species and formes Showdown lists for the pool's generation that it has not marked as later content (`isNonstandard` "Future"; "Past" ones stay, since a Gen 9 Custom Game fields them), leaving out battle-only formes, Megas, Primals, Gigantamax and Totem formes, and any forme whose types and base stats are its base species' (Gastrodon-East, the Deerling seasons). Legendary is Showdown's Restricted Legendary or Sub-Legendary tag, mythical its Mythical tag, not fully evolved its generation's `nfe`. Moves follow the same line: a "Future" move is ignored, as PokeGraph's `notInGen` did, and a "Past" one counts. The pools come out a little larger than PokeGraph's PokeAPI-built ones (fully evolved, any BST: 684 against 601 in Gen 9, 379 against 346 in Gen 5), and PokeGraph's four sample teams get the same archetype ranking, within 0.01, in both generations.
**Why:** build choices made while porting, measured against PokeGraph run on its own cached data. _(2026-10-17)_

## Surfaces

**Q: What does it look like?**
A: As the [Team Analysis Screens](https://claude.ai/artifact/4tyDvGNZXHqSRAvABaszfH) design in Claude Design, signed off by the owner on 2026-10-17: the Analyse view (pool bar, paste and team strip, archetype, checklist, graph with its selection panel, archetype map, speed tiers, members, matrices), the Pool view, the Compare view, Open Sheet's Team view with the Analysis section (Summary, Graph, Archetype, Members, Matrices, and a pool chip), and Analyse on a phone. It follows the site's single dark theme, fonts and tokens.

**Q: What draws the graph and the charts?**
A: Cytoscape.js, pinned, for the team graph: dragging, its layouts and PNG export. The radar, archetype map, histograms and bars are the site's own SVG components, coloured from the theme tokens.
**Why:** the owner: the graph's drag and force layout are what a library buys; the charts are simple enough without one. _(2026-10-17)_

**Q: What does Team Analysis keep between visits?**
A: The pasted team, the compare slots and the pool rules, in `localStorage`, per browser, as small drafts; a missing or unreadable draft starts empty.
**Why:** the owner chose `localStorage` over a Dexie database. _(2026-10-17)_

**Q: Which pool does Open Sheet's analysis rank a team against?**
A: Showdown's Gen 9 data with species introduced up to Gen 5, fully evolved, no BST cap: Añil's roster under the rules league fights run. The pool chip names it and does not change it.
**Why:** the owner. Fights are a Gen 9 Custom Game ([Open Sheet discovery](open-sheet-site-discovery.md#interfaces-and-integration)). _(2026-10-17)_

## References

- PokeGraph: `~/pokegraph/README.md`; the logic in `static/js/analysis.js`, `data.js`, `pool.js`, `types.js`, `compare.js`, `parser.js`; the graph in `graph.js`
- [Open Sheet: Site Discovery](open-sheet-site-discovery.md)
- `@pkmn/dex`: https://github.com/pkmn/ps
