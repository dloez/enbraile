# The League: Discovery

Not yet scoped: the interview waits until the [site v2](../site-v2/discovery.md) rework is done (owner, 2026-10-23). What is below is what is already known, gathered so the scoping starts from it. Every product decision is still open, and the first entry of [tasks.md](tasks.md) is the scoping itself.

## Goal

The site holds the group's league, integrated with its teams, and the group's Trainer League app (`https://raspi.tail3e36c9.ts.net:10000/`) moves into it, its Wonder tab aside ([Site v2 → Pages](../site-v2/discovery.md#pages)). Series 1's results come across.

## What Is Known

- **What the Trainer League app holds:** standings (points, W–L, Pokémon League, games, KOs, eggs ready and hatched); matchdays whose pairings stay hidden until a trainer locks in that matchday's team; results reported by one player and confirmed or disputed by the other; Bo3 replays (links or uploaded files, with a turn-by-turn log); Pokémon League tries (combats won of 5, which member fainted where); the knockout cup with its losers' group; egg counts; and organizer tools (redraw, open day, edit results).
- **A first design** of the series page's League section (matchday tabs with result cards, the league table, the Pokémon League's best tries, the cup bracket) is in version 43 of the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas. Site v2 ships only a work-in-progress placeholder there, and on the player profile.
- **Teams already lock their sources in site v2:** a tournament creates teams whose sources it locks, so players build only from what that match allows ([Site v2 → Team Building](../site-v2/discovery.md#team-building)). Locking a team's build for a match is the league's to design.
- **Manual series trust the players:** no blocking validation between what the site holds and the save ([Site v2 → Snapshots In](../site-v2/discovery.md#snapshots-in)).
- **The group's league rules** for series 1, its scoring and tie-breaks among them, are in [Series 1 Rules](../../pkmn/series/1/reference/rules.md).

## References

- [Site v2 discovery](../site-v2/discovery.md): Pages, Team Building, Snapshots In.
- [The pkmn Site](../../pkmn/site/explanation/site.md).
- [Series 1 Rules](../../pkmn/series/1/reference/rules.md).
- The Trainer League app, `https://raspi.tail3e36c9.ts.net:10000/` (not yet read for this idea).
