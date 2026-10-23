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
| Añil | 1 | Pokémon Añil's tooling, in `pkmn/games/anil/`. The `anil` command installs the game with the Randomlocke mod, and with the bridge launches, reads, drives, snapshots and replays it, walks, talks and uses its menus over a game database, fights its battles with the damage calc, and judges actions against the series rules: [runtime design](games/anil/explanation/runtime-design.md), [runtime reference](games/anil/reference/runtime.md), [navigation design](games/anil/explanation/navigation-design.md), [dialog design](games/anil/explanation/dialog-design.md), [menu design](games/anil/explanation/menu-design.md), [battle layer design](games/anil/explanation/battle-layer-design.md), [damage calc design](games/anil/explanation/damage-calc-design.md), [knowledge view design](games/anil/explanation/knowledge-view-design.md), [game database design](games/anil/explanation/game-database-design.md), [rules engine design](games/anil/explanation/rules-engine-design.md), [Randomlocke design](games/anil/explanation/randomlocke-design.md), [how to install the game](games/anil/how-to/install-the-game.md), [how to run the harness](games/anil/how-to/run-the-harness.md), [how to check the mod](games/anil/how-to/check-the-mod.md). The game's verified facts: [game setup](games/anil/explanation/game-setup.md), [dictionary](games/anil/reference/dictionary.md), [battle mechanics](games/anil/reference/battle-mechanics.md), [game data](games/anil/reference/game-data.md), [IVs and EVs](games/anil/reference/ivs-evs.md), [League, Pokévial and candy cups](games/anil/reference/league.md), [level caps](games/anil/reference/level-caps.md), [menus](games/anil/reference/menus.md), [Nuzlocke](games/anil/reference/nuzlocke.md), [progression](games/anil/reference/progression.md), [randomizer](games/anil/reference/randomizer.md), [shinies](games/anil/reference/shinies.md), [state](games/anil/reference/state.md), [world](games/anil/reference/world.md). |

## Projects

Each project's design docs live in `<project>/`, its code in `pkmn/<project>/`.

| Project | Status | Description |
|---------|--------|-------------|
| Open Sheet | Built | Shows a player's exported Pokémon and items in a web app in the Site, for open-sheet fights; its export is now the Site's [save export](site/explanation/save-export.md) ([explanation](site/explanation/open-sheet.md)) |
| Site | Team Analysis built | The web app at `pkmn.enbraile.vip`, code in `pkmn/site/`, where players sign in with Discord and wait until an admin allows them, then land on the running series' page (`/series/<n>`, its scene, game download, trainers and rules; every series at `/series`) and upload their save zip there as a snapshot, read by the [save export](site/explanation/save-export.md) ([snapshot format](site/reference/snapshot.md)); Open Sheet at `/open-sheet`, which imports exports into tabs and shows each in a PC with a summary and a bag, where named teams are built, analysed, and copied to and pasted from Showdown; Team Analysis at `/team-analysis`, PokeGraph's team analysis with its pool and compare views, also shown in Open Sheet's Team view; admins sign in at `/admin`, keep the allowlist at `/admin/players`, the games and their zips at `/admin/games`, and create, start and finish series at `/admin/series`, against a Hono API on Vercel Functions with Neon Postgres and Backblaze B2. [Explanation](site/explanation/site.md), [Open Sheet](site/explanation/open-sheet.md), [Team Analysis](site/explanation/team-analysis.md), [save export](site/explanation/save-export.md), [design system](site/reference/design-system.md), [how to add a page](site/how-to/add-a-page-to-the-site.md), [how to run and deploy it](site/how-to/run-and-deploy-the-site.md), [how to verify it in a browser](site/how-to/verify-the-site.md) |
| Wonder | Not migrated | AI agent that plays its own run of Añil's Randomlocke; lives outside Enbraile for now |
