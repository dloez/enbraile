# pkmn

The group's Pokémon projects: our Randomlocke of Pokémon Añil and the tools built around it. Code lives in `pkmn/`; its docs live here.

## Domains

What every Pokémon project shares (`domains/<domain>/`).

| Domain | Description |
|--------|-------------|

## Projects

Each project's design docs live in `<project>/`, its code in `pkmn/<project>/`.

| Project | Status | Description |
|---------|--------|-------------|
| Open Sheet | Built | Exports a player's shared Pokémon and items to JSON and shows them in a web app, for open-sheet fights: the export lives in Tools, the web app in the Site ([explanation](site/explanation/open-sheet.md)) |
| Site | Team Analysis built | The web app at `pkmn.enbraile.vip`, code in `pkmn/site/`: a home page listing the tools and Open Sheet at `/open-sheet`, which imports exports into tabs and shows each in a PC with a summary and a bag, where named teams are built, analysed, and copied to and pasted from Showdown; Team Analysis at `/team-analysis`, PokeGraph's team analysis with its pool and compare views, also shown in Open Sheet's Team view ([scope](../work-in-progress/team-analysis-discovery.md)). [Explanation](site/explanation/site.md), [Open Sheet](site/explanation/open-sheet.md), [how to run and deploy it](site/how-to/run-and-deploy-the-site.md) |
| Tools | Active | Small scripts in `pkmn/tools/`. The Open Sheet export: [explanation](tools/explanation/open-sheet-export.md), [JSON reference](tools/reference/open-sheet-json.md), [how to run and share it](tools/how-to/run-the-open-sheet-export.md) |
| Wonder | Not migrated | AI agent that plays its own run of the Randomlocke and is an optional opponent each gym round; lives outside Enbraile for now |
