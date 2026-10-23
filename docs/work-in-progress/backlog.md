# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: how is a team locked?

[Site v2 → Team Building](site-v2/discovery.md#team-building) says only that a tournament creates teams whose sources it locks. Open: who locks a team and when (a match, an admin, the player submitting it); what locking freezes, the sources only or the whole build (members, items, abilities, moves); whether it can be unlocked, and by whom; how a locked team shows on the team page and the team list. Higher priority than the question below, which depends on it. _(owner, 2026-10-23)_

### pkmn/site: in a manual series, what happens to the items a locked team uses?

A locked team's build spends items (Mini Setas on abilities, held items), and the player has to spend them in the real game too; the site only learns what the save holds at the next upload. Open: whether the site deducts them from the snapshot's bag for the player's other teams once a team is locked; whether it expects the next snapshot to show them spent; what happens when it does not, keeping to the trust stance of manual series, with no blocking validation ([Site v2 → Snapshots In](site-v2/discovery.md#snapshots-in)). Depends on [how is a team locked?](#pkmnsite-how-is-a-team-locked). _(owner, 2026-10-23)_

### pkmn/site: where do a trainer's lives come from?

The series page's trainer panel wants a trainer's lives, for a series that plays with a lives clause (series 1 plays without one), and nothing gives them yet. The rest of what the panel wants now comes from the snapshot, fainted Pokémon included, through a per-series ingestion mode ([Site v2 → Model](site-v2/discovery.md#model), [Snapshots In](site-v2/discovery.md#snapshots-in), 2026-10-23). Raised in the site v2 design pass. _(owner, 2026-10-22)_

## Tasks

### pkmn/site: clear files the bucket holds that nothing points to

A game's upload is a multipart upload that `POST /api/games/<id>/file` completes and then records ([The pkmn Site → Games](../pkmn/site/explanation/site.md#games)), and the game's open multipart uploads are aborted when its next upload starts. When the upload completes but recording it fails, or deleting the replaced file fails, the zip stays in the bucket with no row pointing at it, about 600 MB each; none exist yet (2026-10-23). The same will hold for snapshot uploads.

**Do:**
- [ ] A way to find and delete the bucket's objects no `game` row (and later no snapshot) names.

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack, put an object under `games/<id>/` with no row, run it, and see it gone while a recorded file stays.
- Human-run: none.
- Reuse: `api/_lib/files.ts`.
- Neighbors: `api/_lib/games.ts`.
- Forbidden: deleting an object a row names.

**Touches:** `pkmn/site/api/`, `pkmn/site/scripts/`, `docs/pkmn/site/`
**Needs the author:** how it runs: a script the owner runs by hand, or something scheduled?

## Ideas

### pkmn/site: the league

The site will hold the league, integrated with teams, and the group's Trainer League app (`https://raspi.tail3e36c9.ts.net:10000/`) moves into it, Wonder aside ([Site v2 → Pages](site-v2/discovery.md#pages)). Site v2's series page shows its League section as a work-in-progress placeholder; a first design of it (matchday tabs with result cards, the league table, the Pokémon League's best tries, the cup bracket) is in version 43 of the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas. The app holds: standings (points, W–L, Pokémon League, games, KOs, eggs ready and hatched), matchdays whose pairings stay hidden until a trainer locks in that matchday's team, results reported by one player and confirmed or disputed by the other, Bo3 replays (links or uploaded files, with a turn-by-turn log), Pokémon League tries (combats won of 5, which member fainted where), the knockout cup with its losers' group, egg counts, and organizer tools (redraw, open day, edit results). Series 1's results must come across.

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([Site v2 → Accounts and Access](site-v2/discovery.md#accounts-and-access)). Later, team building could hold teams to them (e.g. one legendary per team).
