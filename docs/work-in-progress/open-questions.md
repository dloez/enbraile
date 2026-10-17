# Open Questions

Everything not yet decided. Never resolve one silently in code; close it as described in [Recording Decisions](../general/how-to/write-documentation.md#recording-decisions).

## Shared Pokémon material before Wonder moves

Whether the group's shared Pokémon material (the Randomlocke rulebook and competition format, the Randomlocke package, the Añil game facts) moves into `pkmn/` now or waits for Wonder's migration. It all lives in Wonder today.

Owner: [Repository Layout](../general/explanation/repository-layout.md).

## Team Analysis: pool in Open Sheet

Which pool Open Sheet's analysis ranks a team against: Showdown's Gen 9 data with species up to Gen 5 (where league fights run, with Añil's roster), the tab's own sheet, or a pool the reader sets as in Team Analysis. The design shows a fixed chip, "Gen 1–5 species · fully evolved". PokeGraph has one generation setting for both the data and the species, which this case splits.

Owner: [Team Analysis: Discovery](team-analysis-discovery.md).

## Team Analysis: graph and charts

What draws the team graph and the charts. PokeGraph uses Cytoscape.js for the graph (dragging, four layouts, PNG export) and Chart.js for the radar, map, speed bars and histograms. The design's charts are simple enough for the site's own SVG components in its theme tokens; the graph's drag and force layout are what a library buys.

Owner: [Team Analysis: Discovery](team-analysis-discovery.md).

## Team Analysis: stored drafts

Where Team Analysis keeps the pasted team, the compare slots and the pool rules between visits: a Dexie database like Open Sheet's, or `localStorage` as PokeGraph's drafts are.

Owner: [Team Analysis: Discovery](team-analysis-discovery.md).
