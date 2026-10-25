# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Owner-run: Discord sign-in on production

Discord sign-in and the allowlist are built and checked on the local stack (2026-10-23); production needs the owner's half, as [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) step 6 describes.

**Do:**
- [ ] Owner-run: the Discord application with redirect URIs `https://pkmn.enbraile.vip/api/auth/callback/discord` and `http://localhost:5173/api/auth/callback/discord`; `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel; then push `main`, whose build migrates production (`0002_allowlist` to `0009_team_size`, which the code already on `main` and deployed needs) and deploys it; check the deploy's build log shows the migrations applied.

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
- Reuse: [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) → Verification.
- Neighbors: none.
- Forbidden: snapshots made on production by `npm run seed` or by SQL.

**Touches:** `docs/pkmn/site/`
**After:** Owner-run: start series 1 on production
**Needs the author:** the owner-run steps above.

## "Add to team" on another player's PC

The PC's one link to teams is "Add to team" in its summary, a menu of the reader's teams and "New team" ([How do the PC and the team pages split?](discovery.md#team-building)). The one-snapshot build shows it only on the reader's own PC, "until sources may be any player's" ([Team Builder → Decisions](../../pkmn/site/explanation/team-builder.md#decisions), "The team builder's build choices"; `src/teams/components/add-to-team.tsx`, which lists only the reader's teams on that snapshot). Once a team may hold any player's snapshot, scouting an opponent from their PC is the case discovery names for it, and neither discovery nor the boards say what the menu does there.

**Do:**
- [ ] Per the author's answers: "Add to team" on another player's PC summary, its menu, and what picking a team or "New team" does to the team's sources.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, as `blue`, open Red's PC, "Add to team" a Pokémon into one of Blue's teams and see it there with Red's snapshot among its sources.
- Human-run: from another trainer's PC, add one of their Pokémon to a team of yours and open it.
- Reuse: `src/teams/components/add-to-team.tsx`; the sources routes from the entry above.
- Neighbors: `src/components/pc/summary.tsx`, `src/pages/pc.tsx`.
- Forbidden: writing to another player's team.

**Touches:** `pkmn/site/src/teams/components/add-to-team.tsx`, `pkmn/site/src/components/pc/`, `pkmn/site/src/pages/pc.tsx`, `docs/pkmn/site/explanation/team-builder.md`
**After:** Build teams from several snapshots, any player's
**Needs the author:**
- Does another player's PC summary show "Add to team" at all? Recommended: yes, since it is the PC's one link to teams and discovery names scouting an opponent as a reason for any player's snapshot; the alternative keeps it on the reader's own PC and adds others' snapshots only from the team page's **+ Source**.
- If it shows, does its menu list every team of the reader's, picking one adding this snapshot to that team's sources when it is not one already, and "New team" making a team on this snapshot? Recommended: yes; the alternative lists only the reader's teams that already have this snapshot as a source.

## Make the site crisp and fast, pass two

The owner wants the site to feel crisp and fast, and to hold up under load: one of four identical passes, each taking the biggest measured cost it finds (owner, 2026-10-25). Nothing measures the site's speed today; the one standing performance decision is a chunk per route ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions)).

**Do:**
- [ ] Measure the site on the local stack with `npm run build` and the `web-perf` skill: load and interaction on the series page, the player's series page, the PC and its summary, the team pages that exist by then, at desktop and phone widths; and the API's slowest routes and their queries under repeated requests. Earlier passes' figures are in `site.md`.
- [ ] Fix the largest cost found that changes nothing a reader sees or can do (bundle weight, waterfalls, re-renders, image and sprite loading, query count and shape, missing indexes, response size, caching headers), then measure again.
- [ ] Record what was measured before and after, and why that cost was the biggest, under a Performance section of `site.md`, with each fix as a dated decision.

**Acceptance:**
- Claude-run: `npm run gate`; the before and after figures, from the same measurement, in `site.md`; through `verify-site`, the pages the fix touched still work.
- Human-run: on production after a push, open the pages the fix touched and feel the difference.
- Reuse: `web-perf`; the route chunks in `src/router.tsx`; the queries in `api/_lib/`.
- Neighbors: `vite.config.ts`.
- Forbidden: removing or hiding anything a page shows to make it faster; a new outside service, host or runtime dependency without the owner's call (queue it as a question instead); a figure in a doc that the pass did not measure.

**Touches:** `pkmn/site/`, `docs/pkmn/site/`
**After:** Make the site crisp and fast, pass one

## Make the site crisp and fast, pass three

The owner wants the site to feel crisp and fast, and to hold up under load: one of four identical passes, each taking the biggest measured cost it finds (owner, 2026-10-25). Nothing measures the site's speed today; the one standing performance decision is a chunk per route ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions)).

**Do:**
- [ ] Measure the site on the local stack with `npm run build` and the `web-perf` skill: load and interaction on the series page, the player's series page, the PC and its summary, the team pages that exist by then, at desktop and phone widths; and the API's slowest routes and their queries under repeated requests. Earlier passes' figures are in `site.md`.
- [ ] Fix the largest cost found that changes nothing a reader sees or can do (bundle weight, waterfalls, re-renders, image and sprite loading, query count and shape, missing indexes, response size, caching headers), then measure again.
- [ ] Record what was measured before and after, and why that cost was the biggest, under a Performance section of `site.md`, with each fix as a dated decision.

**Acceptance:**
- Claude-run: `npm run gate`; the before and after figures, from the same measurement, in `site.md`; through `verify-site`, the pages the fix touched still work.
- Human-run: on production after a push, open the pages the fix touched and feel the difference.
- Reuse: `web-perf`; the route chunks in `src/router.tsx`; the queries in `api/_lib/`.
- Neighbors: `vite.config.ts`.
- Forbidden: removing or hiding anything a page shows to make it faster; a new outside service, host or runtime dependency without the owner's call (queue it as a question instead); a figure in a doc that the pass did not measure.

**Touches:** `pkmn/site/`, `docs/pkmn/site/`
**After:** Make the site crisp and fast, pass two

## Make the site crisp and fast, pass four

The owner wants the site to feel crisp and fast, and to hold up under load: one of four identical passes, each taking the biggest measured cost it finds (owner, 2026-10-25). Nothing measures the site's speed today; the one standing performance decision is a chunk per route ([The pkmn Site → Decisions](../../pkmn/site/explanation/site.md#decisions)).

**Do:**
- [ ] Measure the site on the local stack with `npm run build` and the `web-perf` skill: load and interaction on the series page, the player's series page, the PC and its summary, the team pages that exist by then, at desktop and phone widths; and the API's slowest routes and their queries under repeated requests. Earlier passes' figures are in `site.md`.
- [ ] Fix the largest cost found that changes nothing a reader sees or can do (bundle weight, waterfalls, re-renders, image and sprite loading, query count and shape, missing indexes, response size, caching headers), then measure again.
- [ ] Record what was measured before and after, and why that cost was the biggest, under a Performance section of `site.md`, with each fix as a dated decision.

**Acceptance:**
- Claude-run: `npm run gate`; the before and after figures, from the same measurement, in `site.md`; through `verify-site`, the pages the fix touched still work.
- Human-run: on production after a push, open the pages the fix touched and feel the difference.
- Reuse: `web-perf`; the route chunks in `src/router.tsx`; the queries in `api/_lib/`.
- Neighbors: `vite.config.ts`.
- Forbidden: removing or hiding anything a page shows to make it faster; a new outside service, host or runtime dependency without the owner's call (queue it as a question instead); a figure in a doc that the pass did not measure.

**Touches:** `pkmn/site/`, `docs/pkmn/site/`
**After:** Make the site crisp and fast, pass three
