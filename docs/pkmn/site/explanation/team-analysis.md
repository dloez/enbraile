# Team Analysis

PokeGraph (`~/pokegraph`, a local vanilla-JS app with a Python proxy) is ported to TypeScript as one analysis module that [the pkmn site](site.md) shares, used in two places: Team Analysis, a tool at `/team-analysis` where a reader pastes a Showdown team, and the Analysis panel of the [team builder](team-builder.md#the-analysis), which analyses a stored team with the same module (Open Sheet's Team view until 2026-10-25). It was scoped with the owner on 2026-10-17.

Everything PokeGraph has comes over: the synergy, weakness, resistance and coverage graph; archetype classification with its fingerprint radar and bulk × offense map; the teambuilding checklist; member cards with real stats, pool percentiles and roles; the defensive and offensive matrices, as type multipliers or weighted by the pool; the pool analyzer; and comparing 2–4 teams, with the scoreboard and the head-to-head damage calc.

It is done when `/team-analysis` is listed on the home page; a reader pastes a Showdown team, sets the pool, and sees everything PokeGraph shows, on desktop and phone; the Pool and Compare views work on that pool; and in Open Sheet a team's Team view shows the archetype, checklist and the deeper views, and its "Open in Team Analysis" button carries the team over.

**Out:** pokepast.es links, and with them any server route; PokeAPI and PokeGraph's `tools/build_data.py`; PokeGraph's Python server.

## The Shared Module

The module is `pkmn/site/src/analysis/`: `dex.ts` (generations, the 18 types, availability), `chart.ts` (type matchups, matchup abilities, move special cases), `paste.ts` (the Showdown parser), `member.ts` (real stats, moves, move tags), `pool.ts` (the pool, its statistics and legality), `stats.ts` (the pool's distributions, histograms, type shares and stat correlations), `team.ts` (defence, synergy, offence, weighted values, archetype, roles, checklist), `compare.ts` (the compare scoreboard and the head-to-head damage calc), `sprite.ts` (members' sprite URLs) and `samples.ts` (PokeGraph's sample teams). Its panels are shared components ([Site Design System](../reference/design-system.md)).

The team builder's `src/teams/analysis.ts` keeps only what reads its own members (speed order, defensive chart, coverage), on the shared chart and types: those functions take the builder's members and slots, and moving them into the module would make it depend on the builder.

## Data

Game data is `@pkmn/dex`, through `Dex.forGen(n)` for the pool's generation, in place of PokeGraph's PokeAPI data and its generated `pokedex.json` and `typecharts.json`. Checked 2026-10-17 against `@pkmn/dex` 0.10.11: `forGen` returns past typings and stats (Gen 5 Clefable is Normal with 85 SpA; Gen 9's is Fairy with 95), Gen 1's single Special stat, the type-based physical/special split (Gen 3 Crunch is Special), species `tags` for Sub-Legendary, Restricted Legendary and Mythical, and `nfe` for not fully evolved. It also keeps later content in earlier generations (Moonblast and the Fairy type exist in `forGen(5)`), so moves, abilities and types are filtered by their `gen`, as PokeGraph's `notInGen` did.

**Matchup abilities.** One table serves the whole site, PokeGraph's: Levitate and Earth Eater (Ground), Flash Fire and Well-Baked Body (Fire), Water Absorb and Storm Drain (Water), Volt Absorb, Lightning Rod and Motor Drive (Electric), Sap Sipper (Grass) as immunities; Dry Skin (immune to Water, ×1.25 from Fire); Thick Fat (Fire and Ice), Heatproof and Water Bubble (Fire) and Purifying Salt (Ghost) as halving; Fluffy (×2 from Fire); and Wonder Guard. An ability counts only from Gen 3 and in a generation that has it. The team builder reads it in Gen 9, which changes nothing there: the abilities it adds are Gen 7–9 ones, and the mod only rolls the 164 Gen 1–5 abilities ([Save Export](save-export.md)).

**The pool.** A pool is the species and formes Showdown lists for its generation that it has not marked as later content (`isNonstandard` "Future"; "Past" ones stay, since a Gen 9 Custom Game fields them), leaving out battle-only formes, Megas, Primals, Gigantamax and Totem formes, any forme whose types and base stats are its base species' (Gastrodon-East, the Deerling seasons), and any forme with its base species' stats that a held item makes (Arceus's and Silvally's types, Genesect's Drives, Ogerpon's masks). A pool can also hold species to an earlier generation than its data (`speciesGen`), which a team's pool in the team builder can set ([Team Builder → The Pool](team-builder.md#the-pool)); the pool bar's Species up to row sets it, and a change of data generation lowers it only when it would exceed it. Legendary is Showdown's Restricted Legendary or Sub-Legendary tag, mythical its Mythical tag, not fully evolved its generation's `nfe`. Moves follow the same line: a "Future" move is ignored, as PokeGraph's `notInGen` did, and a "Past" one counts.

The pools come out a little larger than PokeGraph's PokeAPI-built ones (fully evolved, any BST: 647 against 601 in Gen 9, 363 against 346 in Gen 5), and PokeGraph's four sample teams get the same archetype ranking, within 0.01, in both generations, measured on 2026-10-17 against PokeGraph run on its own cached data.

## Teams In and Out

A team comes in pasted as Showdown text, parsed as PokeGraph's `parser.js` does (header, ability, level, Tera type, EVs, IVs, nature, moves; level 100 when no `Level:` line), or picked from the sample teams.

The team builder reaches the module through the team's Showdown text, the same one "Copy for Showdown" writes: the shared parser reads it in Gen 9, so members with an unknown species are left out as they are there, with the export's real IVs and the league's 1 EV in every stat, which changes no Level 50 stat. Its analysis ranks a team against the team's own pool, which starts from its series' default, series 1's being Showdown's Gen 9 data with species introduced up to Gen 5, fully evolved, no BST cap ([Team Builder → The Pool](team-builder.md#the-pool)).

Team Analysis keeps the pasted team, the compare slots and the pool rules between visits in `localStorage` (`team-analysis:drafts`), per browser, as small drafts; a missing or unreadable draft starts empty.

## Look

The [Team Analysis Screens](https://claude.ai/artifact/4tyDvGNZXHqSRAvABaszfH) design in Claude Design, signed off by the owner on 2026-10-17, set it: the Analyse view (pool bar, paste and team strip, archetype, checklist, graph with its selection panel, archetype map, speed tiers, members, matrices), the Pool view, the Compare view, Open Sheet's Team view with the Analysis section (Summary, Graph, Archetype, Members, Matrices, and a pool chip), and Analyse on a phone, in the site's single dark theme, fonts and tokens.

Cytoscape.js, pinned, draws the team graph: dragging, its layouts and PNG export. The radar, archetype map, histograms and bars are the site's own SVG components, coloured from the theme tokens.

The graph's PNG export holds the graph without sprites: it swaps them for the members' type-coloured rings and names, then puts them back. On screen the sprites load without a CORS request.

## Decisions

- **PokeGraph's analysis as one shared module, used by a Team Analysis tool and by Open Sheet's Team view, now the team builder's Analysis.** **Why:** the owner chose both places over the tool alone or Open Sheet alone. _(owner, 2026-10-17)_
- **All of PokeGraph's features come over.** _(owner, 2026-10-17)_
- **No pokepast.es links, PokeAPI, `build_data.py` or Python server.** **Why:** the owner kept the site static: pokepast.es sends no CORS headers, so a link would need a server-side proxy. _(owner, 2026-10-17)_
- **`@pkmn/dex` through `Dex.forGen(n)` for the data.** **Why:** the owner chose it, and the site already decided against runtime API calls ([Team Builder → What It Reads](team-builder.md#what-it-reads)). _(owner, 2026-10-17)_
- **The team builder's own analysis (Open Sheet's until 2026-10-25) keeps only its speed order, defensive chart and coverage, on the shared chart and types.** **Why:** those functions take its members and slots; moving them into the module would make it depend on the builder. _(settled 2026-10-17)_
- **One matchup-ability table for the site, PokeGraph's.** **Why:** forced by evidence: Open Sheet's exports only roll Gen 1–5 abilities, so the table serves both places with no change to Open Sheet's results. _(settled 2026-10-17)_
- **The pool rules** (Showdown's species minus "Future" content, battle-only, cosmetic and item-made formes; `speciesGen`; legendary, mythical and not fully evolved from Showdown's tags and `nfe`; "Future" moves ignored): build choices made while porting, measured against PokeGraph run on its own cached data. _(settled 2026-10-17)_
- **The Team Analysis Screens design.** _(owner, 2026-10-17)_
- **Cytoscape.js, pinned, for the graph; the site's own SVG components for the charts.** **Why:** the owner: the graph's drag and force layout are what a library buys; the charts are simple enough without one. _(owner, 2026-10-17)_
- **The graph's PNG export swaps sprites for type-coloured rings and names.** **Why:** forced by evidence: Showdown's sprite server sends no `Access-Control-Allow-Origin` header (checked 2026-10-17), so a canvas holding its sprites cannot be read back into an image. _(settled 2026-10-17)_
- **Team Analysis's drafts in `localStorage`.** **Why:** the owner chose `localStorage` over a Dexie database. _(owner, 2026-10-17)_
- **The team builder reaches the module through the team's Showdown text,** as Open Sheet's Team view did. **Why:** build choice: one path from a team to the module, already tested by the Showdown copy. _(settled 2026-10-17)_
- **Series 1's teams are ranked against Gen 9 data with species up to Gen 5, fully evolved, no BST cap, the series' default pool, which each team can change.** **Why:** the owner; fights are a Gen 9 Custom Game. _(owner, 2026-10-17; a pool per team, owner, discovery, built 2026-10-25, replaces one fixed pool the chip did not change)_
