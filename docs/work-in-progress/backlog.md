# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: where do a trainer's lives come from?

The series page's trainer panel wants a trainer's lives, for a series that plays with a lives clause (series 1 plays without one), and nothing gives them yet. The rest of what the panel wants now comes from the snapshot, fainted Pokémon included, through a per-series ingestion mode ([The pkmn Site → Snapshots](../pkmn/site/explanation/site.md#snapshots), 2026-10-23). Raised in the site v2 design pass. _(owner, 2026-10-22)_

### pkmn/site: what does the league do with a player who joins mid-league?

A running series takes new players, and the [league](league/discovery.md) draws each round among the series' players. Open: whether a player added mid-league joins the draw from the next round, gets catch-up matches against those they missed, or stays out until the next series; and how the standings and the cup treat them. A player added to a running manual series now uploads their save before they reach the site, so they arrive with their snapshot ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)); the league still has to place them. Left open while scoping the league. _(owner, 2026-10-27)_

### pkmn/site: fit the PC summary's "Add to team" strip?

The "Add to team" menu in a PC summary shows each team as a strip of sprites that overlap and are trimmed about 4px top and bottom, with about three of six shown, as the frozen `pc.dc.html` draws it (`margin: -4px -9px 0 0` in a 76×24 strip). Every other sprite tile was fitted whole on 2026-10-29 at the owner's request, this one left as the exception ([Site Design System → Patterns](../pkmn/site/reference/design-system.md#patterns)). Fit it too, which changes its look, or keep the board's? _(raised 2026-10-29)_

## Tasks

### pkmn/site: several series run at once

The owner wants more than one series running at a time (2026-10-27). A partial unique index, `series_one_running_idx` in `api/_lib/schema.ts`, lets one run, and the site leans on that: `/` sends a player to the running series (`src/pages/home.tsx`), the header's PC tab opens their PC in it (`src/components/site-header.tsx`), the team builder takes the sources a player may start from and a new team's pool from it (`api/_lib/teams.ts`), the admin overview shows one running banner (`src/pages/admin.tsx`), and starting a series needs the running one finished (`startChecklist` in `shared/series.ts`, `otherRunning` in `api/_lib/series-data.ts`). Joining mid-series already handles several: the waiting page offers an upload per owed series ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)).

**Do:**
- [ ] Per the author's answers: drop the index with its migration, and make each place above handle several running series.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, start a second series beside the seeded Series 1, add Leaf to both mid-way, and see the waiting page offer both uploads; read `/`, the PC tab, New team and the admin overview with both running.
- Human-run: none.
- Reuse: `owedSeries` and the waiting page's per-series buttons; the series list's banners (`src/pages/series-list.tsx`).
- Neighbors: the league ([league](league/discovery.md)), which draws its rounds per series.
- Forbidden: none yet.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/series.ts`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `pkmn/site/scripts/seed.ts`, `docs/pkmn/site/`
**Needs the author:**
- Where `/` sends a player in several running series: the series list, the newest, or the one they last opened?
- Which series the header's PC tab opens.
- Which running series' snapshots and pool the team builder starts a new team from.
- How the admin overview shows several running series.
- Whether starting a series still asks for anything about the ones running.

### pkmn/site: track what a locked league team spends in a manual series

A locked round or cup team spends Mini Setas, mints and held items that the player must spend in the game too, and the site only sees that at the next snapshot. Series 1 does nothing about it ([league → Team Locking](league/discovery.md#team-locking)). A later series may deduct a locked team's spending from the bag the player's other teams see, or flag a next snapshot that does not show it spent, within manual series' trust stance ([The pkmn Site → Decisions](../pkmn/site/explanation/site.md#decisions)). _(owner, 2026-10-27)_

**Do:**
- [ ] Per the author's answers.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, the chosen behaviour on a locked team.
- Human-run: none until a series uses it.
- Reuse: the team builder's per-snapshot limits (`src/teams/`).
- Neighbors: none.
- Forbidden: blocking an upload or a team.

**Touches:** `pkmn/site/src/teams/`, `pkmn/site/api/`, `docs/pkmn/site/`
**After:** the league's round teams ([league](league/tasks.md)).
**Needs the author:** deduct, warn, or both, and for which spends.

## Ideas

### pkmn/site: a private Showdown tied to the site

A Pokémon Showdown server and client of the group's own, so a league or cup match needs no challenge sent: the site gives a link, both players sign in with their site account, see their site teams there with edits synced both ways in real time, and play a battle the site set up with their locked teams; the finished log is kept by the site, permanently, and the result recorded with it. Only worth it if replays stay as permanent as Showdown's saved replays. Showdown is open source; a server needs an always-on host (Vercel cannot hold its websockets). The [league](league/discovery.md#results) builds no stand-in for it: admins enter each game's result until this lands, and its [match page](league/discovery.md#the-match-page) is built so this can set up each game from the players' picks of six and report its finish. _(owner, 2026-10-27; the match page 2026-10-28)_

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)). Later, team building could hold teams to them (e.g. one legendary per team).

### pkmn/site: show only what a series' rules allow of others' PCs

Every PC at every snapshot is open to every player, for now ([The pkmn Site → Decisions](../pkmn/site/explanation/site.md#decisions)). A series' rules may limit what a player sees of others' boxes (the league's box sheet), and the site could show only that. Left out of site v2. _(owner, 2026-10-22)_ The league already limits it: a player sees others' saves only up to their own round, and a closed round hides its snapshots until the match has a result ([league](league/discovery.md#team-locking)); this idea is what a series' rules allow beyond that.

### pkmn/site: read saves of games other than Añil

Any game can be created and downloaded, but the save upload reads Añil saves only ([Save Export](../pkmn/site/explanation/save-export.md)). A series played on another game needs an export for that game's saves. Left out of site v2 until such a series is planned. _(owner, 2026-10-22)_
