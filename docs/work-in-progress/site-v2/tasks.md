# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Design the team list, the team builder and the PC's summary

The screens still undrawn, desktop and phone, in the signed-off look ([Pages → Design](discovery.md#pages)): the team list and team builder (sources picker, free member editor, the analysis views including Pool and Compare), and the PC's `Summary` board, which `pc.dc.html` places beside the box but which is not signed off ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions), the PC page's sign-off). The team views carry their content over from Open Sheet and Team Analysis. The phone layouts of the player pages, the series list and the series page were signed off on 2026-10-23 (`94d12ec`) and are frozen in `pkmn/site/design/` with the earlier boards.

**Do:**
- [ ] Build them on the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas.
- [ ] Get the owner's sign-off; copy the signed-off boards into `pkmn/site/design/` and record the sign-off in `docs/pkmn/site/explanation/site.md` → Look and Decisions.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner opens the boards and signs them off, or lists changes.
- Reuse: the frozen boards in `pkmn/site/design/`; [Open Sheet Screens](https://claude.ai/artifact/SfpFcW5UoLVLeLAmdJZMG1) and [Team Analysis Screens](https://claude.ai/artifact/4tyDvGNZXHqSRAvABaszfH) for what each view holds.
- Neighbors: `pkmn/site/design/pc.dc.html`.
- Forbidden: colours or pieces outside the look without naming them as additions; helper text.

**Touches:** `pkmn/site/design/`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** sign-off on these screens.

## Owner-run: Discord sign-in on production

Discord sign-in and the allowlist are built and checked on the local stack (2026-10-23); production needs the owner's half, as [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) step 6 describes.

**Do:**
- [ ] Owner-run: the Discord application with redirect URIs `https://pkmn.enbraile.vip/api/auth/callback/discord` and `http://localhost:5173/api/auth/callback/discord`; `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel; `npm run db:migrate` against the production branch (migrations `0002_allowlist`, `0003_series`, `0004_saves` and `0005_tm_rolls`, all unpushed on `main` with the code that needs them) before the push that deploys it.

**Acceptance:**
- Claude-run: none.
- Human-run: on production, sign in with Discord as a new user and see the waiting page; as an admin in another browser, allow them at `/admin/players`; reload and land on `/series` (empty until a series runs, then that series' page); remove them and see the waiting page again.
- Reuse: step 6 of the run how-to.
- Neighbors: none.
- Forbidden: the Discord secret anywhere but Vercel and `.env.local`.

**Touches:** `docs/pkmn/site/`
**Needs the author:** the owner-run steps above.

## Owner-run: start series 1 on production

The series pages, the admin series form and the phone header are built and checked on the local stack (2026-10-23), where the seed makes series 1; on production series 1 is created through the form, its rules pasted from `docs/pkmn/series/1/reference/rules.md`, as the series entry that landed in `f799e09` asked. Its production checks left the queue with it.

**Do:**
- [ ] Owner-run: as admin at `/admin/series`, make series 1 on the Añil game, the daytime route, manual ingestion, its players from the allowlist, milestones Gym 1 to Gym 8, Post-League and Tournament with rounds as its rules set, and its rules pasted from `docs/pkmn/series/1/reference/rules.md`; start it.

**Acceptance:**
- Claude-run: none.
- Human-run: as admin, make the draft and see the checklist list what is missing; fill it in until Start enables; start it. As an allowed player of it, sign in and land on its page, read its rules, download its game; as an allowed player not in it, see no Download. Make a second draft by "Copy from" series 1, see the rules copied, and delete it. Open `/series` and see series 1's banner on its moving scene, marked playing now; turn on reduced motion and see the scenes stand still. On a phone, signed in as an admin and as a player, reach every tab and sign-out from the header's menu.
- Reuse: [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) → Verification.
- Neighbors: none.
- Forbidden: series 1 made by `npm run seed` or by SQL on production.

**Touches:** `docs/pkmn/site/`
**After:** Owner-run: Discord sign-in on production
**Needs the author:** the owner-run steps above.

## Owner-run: upload series 1's saves on production

The snapshot upload, the rolled zip and the PC page are built and checked on the local stack (2026-10-23, `3b0df37`, `2011e77`, `fe84424`) against MinIO; on production a save zip goes up to B2 under `saves/` and is read back, exported and rolled inside the Vercel Function, which the local stack does not exercise ([The pkmn Site → Snapshots](../../pkmn/site/explanation/site.md#snapshots)). No other entry checks it there.

**Do:**
- [ ] Owner-run: once series 1 runs, each player uploads their save zip from their row on `/series/1`.

**Acceptance:**
- Claude-run: none.
- Human-run: as a player of series 1 on production, upload your save zip from your row, see the suggested milestone, save it and read "<milestone> saved" with the Pokémon count and the TM rolls row; download the rolled zip from the done step and from the snapshot chip, and see it named as your zip; click "Open PC" and see your PC at that snapshot, its summary and its bag; as another player, open the first player's row and see their snapshot chips without a download button; as admin, upload for a player and replace their snapshot, and read the amber warning first.
- Reuse: [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) → Verification.
- Neighbors: none.
- Forbidden: snapshots made on production by `npm run seed` or by SQL.

**Touches:** `docs/pkmn/site/`
**After:** Owner-run: start series 1 on production
**Needs the author:** the owner-run steps above.

## The series page's track reads the snapshots

Each row's progress track shows the trainer at their latest snapshot, with the row's tiles showing it; each milestone with a snapshot is ringed in faint cyan in its node's shape, and clicking one shows that snapshot ([The progress track?](discovery.md#pages)). The Trainers table has no Records view ([Comparing trainers?](discovery.md#pages)).

**Do:**
- [ ] The interactive track, its rings, and the row's tiles per snapshot; on a phone, where the track only shows, the open row's segmented control of the trainer's milestones picking the snapshot instead (`series-phone.dc.html`, [The progress track?](discovery.md#pages)).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with two snapshots for a test player, see both nodes ringed, click the earlier one and see the row's tiles change; at 390×844, pick the earlier milestone in the open row's control and see the tiles change.
- Human-run: on production, click through your own track's nodes.
- Reuse: the series page, `src/pages/series.tsx` (`TrainerRow`'s track); `trainersOf` in `api/_lib/series-data.ts`, which already answers each snapshot's milestone and counts; `Segmented` in `src/components/controls.tsx`.
- Neighbors: `pkmn/site/design/series.dc.html`.
- Forbidden: a Records view or switch on the series page; a ranking or ordering by records.

**Touches:** `pkmn/site/src/`, `pkmn/site/api/`, `pkmn/site/shared/`, `docs/pkmn/site/`

## Admins set save-derived values by hand and manage any snapshot

An admin can set any value derived from a save by hand (progress, the fainted count, a snapshot's milestone), and upload, replace, delete or move any snapshot for any player ([Admin overrides?](discovery.md#model), [How does a save reach the site?](discovery.md#snapshots-in)). Each value records its source, from the save or set by hand (by whom and when), and a value set by hand wins until an admin clears it.

**Do:**
- [ ] The source of each derived value in the schema and migration; override, clear, delete and move routes, admin-only; the overrides on the series page's rows; the track shows no mark on progress set by hand (`series.dc.html`).

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`; through `verify-site`, as admin, set a player's fainted count, upload a new save for them and see the set count kept, clear it and see the save's; move a snapshot to another milestone; delete one; as a player, see no override controls and get `403` from the routes.
- Human-run: as admin on production, correct a snapshot's milestone and see it on the series page; set a player's progress by hand and see their track move to it.
- Reuse: `requireAdmin` in `api/_lib/admin.ts`; the snapshot tables from the save-zip entry.
- Neighbors: the series page's Trainers table.
- Forbidden: a value set by hand overwritten by a later save; an override without who set it and when.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** The series page's track reads the snapshots

## The PC box and summary take the signed-off look

The PC page shows Open Sheet's box, summary and bag in their old look: `fe84424` kept them so and left `pc.dc.html`'s teal box "for when its `Summary` board is signed off" ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions), the PC page's build choices). No other entry restyles them, and the team builder reuses all three.

**Do:**
- [ ] The box after `pc.dc.html` and the summary after the signed-off `Summary` board, in `src/components/pc/`, so the PC page and Open Sheet both take it; new colours as tokens; [Design System](../../pkmn/site/reference/design-system.md) → Box and cells and the PC's components updated; the PC page's build choice rewritten.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open a seeded snapshot's PC at desktop width and at 390×844, select a Pokémon and read its summary's tabs, open the bag; compare against the boards with `browser_take_screenshot`.
- Human-run: open your PC on production and read a Pokémon's summary.
- Reuse: `SnapshotPc`, `PcBox`, `SummaryAside`, `SummarySheet` in `src/components/pc/pc-box.tsx`; `src/components/pc/summary.tsx`, `bag.tsx`.
- Neighbors: `pkmn/site/design/pc.dc.html`.
- Forbidden: a second box or summary for the PC page; raw colours in components.

**Touches:** `pkmn/site/src/components/pc/`, `pkmn/site/src/index.css`, `docs/pkmn/site/`
**After:** Design the team list, the team builder and the PC's summary

## Build teams locked to a snapshot, stored in the account

`/teams` lists every team, the player's first and others' read-only; `/teams/<id>` builds one from one snapshot as six member cards edited in place, with the snapshot's item and Mini Seta limits, a picker of the snapshot's PC for empty slots, Analysis (Summary, Graph, Archetype, Members, Matrices) beside the cards, giving way to a member's summary when its header row is clicked, Showdown copy and import (unbacked sets left out, as today). The PC page stays read-only; "Add to team" in its summary adds the Pokémon to a team or a new one ([How do the PC and the team pages split?](discovery.md#team-building)). A new team starts on the player's latest snapshot of the running series. `/open-sheet`, the Dexie database and its local data go.

**Do:**
- [ ] Teams table and migration (owner, sources, slots); team routes, the owner alone writing; `npm run seed` extended with a team on the seeded snapshot; the header's Teams tab opening `/teams` (`TEAMS_TAB` in `src/components/site-header.tsx`, today `/team-analysis`); the trainer row's Teams tile counting the trainer's teams.
- [ ] Move Open Sheet's builder under `/teams/<id>` on stored snapshots; delete `/open-sheet`, `src/open-sheet/db.ts`, the import tabs and Dexie, and the browser's old database on first load.
- [ ] Rewrite `open-sheet.md` as the team builder's doc (rename it) and update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "dexie\|open-sheet:tab" pkmn/site/src pkmn/site/package.json` finds nothing.
- Human-run: make a team on your series 1 snapshot, give items until one runs out, switch an ability and see the Mini Seta count, copy it for Showdown and paste it back as a new team; reload on another device and see the teams; open another player's team read-only.
- Reuse: `src/open-sheet/team.ts`, `showdown.ts`, `components/team-view.tsx`, `sheet-analysis.tsx`; the PC's pieces in `src/components/pc/` (`pc-box.tsx`, `summary.tsx`, `bag.tsx`), not copies; `snapshotSchema` in `shared/snapshot.ts` for the stored snapshot; `src/analysis/`.
- Neighbors: `src/open-sheet/components/team-bar.tsx`.
- Forbidden: teams in `localStorage` or IndexedDB; another player able to write a team.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `pkmn/site/package.json`, `pkmn/site/package-lock.json`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Design the team list, the team builder and the PC's summary

## A trainer row's Teams tile opens their teams

The series page's trainer row has a Teams tile, drawn in `series.dc.html` as a link and specified as "their teams (count, opens them)" ([First page after sign-in?](discovery.md#pages)). The count comes with the team builder; where it opens is settled nowhere: `/teams` lists every team with the reader's first, and no route lists one player's teams.

**Do:**
- [ ] The tile's link to where the author settles.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with a seeded team for a test player, open their row's Teams tile and land where it is settled.
- Human-run: open another trainer's Teams tile from the series page and see their teams.
- Reuse: the team list from the entry above; `Tile` in `src/pages/series.tsx`.
- Neighbors: the row's PC tile.
- Forbidden: a route for one player's teams that the author did not settle.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account
**Needs the author:** where does a trainer row's Teams tile open: `/teams` filtered to that trainer, a new `/players/<player>/teams`, or the trainer's teams on their series page?

## Upload old exports as snapshots, with warnings for what they lack

The upload also takes an export `.json`, and every export is read as far as it goes ([Exports from older versions](discovery.md#snapshots-in)): the export schema treats every field but the species as optional, a snapshot stores what was missing, and its series page row and PC page show the warning. Series 1's MIRAMEEE and Vicky exports, in `pkmn/site/saves/`, go in through it.

**Do:**
- [ ] A lenient export schema with the missing-field report; entries without a usable species skipped and counted; refuse only non-JSON or nothing usable.
- [ ] JSON in the upload flow (player and admin), the drop zone reading "or an export" and the done step after `upload-done-json.dc.html`; the warning chip on the row and the PC page's "Export missing" line (left out until now, [The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions), the PC page's and the upload's build choices); `moves` without rolled TMs marked unchecked in the move picker.
- [ ] Record in the snapshot format's reference which fields old exports lack and how the site reads them.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, upload `saves/Vicky-open-sheet.json` and `saves/MIRAMEEE-open-sheet.json` for two test players, see each warning on the series page and the PC page, open a Pokémon's summary and the bag in each, and build a team from each with Level 50 ranges shown; upload a JSON with one entry missing its species and read "1 skipped"; upload a file that is not JSON and read its refusal.
- Human-run: upload the two exports for MIRAMEEE and Vicky on production and open their PCs.
- Reuse: `sheetSchema` and `snapshotSchema` in `shared/snapshot.ts` (which `src/open-sheet/schema.ts` re-exports), made lenient rather than copied; `ingest` in `api/_lib/ingest.ts`.
- Neighbors: the save zip upload.
- Forbidden: refusing an export for a missing field; a second schema for old exports.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`, `docs/pkmn/site/reference/snapshot.md`
**After:** Build teams locked to a snapshot, stored in the account

## Build teams from several snapshots, any player's

A team's sources picker takes any number of snapshots, any player's; the PC shows each source's Pokémon, and each member draws its item and Mini Setas from its own snapshot ([Item limits across several sources?](discovery.md#team-building)).

**Do:**
- [ ] The sources picker; per-source PC sections and limits.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: add another player's snapshot to a team, put one of their Pokémon in it, and see its item limited by their bag, not yours; remove that source and see the member flagged.
- Reuse: the team builder from the entry above.
- Neighbors: `src/components/pc/pc-box.tsx`, `src/open-sheet/components/pc.tsx`.
- Forbidden: one pooled bag across sources.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account

## Add free members, and import unbacked sets as free members

A free member is a full Showdown set (any species in the team's pool, item, ability, nature, EVs, IVs, level, four moves), marked as free and counted against no bag. With "Any Pokémon" among a team's sources, the pasted sets the other sources cannot back come in as free members, listed in the dialog ([Team Building](discovery.md#team-building)).

**Do:**
- [ ] The free member editor; free members in the stored slots, the copy and the analysis.
- [ ] "Any Pokémon" as a source, added and removed like a snapshot; the import keeps backed matching and makes free members of the rest when it is a source.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: make a team whose only source is "Any Pokémon" with six free members, copy it to Showdown and check it imports there; paste a team mixing your Pokémon and others and see the free ones marked and listed.
- Reuse: `src/analysis/paste.ts`, `src/open-sheet/components/move-picker.tsx`.
- Neighbors: `src/open-sheet/showdown.ts`.
- Forbidden: free members counted against a bag.

**Touches:** `pkmn/site/src/`, `pkmn/site/api/`, `pkmn/site/shared/`, `docs/pkmn/site/`
**After:** Build teams from several snapshots, any player's

## Give each team its pool, the Pool view, Speed Tiers and Tera

Team Analysis's pool bar per team, defaulted from the series, the Pool view, Speed Tiers and the Tera toggle (gen 9 pools) join the team's Analysis ([The pool?](discovery.md#team-building)).

**Do:**
- [ ] The pool in the stored team; the pool bar, Pool view, Speed Tiers and Tera in the builder; the series' default pool in the series form.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: change a team's pool to Gen 5 and see the Tera toggle go and the percentiles change; reload and see the pool kept; open the Pool view.
- Reuse: `src/team-analysis/components/pool-bar.tsx`, `pool-view.tsx`, `src/analysis/pool.ts`.
- Neighbors: `src/pages/team-analysis.tsx`.
- Forbidden: a second pool implementation.

**Touches:** `pkmn/site/src/`, `pkmn/site/api/`, `pkmn/site/shared/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account

## Compare teams; /team-analysis and the tools list go

Compare puts 2–4 of the player's teams side by side with the scoreboard and damage calc. With it, `/team-analysis`, its page, drafts and `carryTeam`, `src/tools.ts` and the tools home are deleted ([Team Building](discovery.md#team-building), [Pages](discovery.md#pages)).

**Do:**
- [ ] Compare in the team builder over stored teams.
- [ ] Delete `src/pages/team-analysis.tsx`, `src/team-analysis/drafts.ts`, the route and the old `localStorage` drafts on load; rewrite `team-analysis.md` into the team builder's doc; update `docs/pkmn/index.md`. (`src/tools.ts`, the tools in `add-a-page-to-the-site.md`, `pkmn/site/CLAUDE.md`'s Routes rule and `site.md` went with the series page, 2026-10-23.) Rewrite the decisions in `site.md` that name `carryTeam` or `/team-analysis` to say what is true now, so the grep below holds.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "team-analysis:drafts\|carryTeam\|tools.ts\|/team-analysis" pkmn/site/src docs/pkmn` finds nothing.
- Human-run: compare three of your teams and read the scoreboard and a damage calc; open `/team-analysis` and see the not-found page.
- Reuse: `src/team-analysis/components/compare-view.tsx`, `src/analysis/compare.ts`.
- Neighbors: the team builder.
- Forbidden: keeping `/team-analysis` as a redirect.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Give each team its pool, the Pool view, Speed Tiers and Tera
