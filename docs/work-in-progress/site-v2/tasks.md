# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Owner-run: Discord sign-in on production

Discord sign-in and the allowlist are built and checked on the local stack (2026-10-23); production needs the owner's half, as [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) step 6 describes.

**Do:**
- [ ] Owner-run: the Discord application with redirect URIs `https://pkmn.enbraile.vip/api/auth/callback/discord` and `http://localhost:5173/api/auth/callback/discord`; `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel; then push `main`, whose build migrates production (`0002_allowlist` to `0011_pools`, which the code on `main` needs; `origin/main` holds migrations up to `0007_exports`) and deploys it; check the deploy's build log shows the migrations applied.

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
- [ ] Owner-run: as admin at `/admin/games`, make the game "Pokémon Añil + Randomlocke" and upload its zip (production was emptied of test data on 2026-10-25, the old "Test game" with it); then at `/admin/series`, make series 1 on that game, the daytime route, manual ingestion, its players from the allowlist (invite them by Discord user ID at `/admin/players` first, or add them once it runs), milestones Gym 1 to Gym 8, Post-League and Tournament with rounds as its rules set, and its rules pasted from `docs/pkmn/series/1/reference/rules.md`; start it.

**Acceptance:**
- Claude-run: none.
- Human-run: as admin, invite a player by Discord user ID and see them under Allowed, marked Invited; make the draft and see the checklist list what is missing; fill it in until Start enables; start it. As an allowed player of it, sign in and land on its page, read its rules, download its game; as an allowed player not in it, see no Download. Make a second draft by "Copy from" series 1, see the rules copied, and delete it. Open `/series` and see series 1's banner on its moving scene, marked playing now; turn on reduced motion and see the scenes stand still. On a phone, signed in as an admin and as a player, reach every tab and sign-out from the header's menu.
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
- [ ] Owner-run: as admin, upload MIRAMEEE's and Vicky's old exports (`pkmn/site/saves/MIRAMEEE-open-sheet.json`, `Vicky-open-sheet.json`) for them, the production half of the old exports' entry, which landed in `e87655d` with its local checks done and its production check carried here.

**Acceptance:**
- Claude-run: none.
- Human-run: as a player of series 1 on production, upload your save zip from your row, see the suggested milestone, save it and read "<milestone> saved" with the Pokémon count and the TM rolls row; download the rolled zip from the done step and from the snapshot chip, and see it named as your zip; click "Open PC" and see your PC at that snapshot, its summary and its bag; as another player, open the first player's row and see their snapshot chips without a download button; as admin, upload for a player and replace their snapshot, and read the amber warning first.
- Human-run: as admin on production, correct a snapshot's milestone with Move and see it on the series page; set a player's progress by hand and see their track move to it; clear it and see the latest snapshot's milestone again.
- Human-run: as admin on production, upload Vicky's export for her and read the done step's "Missing: IVs, EVs, stats · moves" chip, with no TM rolls row; upload MIRAMEEE's and read "Missing: IVs, EVs, stats · TM rolls"; on `/series/1` see no download button on their chips; open each one's PC and see the Stats tab's warning of the missing IVs, EVs and stats with "—" for them and the Lv 50 ranges, and on Vicky's the Moves tab's "No moves in this export", on MIRAMEEE's the missing TM rolls over "Can learn" ([Snapshot Format → Old Exports](../../pkmn/site/reference/snapshot.md#old-exports)).
- Human-run: as a player of series 1 on production, "Add to team" from your PC's summary into a new team, open it from `/teams` on another device and see it there, the production half of the stored teams' entry (`1270388`, `0324efe`), whose checks ran on the local stack only ([Team Builder → Stored Teams](../../pkmn/site/explanation/team-builder.md#stored-teams)).
- Human-run: on production, the human halves of the team entries that landed on the local stack only (`62e0503`, `cb840cb`, `5c42c8c`, `9f4b338`, `2e49ee9`): open another trainer's Teams tile from `/series/1` and see their teams; add another player's snapshot to a team of yours, put one of their Pokémon in it and see its item limited by their bag, its source's chip without a remove button until the member is taken out; make a team whose only source is "Any Pokémon" with six free members, copy it to Showdown and check it imports there; change a team's pool to Gen 5, see the Tera toggle go and the percentiles change, reload and see the pool kept; compare two of your teams and another trainer's and read the scoreboard and a damage calc; open `/team-analysis` and see the not-found page ([Team Builder](../../pkmn/site/explanation/team-builder.md)).
- Human-run: on production, open the series page, the player's series page, the PC, the team list and a team on a phone and feel whether the four performance passes (`04b8790`, `a0bca41`, `2ec4e0b`, `1e2fd84`) made them crisp ([The pkmn Site → Performance](../../pkmn/site/explanation/site.md#performance)).
- Reuse: [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) → Verification.
- Neighbors: none.
- Forbidden: snapshots made on production by `npm run seed` or by SQL.

**Touches:** `docs/pkmn/site/`
**After:** Owner-run: start series 1 on production
**Needs the author:** the owner-run steps above.

## "Add to team" on another player's PC

The PC's one link to teams is "Add to team" in its summary, a menu of the reader's teams and "New team" ([How do the PC and the team pages split?](discovery.md#team-building)). The build shows it only on the reader's own PC, "until its entry settles what it does on another's" ([Team Builder → Decisions](../../pkmn/site/explanation/team-builder.md#decisions), "The team builder's build choices"; `useOwnTeams` in `src/teams/components/add-to-team.tsx`, which lists only the reader's teams that already have that snapshot as a source, on their own PC too). A team may hold any player's snapshot since `cb840cb`, so scouting an opponent from their PC is the case discovery names for it, and neither discovery nor the boards say what the menu does there.

**Do:**
- [ ] Per the author's answers: "Add to team" on another player's PC summary, its menu, and what picking a team or "New team" does to the team's sources.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, as `blue`, open Red's PC, "Add to team" a Pokémon into one of Blue's teams and see it there with Red's snapshot among its sources.
- Human-run: from another trainer's PC, add one of their Pokémon to a team of yours and open it.
- Reuse: `src/teams/components/add-to-team.tsx`; `PUT /api/teams/<id>` with `sources` (`api/_lib/teams.ts`), which the team page's **+ Source** writes.
- Neighbors: `src/components/pc/summary.tsx`, `src/pages/pc.tsx`.
- Forbidden: writing to another player's team.

**Touches:** `pkmn/site/src/teams/components/add-to-team.tsx`, `pkmn/site/src/components/pc/`, `pkmn/site/src/pages/pc.tsx`, `docs/pkmn/site/explanation/team-builder.md`
**Needs the author:**
- Does another player's PC summary show "Add to team" at all? Recommended: yes, since it is the PC's one link to teams and discovery names scouting an opponent as a reason for any player's snapshot; the alternative keeps it on the reader's own PC and adds others' snapshots only from the team page's **+ Source**.
- If it shows, does its menu list every team of the reader's, picking one adding this snapshot to that team's sources when it is not one already, and "New team" making a team on this snapshot? Recommended: yes; the alternative lists only the reader's teams that already have this snapshot as a source. The reader's own PC lists only those today, so the answer sets its menu too.

## Keep Radix Select out of the entry script

Pass four found the entry script carrying Radix's Select and Floating UI on every page: `SiteShell` (`src/components/site-shell.tsx`) imports `WaitingPage` statically, `src/pages/waiting.tsx` imports `buttonClass` from `src/components/controls.tsx`, and that file also holds `SelectField`, over `src/components/ui/select.tsx`. Split off in a trial build they made a 31 kB compressed chunk ([The pkmn Site → Performance](../../pkmn/site/explanation/site.md#performance), pass four, and its "What stays"). Confirmed 2026-10-25 by a build of `1e2fd84`: the entry chunk (`assets/index-*.js`, 121 kB gzipped) holds `radix-select-viewport` and `SelectViewport`. The owner's four passes are done; this is the cost pass four named and left, inside the chunk-per-route decision ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions), "Each page is its own chunk").

**Do:**
- [ ] Move `SelectField` out of `src/components/controls.tsx` into a file of its own under `src/components/`, and point its importers at it (`src/components/pc/pc-box.tsx`, `src/components/trainer-admin.tsx`, `src/components/analysis/members.tsx`, `src/components/analysis/team-graph.tsx`, `src/pages/admin-series.tsx`, `src/teams/components/pool-view.tsx`, `src/teams/components/free-member.tsx`, `src/teams/components/compare-view.tsx`), so no module the root route imports reaches `src/components/ui/select.tsx`.
- [ ] Measure before and after with pass four's method (its server, profiles, ready marks and three-load medians) on the pages that no longer load Select, and record it under pass four in `site.md`'s Performance with the fix as a dated decision; update `SelectField`'s row in the design system's Shared table.

**Acceptance:**
- Claude-run: `npm run gate`; `npm run build`, and the entry chunk `dist/assets/index-*.js` holds no `radix-select`; the before and after figures, from the same measurement, in `site.md`; through `verify-site`, every dropdown still opens and picks: the PC's type filter, the series form's selects and the Admin panel's Progress and milestone selects on the series page, the Members view's selects, the graph's layout, the Pool view's type filter, a free member's Set, and Compare's Attacker, Defender and Move pickers.
- Human-run: none.
- Reuse: `npm run build`'s chunk report; pass four's measurement script and profiles as `site.md` describes them.
- Neighbors: `src/components/site-shell.tsx`, `src/pages/waiting.tsx`, `src/router.tsx`.
- Forbidden: changing what any select looks like or does; a figure in a doc that this entry did not measure; a new runtime dependency.

**Touches:** `pkmn/site/src/components/`, `pkmn/site/src/pages/admin-series.tsx`, `pkmn/site/src/teams/components/`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/reference/design-system.md`

## The team builder's build choices that settle what the owner chose

Four of the build choices recorded on 2026-10-25 as "delegated build choices in an unattended run" ([Team Builder → Decisions](../../pkmn/site/explanation/team-builder.md#decisions)) decide something discovery or the signed-off boards leave open, or read against an owner decision. Compare (`2e49ee9`) kept the board's scoreboard and one-hit damage calc and dropped the old tool's longer scoreboard, its Head-to-head matrix of each attacker's strongest hit on each defender, its Fingerprints and its By type panels ("Compare's build choices"), all of which came from PokeGraph, while "All of PokeGraph's features come over" (owner, 2026-10-17) stands, and discovery's "Compare, Speed Tiers, Tera? A: All come over"; the decision's second sentence, "Compare is the Site v2 board's … _(owner, 2026-10-25)_", credits the owner with that narrowing, where the owner signed off a board that draws none of those panels (`compare.dc.html`, `compare-phone.dc.html`). A free member's move picker (`5c42c8c`) lists every Gen 1–5 move rather than its species' learnset ("The free members' build choices"), where discovery says "four moves". The Tera toggle and each member's Tera type (`9f4b338`) are the reader's view state, held only while the page is open, not stored with the team nor written by Copy for Showdown ("The pool's build choices"). The Analyse switch and the pick of six (`localStorage`, `team-pick:<id>`) are each reader's own, so another reader sees the first six filled rather than the owner's pick; `team.dc.html`'s sign-off has it "open to any reader since it only changes what they look at" ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions), "The team builder is signed off at desktop width"), which supports the build.

**Do:**
- [ ] Per the author's answers: keep each choice and record the owner's confirmation in its decision, or change the code and the decision to the answer.

**Acceptance:**
- Claude-run: `npm run gate` when code changes; through `verify-site`, the views an answer changes; `team-builder.md` and `discovery.md` no longer read against each other on Compare.
- Human-run: none beyond the production checks of "Owner-run: upload series 1's saves on production".
- Reuse: `src/analysis/compare.ts` and the old panels in `git show 2e49ee9^:pkmn/site/src/team-analysis/components/compare-view.tsx`; `src/teams/components/move-picker.tsx` and `src/teams/dex.ts`; `src/teams/pick.ts`; `src/components/analysis/members.tsx`.
- Neighbors: `src/teams/components/compare-view.tsx`, `src/teams/components/sheet-analysis.tsx`, `src/teams/showdown.ts`.
- Forbidden: editing the frozen boards; settling an answer the author did not give.

**Touches:** `pkmn/site/src/analysis/compare.ts`, `pkmn/site/src/teams/`, `pkmn/site/src/components/analysis/`, `pkmn/site/shared/team.ts`, `pkmn/site/api/_lib/teams.ts`, `docs/pkmn/site/explanation/team-builder.md`
**Needs the author:**
- Compare: keep it as the board draws it, a scoreboard and a one-hit damage calc, or bring back the old tool's Head-to-head matrix, Fingerprints and By type panels below it? Recommended: keep it, since the owner signed off a Compare board without them on 2026-10-25, after the 2026-10-17 decision, and record "All of PokeGraph's features come over" as narrowed for Compare; the alternative restores the three panels under the board's two.
- A free member's moves: every Gen 1–5 move, as built, or its species' learnset? Recommended: every move, since fights are a "[Gen 9] Custom Game", which checks no learnset, and a free member is theorycraft; the alternative lists its species' Showdown learnset and marks any other move in the warning colour, as a snapshot member's unlearnable moves are.
- Tera types: the reader's view state, as built, or stored with the team by its owner and written by Copy for Showdown as `Tera Type:`? Recommended: view state, since nothing in discovery or the boards stores them and the series 1 rules do not name Tera; the alternative stores each member's Tera type in its slot.
- The pick of six: each reader's own, as built, or the owner's pick stored with the team as every reader's default? Recommended: each reader's own, as the desktop sign-off reads; the alternative stores the owner's pick on the team, each reader still free to change their view.
