# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET`, `POST`, `PUT` or `DELETE` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Owner-run: Discord sign-in on production

Discord sign-in and the allowlist are built and checked on the local stack (2026-10-23); production needs the owner's half, as [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) step 6 describes.

**Do:**
- [ ] Owner-run: the Discord application with redirect URIs `https://pkmn.enbraile.vip/api/auth/callback/discord` and `http://localhost:5173/api/auth/callback/discord`; `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in Vercel; then push `main`, whose build migrates production (`0002_allowlist` to `0007_exports`, which the code already on `main` and deployed needs) and deploys it; check the deploy's build log shows the migrations applied.

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
- Reuse: [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md) → Verification.
- Neighbors: none.
- Forbidden: snapshots made on production by `npm run seed` or by SQL.

**Touches:** `docs/pkmn/site/`
**After:** Owner-run: start series 1 on production
**Needs the author:** the owner-run steps above.

## Colour type defenses as Pokémon Database does

The summary's type defenses colour damage taken the other way round from Pokémon Database: ×4 and ×2 red and orange, ½ and ¼ green (`--mult-*` in `src/index.css`, read only by `MULT` in `src/components/pc/summary.tsx`). The owner wants Pokémon Database's reading: ½ and ¼ red, ×2 and ×4 green, immune staying black (owner, 2026-10-25). `design/summary.dc.html` is frozen with the old colours, so the change is a decision recorded in [The pkmn Site](../../pkmn/site/explanation/site.md) rather than an edit to the board.

**Do:**
- [ ] Swap the values: `--mult-4` takes `#2a6338`, `--mult-2` `#3d8550`, `--mult-half` `#c8642f`, `--mult-quarter` `#b0302a`; `--mult-0` keeps `#0b0e15`. Update the tokens' row in the design system and record the decision, with the board it departs from, in `site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, open a PC summary's Info and see a ×2 type green and a ½ type red, an immunity black.
- Human-run: compare one Pokémon's type defenses with its Pokémon Database page and see the same colours.
- Reuse: the `--mult-*` tokens.
- Neighbors: none.
- Forbidden: raw colours in `summary.tsx`; editing `design/summary.dc.html`.

**Touches:** `pkmn/site/src/index.css`, `docs/pkmn/site/reference/design-system.md`, `docs/pkmn/site/explanation/site.md`

## Teams of up to eight, analysed whole or as a pick of six

A team holds six members by default and up to eight; its size is set like its sources, free for the owner or fixed by a tournament, and the analysis reads every member or a pick of six ([How many members does a team hold?](discovery.md#team-building), 2026-10-25).

**Do:**
- [ ] The size in the stored team (6 to 8, default 6) and its migration; the builder's size control and its cards for slots 7 and 8; the team list's rows at sizes above six; the analysis' switch between every member and a pick of six; Showdown copy and paste of more than six.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, raise a team to eight, fill it, pick six for the analysis and see it change, reload and see the size and the pick kept.
- Human-run: build an eight-member team, copy it for Showdown and paste it back as a new team.
- Reuse: the team builder from the entry above; `src/analysis/`.
- Neighbors: the team list.
- Forbidden: a size above eight.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account

## A trainer row's Teams tile opens their teams

The series page's trainer row has a Teams tile, drawn in `series.dc.html` as a link and specified as "their teams (count, opens them)" ([First page after sign-in?](discovery.md#pages)). It opens the team list filtered to that trainer, `/teams?player=<id>`, with a chip naming the trainer that clears the filter ([Where does a trainer row's Teams tile open?](discovery.md#team-building), 2026-10-25).

**Do:**
- [ ] `/teams` takes a `player` search param and lists only that player's teams, with a chip above the list naming them (their badge and name) whose close button clears it; the Teams tab keeps opening the whole list.
- [ ] The trainer row's Teams tile links to `/teams?player=<id>`, at both widths.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, with a seeded team for a test player, open their row's Teams tile, land on `/teams?player=<id>` listing only their teams under the chip, clear the chip and see every team.
- Human-run: open another trainer's Teams tile from the series page and see their teams.
- Reuse: the team list from the entry above; `Tile` in `src/pages/series.tsx`; `PlayerBadge`.
- Neighbors: the row's PC tile.
- Forbidden: a `/players/<player>/teams` route.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account
## Build teams from several snapshots, any player's

A team's sources picker takes any number of snapshots, any player's; the PC shows each source's Pokémon, and each member draws its item and Mini Setas from its own snapshot ([Item limits across several sources?](discovery.md#team-building)).

**Do:**
- [ ] The sources picker; per-source PC sections and limits.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: add another player's snapshot to a team, put one of their Pokémon in it, and see its item limited by their bag, not yours; remove that source and see the member flagged.
- Reuse: the team builder from the entry above.
- Neighbors: `src/components/pc/pc-box.tsx`, `src/teams/components/add-dialog.tsx`.
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
- Reuse: `src/analysis/paste.ts`, `src/teams/components/move-picker.tsx`.
- Neighbors: `src/teams/showdown.ts`.
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

Compare puts 2–4 teams side by side, the player's or other trainers', picked on the team list after its Compare button, with the scoreboard and damage calc. With it, `/team-analysis`, its page, drafts and `carryTeam`, `src/tools.ts` and the tools home are deleted ([Team Building](discovery.md#team-building), [Pages](discovery.md#pages)).

**Do:**
- [ ] Compare in the team builder over stored teams.
- [ ] Delete `src/pages/team-analysis.tsx`, `src/team-analysis/drafts.ts`, the route and the old `localStorage` drafts on load; rewrite `team-analysis.md` into the team builder's doc; update `docs/pkmn/index.md`. (`src/tools.ts`, the tools in `add-a-page-to-the-site.md`, `pkmn/site/CLAUDE.md`'s Routes rule and `site.md` went with the series page, 2026-10-23.) Rewrite the decisions in `site.md` that name `carryTeam` or `/team-analysis` to say what is true now, so the grep below holds.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "team-analysis:drafts\|carryTeam\|tools.ts\|/team-analysis" pkmn/site/src docs/pkmn` finds nothing.
- Human-run: compare two of your teams and another trainer's and read the scoreboard and a damage calc; open `/team-analysis` and see the not-found page.
- Reuse: `src/team-analysis/components/compare-view.tsx`, `src/analysis/compare.ts`.
- Neighbors: the team builder.
- Forbidden: keeping `/team-analysis` as a redirect.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Give each team its pool, the Pool view, Speed Tiers and Tera

## Make the site crisp and fast, pass one

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
**After:** Compare teams; /team-analysis and the tools list go

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
