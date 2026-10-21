# pkmn

The group's Pokémon projects: the series we play, the games they are played on, and the tools built around them. Code lives in `pkmn/`; its docs live here.

## Domains

What every Pokémon project shares (`domains/<domain>/`).

| Domain | Description |
|--------|-------------|

## Series

One playthrough of a game by the group, numbered, each with its own rulebook (`series/<n>/`). A game may be replayed in a later series ([Repository Layout → Games and Series](../general/explanation/repository-layout.md#games-and-series)).

| Series | Game | Description |
|--------|------|-------------|
| 1 | Añil | The group's Randomlocke of Pokémon Añil: [rules](series/1/reference/rules.md), the complete rulebook of the package and the group's league, eggs and final tournament; [dictionary](series/1/reference/dictionary.md); [competition format](series/1/explanation/competition-format.md) |

## Games

What belongs to one game (`games/<game>/`): its code in `pkmn/games/<game>/`, its docs in `docs/pkmn/games/<game>/`.

| Game | Series | Description |
|------|--------|-------------|
| Añil | 1 | Pokémon Añil's tooling, in `pkmn/games/anil/`. The `anil` command installs the game with the Randomlocke mod, and with the bridge launches, reads, drives, snapshots and replays it: [runtime design](games/anil/explanation/runtime-design.md), [runtime reference](games/anil/reference/runtime.md), [Randomlocke design](games/anil/explanation/randomlocke-design.md), [how to install the game](games/anil/how-to/install-the-game.md), [how to run the harness](games/anil/how-to/run-the-harness.md). The Open Sheet export: [explanation](games/anil/explanation/open-sheet-export.md), [JSON reference](games/anil/reference/open-sheet-json.md), [how to run and share it](games/anil/how-to/run-the-open-sheet-export.md) |

## Projects

Each project's design docs live in `<project>/`, its code in `pkmn/<project>/`.

| Project | Status | Description |
|---------|--------|-------------|
| Open Sheet | Built | Exports a player's shared Pokémon and items to JSON and shows them in a web app, for open-sheet fights: the export lives in Añil's game folder, the web app in the Site ([explanation](site/explanation/open-sheet.md)) |
| Site | Team Analysis built | The web app at `pkmn.enbraile.vip`, code in `pkmn/site/`: a home page listing the tools and Open Sheet at `/open-sheet`, which imports exports into tabs and shows each in a PC with a summary and a bag, where named teams are built, analysed, and copied to and pasted from Showdown; Team Analysis at `/team-analysis`, PokeGraph's team analysis with its pool and compare views, also shown in Open Sheet's Team view ([scope](../work-in-progress/team-analysis-discovery.md)). [Explanation](site/explanation/site.md), [Open Sheet](site/explanation/open-sheet.md), [design system](site/reference/design-system.md), [how to add a page](site/how-to/add-a-page-to-the-site.md), [how to run and deploy it](site/how-to/run-and-deploy-the-site.md) |
| Wonder | Not migrated | AI agent that plays its own run of Añil's Randomlocke; lives outside Enbraile for now |
