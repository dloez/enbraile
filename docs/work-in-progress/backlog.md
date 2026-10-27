# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: where do a trainer's lives come from?

The series page's trainer panel wants a trainer's lives, for a series that plays with a lives clause (series 1 plays without one), and nothing gives them yet. The rest of what the panel wants now comes from the snapshot, fainted Pokémon included, through a per-series ingestion mode ([Site v2 → Model](site-v2/discovery.md#model), [Snapshots In](site-v2/discovery.md#snapshots-in), 2026-10-23). Raised in the site v2 design pass. _(owner, 2026-10-22)_

### pkmn/site: what does the league do with a player who joins mid-league?

A running series takes new players, and the [league](league/discovery.md) draws each round among the series' players. Open: whether a player added mid-league joins the draw from the next round, gets catch-up matches against those they missed, or stays out until the next series; and how the standings and the cup treat them. A player added to a running manual series now uploads their save before they reach the site, so they arrive with their snapshot ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)); the league still has to place them. Left open while scoping the league. _(owner, 2026-10-27)_

## Tasks

### pkmn/site: clear files the bucket holds that nothing points to

A game's upload is a multipart upload that `POST /api/games/<id>/file` completes and then records ([The pkmn Site → Games](../pkmn/site/explanation/site.md#games)), and the game's open multipart uploads are aborted when its next upload starts. When the upload completes but recording it fails, or deleting the replaced file fails, the zip stays in the bucket with no row pointing at it, about 600 MB each; none exist yet (2026-10-23). Save zips mostly clear themselves: starting a player's snapshot upload deletes their zips more than an hour old that no snapshot holds, as its zip or its rolled zip ([The pkmn Site → Snapshots](../pkmn/site/explanation/site.md#snapshots)); what a player's last upload leaves, or a delete that failed, stays.

**Do:**
- [ ] A way to find and delete the bucket's objects no `game` row and no `snapshot` row (its `file_key` or `rolled_key`) names.

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack, put an object under `games/<id>/` with no row, run it, and see it gone while a recorded file stays.
- Human-run: none.
- Reuse: `api/_lib/files.ts`.
- Neighbors: `api/_lib/games.ts`; `api/_lib/ingest.ts`'s check that no snapshot still holds a key.
- Forbidden: deleting an object a row names.

**Touches:** `pkmn/site/api/`, `pkmn/site/scripts/`, `docs/pkmn/site/`
**Needs the author:** how it runs: a script the owner runs by hand, or something scheduled?

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

### pkmn/site: let a series hide league teams and pairings until the match

The [league](league/discovery.md#team-locking) is fully open for series 1: every round team, locked or not, and every round's pairs are seen by all. A later series may want the old app's behaviour, or the series 1 rule that a player knows the opponent's box sheet, not their team: a round's team hidden from all but its owner and admins until its match has a result, and a player's pairing shown only once they lock in. Whether it is hidden is a series' choice, read from the league's rules (`shared/league.ts`) until a series' rules are data. _(owner, 2026-10-27)_

**Do:**
- [ ] Per the author's answers: a series setting for hidden teams and pairings, enforced by the API, not only the page.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, on a hidden series, a second test player cannot read the first's round team or pairing before the result, by page or by route.
- Human-run: none until a series uses it.
- Reuse: the league's round teams and lock.
- Neighbors: `api/_lib/access.ts`.
- Forbidden: hiding in the browser only.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/league.ts`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** the league's round teams ([league](league/tasks.md)).
**Needs the author:** what is hidden (teams, pairings, both), from whom, and until when (the result, the opponent's lock-in).

### pkmn/site: track what a locked league team spends in a manual series

A locked round or cup team spends Mini Setas, mints and held items that the player must spend in the game too, and the site only sees that at the next snapshot. Series 1 does nothing about it ([league → Team Locking](league/discovery.md#team-locking)). A later series may deduct a locked team's spending from the bag the player's other teams see, or flag a next snapshot that does not show it spent, within manual series' trust stance ([Site v2 → Snapshots In](site-v2/discovery.md#snapshots-in)). _(owner, 2026-10-27)_

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

A Pokémon Showdown server and client of the group's own, so a league or cup match needs no challenge sent: the site gives a link, both players sign in with their site account, see their site teams there with edits synced both ways in real time, and play a battle the site set up with their locked teams; the finished log is kept by the site, permanently, and the result recorded with it. Only worth it if replays stay as permanent as Showdown's saved replays. Showdown is open source; a server needs an always-on host (Vercel cannot hold its websockets). The [league](league/discovery.md#results) builds no stand-in for it: admins enter results until this lands. _(owner, 2026-10-27)_

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([Site v2 → Accounts and Access](site-v2/discovery.md#accounts-and-access)). Later, team building could hold teams to them (e.g. one legendary per team).
