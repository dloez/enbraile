# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: where do a trainer's lives come from?

The series page's trainer panel wants a trainer's lives, for a series that plays with a lives clause (series 1 plays without one), and nothing gives them yet. The rest of what the panel wants now comes from the snapshot, fainted Pokémon included, through a per-series ingestion mode ([Site v2 → Model](site-v2/discovery.md#model), [Snapshots In](site-v2/discovery.md#snapshots-in), 2026-10-23). Raised in the site v2 design pass. _(owner, 2026-10-22)_

### pkmn/site: what does the league do with a player who joins mid-league?

A running series takes new players, and the [league](league/discovery.md) draws each round among the series' players. Open: whether a player added mid-league joins the draw from the next round, gets catch-up matches against those they missed, or stays out until the next series; and how the standings and the cup treat them. The waiting-page upload below depends on it. Left open while scoping the league. _(owner, 2026-10-27)_

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

### pkmn/site: Team Analysis's view switch scrolls a 360px phone sideways

At 360×800, `/team-analysis` is 379px wide: its `Segmented` view switch (`inline-flex gap-0.5 rounded-lg border bg-muted p-0.75`, `src/components/controls.tsx`) overflows the page column by 19px, so the page scrolls sideways (seen through `verify-site` on 2026-10-23 while checking the phone header, whose own width measured 360px). Make the switch fit or wrap at 360px, or confirm that the team pages replacing `/team-analysis` ([Site v2 → Compare teams](site-v2/tasks.md)) drop it.

**Touches:** `pkmn/site/src/components/controls.tsx`, `pkmn/site/src/pages/`

### pkmn/site: a waiting player uploads their save, so they join a series already onboarded

A player's first Discord sign-in lands on the waiting page until an admin lets them in, and the API answers a waiting player only with 403 ([The pkmn Site → Accounts](../pkmn/site/explanation/site.md)), so today a new player joins with nothing and uploads their save afterwards from their row on the series page. The owner wants the waiting page to take the player's save zip, so that when an admin lets them in they are already in a series with their data. Series 1 is the one case now: the site arrives mid-series, so its players come with saves already played (and MIRAMEEE and Vicky with only old Open Sheet exports, `pkmn/site/saves/*-open-sheet.json`, which an admin uploads for them); the aim is that every player who joins arrives onboarded. It waits for the [league](league/discovery.md) on the site. _(owner, 2026-10-27)_

**Do:**
- [ ] Per the author's answers: the waiting page takes a save zip, held until an admin lets the player in, who then joins a series with it as their snapshot.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, as `leaf` (waiting), upload a save zip from the waiting page; as admin, let Leaf in and see Leaf in the series with that snapshot.
- Human-run: on production, sign in with Discord as someone new, upload a save from the waiting page, get let in, and land in the series with it.
- Reuse: the snapshot upload (`api/_lib/ingest.ts`) and its flow on the series page; `src/pages/waiting.tsx`.
- Neighbors: `api/_lib/access.ts`; `/admin/players` (`src/pages/admin-players.tsx`, `api/_lib/players.ts`).
- Forbidden: a waiting player reading any series' data.

**Touches:** `pkmn/site/src/pages/waiting.tsx`, `pkmn/site/api/`, `pkmn/site/shared/`, `docs/pkmn/site/`
**After:** the league on the site ([league](league/tasks.md)).
**Needs the author:**
- Which series the upload joins: the running one, one the player picks, or one the admin picks when letting them in?
- Does letting them in also put them in that series, or does the admin still add them to it?
- Which milestone the snapshot lands on: the save's suggestion, as an upload's, or the admin's?
- What the league needs of a player joining mid-league ([the question above](#pkmnsite-what-does-the-league-do-with-a-player-who-joins-mid-league)).
- What happens to the held zip when the admin removes or deletes the player before letting them in.

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
