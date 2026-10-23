# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

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

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([Site v2 → Accounts and Access](site-v2/discovery.md#accounts-and-access)). Later, team building could hold teams to them (e.g. one legendary per team).
