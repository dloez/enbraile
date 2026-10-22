# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: how does the site gather each trainer's data?

The series page's trainer panel wants per-trainer data the site has no source for yet: Pokémon fainted (the save export leaves permafainted Pokémon out), lives (series 1 plays without them, a later series may not), alongside what snapshots already give (the PC, the bag, TMs). Today one series reads Añil saves through one export; a later series may run on another game, another mod or another way of reporting. How the site takes in trainer data has to allow several ingestion paths, one per series or game, rather than assume today's export. Raised in the site v2 design pass ([Site v2 → Snapshots In](site-v2/discovery.md#snapshots-in)). _(owner, 2026-10-22)_

## Ideas

### pkmn/site: the league

The site will hold the league, integrated with teams, and the group's Trainer League app (`https://raspi.tail3e36c9.ts.net:10000/`) moves into it, Wonder aside ([Site v2 → Pages](site-v2/discovery.md#pages)). Site v2's series page shows its League section as a work-in-progress placeholder; a first design of it (matchday tabs with result cards, the league table, the Pokémon League's best tries, the cup bracket) is in version 43 of the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas. The app holds: standings (points, W–L, Pokémon League, games, KOs, eggs ready and hatched), matchdays whose pairings stay hidden until a trainer locks in that matchday's team, results reported by one player and confirmed or disputed by the other, Bo3 replays (links or uploaded files, with a turn-by-turn log), Pokémon League tries (combats won of 5, which member fainted where), the knockout cup with its losers' group, egg counts, and organizer tools (redraw, open day, edit results). Series 1's results must come across.

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([Site v2 → Accounts and Access](site-v2/discovery.md#accounts-and-access)). Later, team building could hold teams to them (e.g. one legendary per team).
