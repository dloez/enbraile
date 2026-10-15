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
| Open Sheet | Export built; web app scoped | Exports a player's shared Pokémon and items to JSON and shows them in a web app, for open-sheet fights ([brief](../work-in-progress/open-sheet.md)); the export lives in Tools, the web app in the site ([scope](../work-in-progress/open-sheet-site-discovery.md)) |
| Tools | Active | Small scripts in `pkmn/tools/`. The Open Sheet export: [explanation](tools/explanation/open-sheet-export.md), [JSON reference](tools/reference/open-sheet-json.md), [how to run and share it](tools/how-to/run-the-open-sheet-export.md) |
| Wonder | Not migrated | AI agent that plays its own run of the Randomlocke and is an optional opponent each gym round; lives outside Enbraile for now |
