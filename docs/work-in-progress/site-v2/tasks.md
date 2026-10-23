# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Bring the site docs in line with the track and the progress set by hand

Three landings of 2026-10-23 each wrote their own decision and left an earlier one false. The admin overrides (`1ce7c3e`) made a trainer's progress the hand value when set, else the latest snapshot's milestone (`progress` in `api/_lib/series-data.ts`), and the track, the phone row and the profile's Reached all read it; the track's landing (`3709376`) made the row's tiles and the PC tile follow the shown snapshot; the profile (`5b0cd60`) split the phone row's head into a profile link and a button. [The pkmn Site → Snapshots](../../pkmn/site/explanation/site.md#snapshots) already says what is true; these say otherwise:

- `site.md`, the player's profile's build choices: "Reached in `yellow` when the latest snapshot sits at the series' last milestone", while `reachedEnd` in `api/_lib/profiles.ts` compares the progress, hand value first; and "from the rest of its head, the latest milestone and the chevron", while the phone row's button shows `trainer.progress` (`src/pages/series.tsx`).
- `site.md`, the series pages' phone build choices: the phone track's `role="img"` "named for the trainer, their latest milestone and their snapshots' milestones"; its label names `trainer.progress`.
- `site.md`, the track's build choices: "the fill from the first node's centre to the latest's"; `Track` fills to the progress's node.
- `site.md`, the PC page's build choices: "the latest snapshot shown when `?snapshot=` is absent, which is how the PC tile and the PC tab link"; the PC tile now links with `?snapshot=` the shown snapshot, and only the PC tab and the player's series page's PC button open the latest.
- `site.md`, the snapshot upload's build choices: "the row's 'At <milestone>' and tiles reading the latest snapshot"; they read the shown one, the latest until another is picked.
- `design-system.md`, the series page's Trainers table below `sm`: "each row is one `min-h-13` button holding the badge …, the name …"; the badge and name are a link to the profile, and the button holds the progress and the chevron.
- `docs/pkmn/index.md`, the Site row: no mention of the player's profile, the player's series page or the admin overrides.
- `discovery.md`, The progress track?: "It shows the trainer at their latest snapshot", beside its own Admin overrides? answer that a hand value wins; say the track shows their progress.

**Do:**
- [ ] Rewrite each passage above to say what the code does, keeping each decision's date and adding none.

**Acceptance:**
- Claude-run: `grep -n "latest snapshot sits\|the latest milestone and the chevron\|their latest milestone and their snapshots\|to the latest's\|which is how the PC tile\|tiles reading the latest snapshot" docs/pkmn/site/explanation/site.md` finds nothing; each rewritten passage read against `api/_lib/profiles.ts`, `api/_lib/series-data.ts` and `src/pages/series.tsx`; every link in the touched docs resolves.
- Human-run: none.
- Reuse: [The pkmn Site → Snapshots](../../pkmn/site/explanation/site.md#snapshots), the passages' owner.
- Neighbors: `1cba46e`, the last docs sync.
- Forbidden: code changes; a new decision; rewording a decision the owner dated as theirs.

**Touches:** `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/reference/design-system.md`, `docs/pkmn/index.md`, `docs/work-in-progress/site-v2/discovery.md`

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
- [ ] Owner-run: the Discord application with redirect URIs `https://pkmn.enbraile.vip/api/auth/callback/discord` and `http://localhost:5173/api/auth/callback/discord`; `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel; `npm run db:migrate` against the production branch (migrations `0002_allowlist`, `0003_series`, `0004_saves`, `0005_tm_rolls` and `0006_overrides`, all unpushed on `main` with the code that needs them) before the push that deploys it.

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
- Human-run: as admin on production, correct a snapshot's milestone with Move and see it on the series page; set a player's progress by hand and see their track move to it; clear it and see the latest snapshot's milestone again.
- Reuse: [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) → Verification.
- Neighbors: none.
- Forbidden: snapshots made on production by `npm run seed` or by SQL.

**Touches:** `docs/pkmn/site/`
**After:** Owner-run: start series 1 on production
**Needs the author:** the owner-run steps above.

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
- [ ] Teams table and migration (owner, sources, slots); team routes, the owner alone writing; `npm run seed` extended with a team on the seeded snapshot; the header's Teams tab opening `/teams` (`TEAMS_TAB` in `src/components/site-header.tsx`, today `/team-analysis`); the trainer row's Teams tile counting the trainer's teams, and the Teams box on each of the profile's series banners (`src/pages/player-profile.tsx`, `api/_lib/profiles.ts`, `shared/profile.ts`, "—" today) counting the player's teams in that series.
- [ ] Move Open Sheet's builder under `/teams/<id>` on stored snapshots; delete `/open-sheet`, `src/open-sheet/db.ts`, the import tabs and Dexie, and the browser's old database on first load.
- [ ] Rewrite `open-sheet.md` as the team builder's doc (rename it) and update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "dexie\|open-sheet:tab" pkmn/site/src pkmn/site/package.json` finds nothing.
- Human-run: make a team on your series 1 snapshot, give items until one runs out, switch an ability and see the Mini Seta count, copy it for Showdown and paste it back as a new team; reload on another device and see the teams; open another player's team read-only.
- Reuse: `src/open-sheet/team.ts`, `showdown.ts`, `components/team-view.tsx`, `sheet-analysis.tsx`; the PC's pieces in `src/components/pc/` (`pc-box.tsx`, `summary.tsx`, `bag.tsx`), not copies; `snapshotSchema` in `shared/snapshot.ts` for the stored snapshot; `src/analysis/`; `src/open-sheet/dex.ts`, which `src/components/pc/` and the player's series page's fallen (`describeMember` in `src/pages/player-series.tsx`) import, moved with its importers rather than copied.
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
- [ ] JSON in the upload flow (player and admin), the drop zone reading "or an export" and the done step after `upload-done-json.dc.html`; the warning chip on the row and the PC page's "Export missing" line (left out until now, [The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions), the PC page's and the upload's build choices); the missing-field report saying when an export's `moves` predate TM rolling, for the team builder's entry below.
- [ ] Record in the snapshot format's reference which fields old exports lack and how the site reads them.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, upload `saves/Vicky-open-sheet.json` and `saves/MIRAMEEE-open-sheet.json` for two test players, see each warning on the series page and the PC page, open a Pokémon's summary in each with its Stats tab's "At Level 50" ranges shown, and open the bag; upload a JSON with one entry missing its species and read "1 skipped"; upload a file that is not JSON and read its refusal.
- Human-run: upload the two exports for MIRAMEEE and Vicky on production and open their PCs.
- Reuse: `sheetSchema` and `snapshotSchema` in `shared/snapshot.ts` (which `src/open-sheet/schema.ts` re-exports), made lenient rather than copied; `ingest` in `api/_lib/ingest.ts`.
- Neighbors: the save zip upload.
- Forbidden: refusing an export for a missing field; a second schema for old exports.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`, `docs/pkmn/site/reference/snapshot.md`

## Mark an old export's unrolled TM moves unchecked in the team builder

Split out of the old exports' entry above, the one part of it that needs the team builder: an export whose `moves` predate TM rolling has them marked unchecked when they are picked for a team ([Exports from older versions](discovery.md#snapshots-in)), and a team built from each old export shows its Level 50 ranges.

**Do:**
- [ ] `moves` without rolled TMs marked unchecked in the move picker, read from the snapshot's missing-field report.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, build a team from each of the two old exports uploaded as in the entry above, see Level 50 ranges shown, and see MIRAMEEE's TM moves marked unchecked in the move picker while a save zip's snapshot's are not.
- Human-run: build a team from MIRAMEEE's export on production and see its TM moves marked unchecked.
- Reuse: `src/open-sheet/components/move-picker.tsx` as the team builder moved it; the missing-field report from the entry above.
- Neighbors: the team builder's member cards.
- Forbidden: refusing a move for being unchecked; a second move picker.

**Touches:** `pkmn/site/src/`, `pkmn/site/shared/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account; Upload old exports as snapshots, with warnings for what they lack

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
