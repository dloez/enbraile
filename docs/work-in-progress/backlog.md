# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: where do a trainer's lives come from?

The series page's trainer panel wants a trainer's lives, for a series that plays with a lives clause (series 1 plays without one), and nothing gives them yet. The rest of what the panel wants now comes from the snapshot, fainted Pokémon included, through a per-series ingestion mode ([Site v2 → Model](site-v2/discovery.md#model), [Snapshots In](site-v2/discovery.md#snapshots-in), 2026-10-23). Raised in the site v2 design pass. _(owner, 2026-10-22)_

### pkmn/series: which snapshot is a series 1 player's tournament sheet?

For the [league](league/discovery.md) idea. [Series 1 Rules → Final Tournament](../pkmn/series/1/reference/rules.md#final-tournament)'s open-sheet rule (`rules.md:262`) still has each player "export their whole PC with the Open Sheet export … when they decide they are done playing", and that export is their sheet; the export now runs on the site from an uploaded save zip, and a series' snapshots sit at milestones, Tournament among them ([The pkmn Site → Snapshots](../pkmn/site/explanation/site.md#snapshots), retired script 2026-10-23). Open: is the sheet the player's snapshot at the Tournament milestone, their latest, or one they pick, and does the rule's wording change to the upload? A rule is the owner's, so it is not rewritten without them. Raised in site v2's final gardener pass. _(2026-10-23)_

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

## Ideas

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([Site v2 → Accounts and Access](site-v2/discovery.md#accounts-and-access)). Later, team building could hold teams to them (e.g. one legendary per team).
