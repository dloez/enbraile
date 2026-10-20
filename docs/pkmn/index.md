# pkmn

The group's Pokémon projects: our Randomlocke of Pokémon Añil and the tools built around it. Code lives in `pkmn/`; its docs live here.

## Domains

What every Pokémon project shares (`domains/<domain>/`).

| Domain | Description |
|--------|-------------|

## Games

What belongs to one series' game (`games/<game>/`): its code in `pkmn/games/<game>/`, its docs in `docs/pkmn/games/<game>/`.

| Game | Series | Description |
|------|--------|-------------|
| Añil | First | Pokémon Añil's scripts, in `pkmn/games/anil/`. The Open Sheet export: [explanation](games/anil/explanation/open-sheet-export.md), [JSON reference](games/anil/reference/open-sheet-json.md), [how to run and share it](games/anil/how-to/run-the-open-sheet-export.md) |

## Projects

Each project's design docs live in `<project>/`, its code in `pkmn/<project>/`.

| Project | Status | Description |
|---------|--------|-------------|
| Open Sheet | Built | Exports a player's shared Pokémon and items to JSON and shows them in a web app, for open-sheet fights: the export lives in Añil's game folder, the web app in the Site ([explanation](site/explanation/open-sheet.md)) |
| Site | Team Analysis built | The web app at `pkmn.enbraile.vip`, code in `pkmn/site/`: a home page listing the tools and Open Sheet at `/open-sheet`, which imports exports into tabs and shows each in a PC with a summary and a bag, where named teams are built, analysed, and copied to and pasted from Showdown; Team Analysis at `/team-analysis`, PokeGraph's team analysis with its pool and compare views, also shown in Open Sheet's Team view ([scope](../work-in-progress/team-analysis-discovery.md)). [Explanation](site/explanation/site.md), [Open Sheet](site/explanation/open-sheet.md), [how to run and deploy it](site/how-to/run-and-deploy-the-site.md) |
| Wonder | Not migrated | AI agent that plays its own run of the Randomlocke and is an optional opponent each gym round; lives outside Enbraile for now |
