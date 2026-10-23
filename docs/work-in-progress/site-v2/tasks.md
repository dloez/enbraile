# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands. A route on a method other than `GET` or `POST` also gets that method's export in `api/index.ts`: the local API (`scripts/dev-api.ts`) serves every method, Vercel only the exported ones.

## Design the sign-in and waiting pages

The Discord sign-in page and the page a signed-in player not yet allowed sees, desktop and phone, in the signed-off look ([Pages → Design](discovery.md#pages)).

**Do:**
- [ ] Build them on the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas.
- [ ] Get the owner's sign-off; copy the signed-off boards into `pkmn/site/design/` and record the sign-off in `docs/pkmn/site/explanation/site.md` → Look and Decisions.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner opens the boards and signs them off, or lists changes.
- Reuse: the frozen boards in `pkmn/site/design/`.
- Neighbors: the canvas's earlier phone sign-in board.
- Forbidden: colours or pieces outside the look without naming them as additions; helper text.

**Touches:** `pkmn/site/design/`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** sign-off on the sign-in and waiting pages.

## Design the upload flow, the PC page, the team list and the team builder

The rest of the screens, desktop and phone, in the signed-off look ([Pages → Design](discovery.md#pages)): the upload flow (where it starts, the slot and milestone pick), the PC page with its snapshot picker, the team list, the team builder (sources picker, free member editor, the analysis views including Pool and Compare), and phone layouts of the series list and series page. The PC, bag and team views carry their content over from Open Sheet and Team Analysis.

**Do:**
- [ ] Build them on the [Site v2 Screens](https://claude.ai/artifact/JZpaCYGx2NQtPpcvAWYXrZ) canvas.
- [ ] Get the owner's sign-off; copy the signed-off boards into `pkmn/site/design/` and record the sign-off in `docs/pkmn/site/explanation/site.md` → Look and Decisions.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner opens the boards and signs them off, or lists changes.
- Reuse: the frozen boards in `pkmn/site/design/`; [Open Sheet Screens](https://claude.ai/artifact/SfpFcW5UoLVLeLAmdJZMG1) and [Team Analysis Screens](https://claude.ai/artifact/4tyDvGNZXHqSRAvABaszfH) for what each view holds.
- Neighbors: the canvas's PC board.
- Forbidden: colours or pieces outside the look without naming them as additions; helper text.

**Touches:** `pkmn/site/design/`, `docs/pkmn/site/explanation/site.md`
**Needs the author:** sign-off on these screens.

## The header fits a phone with every tab and sign-out

The signed-off header holds Series · PC · Teams (· Admin for admins) and sign-out at the right ([Look](../../pkmn/site/explanation/site.md#look)), but the frozen boards (`pkmn/site/design/series.dc.html`, `series-list.dc.html`) draw it at desktop width only, and the next design entries name phone layouts of their own screens, not of the header. Today's header (`src/components/site-header.tsx`) fits a phone with its two tabs; each tab is a fixed `h-12 px-3` box with a pixel icon and a `text-2xl` label, and the nav does not wrap or scroll, so the Series tab, the Admin tab and sign-out from the entries below push it past a 375px screen. [Design System](../../pkmn/site/reference/design-system.md) → Layout Shell's phone rules already have tab bars scroll sideways (`overflow-x-auto`).

**Do:**
- [ ] The header at phone width as the answer below says, with the tabs and sign-out the entries below add; [Design System](../../pkmn/site/reference/design-system.md) → Layout Shell updated.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, `browser_resize` to 390×844 and to 360×800, signed in as an admin with every tab present, screenshot the header and confirm no horizontal page scroll.
- Human-run: on a phone, open the site signed in as an admin and reach every tab and sign-out.
- Reuse: `TABS` in `src/components/site-header.tsx`; `PixelIcon`.
- Neighbors: Open Sheet's tab bar (`src/open-sheet/components/tab-bar.tsx`), which scrolls sideways with `overflow-x-auto`.
- Forbidden: a hamburger menu or any piece outside the look without naming it as an addition; dropping a tab at phone width.

**Touches:** `pkmn/site/src/components/site-header.tsx`, `docs/pkmn/site/reference/design-system.md`
**Needs the author:** the header's phone layout: the tabs scroll sideways under the design system's existing phone rule, with sign-out staying in view (recommended, nothing new to design), or a phone board of the header on the Site v2 Screens canvas first?

## Players sign in with Discord and admins keep the allowlist

Discord sign-in through Better Auth; a signed-in player who is not allowed sees the waiting page, an allowed one an empty home. The admin's allowlist page lists everyone who has signed in and allows or removes them.

**Do:**
- [ ] The Discord provider (owner-run: the Discord application, its redirect URIs for production and localhost, its secrets in Vercel).
- [ ] An `allowed` flag on players, the admin allowlist page, the waiting page, the site header's sign-out.
- [ ] Every API route but sign-in refuses players not allowed.
- [ ] Extend `npm run seed` so the test players are allowed but one, who waits; the Discord variables named in `.env.example`; [How to Verify the Site](../../pkmn/site/how-to/verify-the-site.md)'s sign-ins say which test player waits.

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`.
- Claude-run: through Playwright MCP, a test player not allowed sees the waiting page, and after the admin allows them, the home.
- Human-run: on production, sign in with Discord as a new user and see the waiting page; as an admin in another browser, allow them; reload and see the home; remove them and see the waiting page again.
- Reuse: `api/_lib/auth.ts`, `api/_lib/admin.ts` (`requireAdmin`), `scripts/accounts.ts`, `src/lib/auth-client.ts`, `src/lib/api.ts` with a zod schema in `shared/`.
- Neighbors: the `/admin` pages (`src/pages/admin.tsx`, `src/pages/admin-games.tsx`).
- Forbidden: an admin account linked to Discord; admin powers on a Discord session.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `pkmn/site/.env.example`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Design the sign-in and waiting pages

## Admins create and start series; players land on the current one

The series form (number, name, game, players from the allowlist, milestones, Markdown rules with "copy from series"), the start checklist, and the draft → running → finished states ([Accounts and Access](discovery.md#accounts-and-access)). Each series gets a background scene from a fixed set (a night sky and a daytime route so far), each animated. `/series` lists the series on their scenes, and a player lands on the running series' page as signed off ([Pages](discovery.md#pages)): the scene header with the name and the game's box and download, the League placeholder, the Trainers table with its rows opening into PC, Teams and snapshot tiles, and the rules. Series 1 is created through it, its rules pasted from `docs/pkmn/series/1/reference/rules.md`. The home page's tool list gives way to this page for signed-in players.

**Do:**
- [ ] Series, series players and milestones tables and migration; the admin series list, form and checklist; starting and finishing a series.
- [ ] Extend `npm run seed` with series 1 on the seeded game, its test players in it.
- [ ] The scene component: the night sky and the daytime route as pixel SVG, their stepped animations, still under `prefers-reduced-motion`; the scene picker in the series form.
- [ ] `/series` and `/series/<n>` as in the frozen boards, the Series tab, and the landing redirect; the game's download for players of a linked series; the Markdown rules rendered (a pinned Markdown renderer, no raw HTML).
- [ ] Rewrite `site.md`'s decision "A hub per series, agreed in direction" (2026-10-21: the home page lists the series, Open Sheet and Team Analysis under each hub), which site v2's sections and series pages replace ([Pages](discovery.md#pages)).

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`.
- Human-run: as admin, make a draft series and see the checklist list what is missing; fill it in item by item until "Start" enables; start it. As an allowed player of it, sign in and land on its page, read its rules, download its game. As an allowed player not in it, see no download. Make a second draft by "copy from series 1" and see the rules copied. Open `/series`: each series on its moving scene, the running one marked playing now; hover a banner and see it lift. On the series page, open a trainer's row and see their PC, Teams and snapshot tiles; turn on reduced motion and see the scenes stand still.
- Reuse: `pkmn/site/design/series-list.dc.html` and `pkmn/site/design/series.dc.html`; the games from `api/_lib/games.ts` and `shared/games.ts`, and `downloadUrl` in `api/_lib/files.ts` for the players' download; the allowlist from the entry above; `Panel` and `liftCardClass` in `src/components/controls.tsx`, `PlayerBadge`, `PixelIcon`.
- Neighbors: `src/pages/home.tsx`.
- Forbidden: rules enforced in team building; raw HTML in rendered rules; the boards' sample data; a series switcher on the series page; Fainted or Lives tiles (open in [Backlog → how does the site gather each trainer's data?](../backlog.md#pkmnsite-how-does-the-site-gather-each-trainers-data)).

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `pkmn/site/package.json`, `pkmn/site/package-lock.json`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Players sign in with Discord and admins keep the allowlist

## Players upload their save zip as a snapshot

The export ported to TypeScript in the site, run in a Vercel Function on the save zip the browser put in B2 ([Snapshots In](discovery.md#snapshots-in), [The export?](discovery.md#data-stack-and-config)). `generate_export_data.py` writes the export's data as JSON for the site; the port reads the zip, lists its `Partida N.rxdata` slots, and exports with moves always and the TM rolls thrown away. The player picks the slot and milestone on their row of the series page; the row then shows the snapshot with its Pokémon count. Uploading again to a milestone replaces it. An admin can upload for any player.

**Do:**
- [ ] `generate_export_data.py` writes the data JSON into the site; port the Ruby Marshal reader, slot pick, abilities, moves and items.
- [ ] Saves and snapshots tables and migration; the zip kept in B2 under its snapshot; the upload flow; a failed export shows its reason.
- [ ] Extend `npm run seed` with a snapshot for a test player, uploaded from a save zip in `pkmn/site/saves/` when one is there ([Local data to check with?](discovery.md#observability-and-verification)).
- [ ] Move [Open Sheet JSON](../../pkmn/games/anil/reference/open-sheet-json.md) to be the snapshot format's reference.

**Acceptance:**
- Claude-run: `npm run gate`; for a save zip the owner provides, the port's JSON equals `uv run pkmn/games/anil/export_data.py --save <zip> --moves` except for TM rolls (`diff` after stripping rolled entries).
- Human-run: upload your series 1 zip as "Post-League" and see the count on your row; upload it again and see one snapshot, replaced; as admin, upload another player's zip for them; upload a zip without a save and read its refusal.
- Reuse: `pkmn/site/src/open-sheet/schema.ts` (the export's zod schema); the games' presigned upload in three steps (`uploadUrl` and `objectSize` in `api/_lib/files.ts`, the `/upload` and `/file` routes in `api/_lib/games.ts`, `putFile` in `src/lib/api.ts`).
- Neighbors: `pkmn/games/anil/export_data.py`.
- Forbidden: Python in the site's functions; offering the rolled zip back.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `pkmn/site/package.json`, `pkmn/site/package-lock.json`, `pkmn/games/anil/generate_export_data.py`, `docs/pkmn/games/anil/`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Admins create and start series; players land on the current one; Design the upload flow, the PC page, the team list and the team builder

## Retire export_data.py

Players upload on the site now, so the Python export and its CLI go, `--moves` with them ([The export?](discovery.md#data-stack-and-config)).

**Do:**
- [ ] Delete `pkmn/games/anil/export_data.py`; drop its excludes from `pyproject.toml` and its line in `pkmn/games/anil/CLAUDE.md`.
- [ ] Delete `docs/pkmn/games/anil/how-to/run-the-open-sheet-export.md`; fold what still holds of `open-sheet-export.md` into the site's docs or the snapshot reference; update `runtime-design.md`, `docs/pkmn/index.md` and every link (`grep -rn "export_data\|open-sheet-export\|run-the-open-sheet-export" docs pkmn`).

**Acceptance:**
- Claude-run: from `pkmn/games/anil/`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run ty check`; `grep -rn "export_data.py\|--moves" docs pkmn .claude` finds nothing outside git history.
- Human-run: none.
- Reuse: none.
- Neighbors: none.
- Forbidden: a stub or redirect left for the old script.

**Touches:** `pkmn/games/anil/`, `docs/pkmn/games/anil/`, `docs/pkmn/index.md`
**After:** Players upload their save zip as a snapshot

## Browse any player's PC at any snapshot

`/series/<n>/players/<player>?snapshot=<milestone>`: Open Sheet's PC, summary and bag over a stored snapshot, with a snapshot picker; every player's row on the series page links to it ([Model](discovery.md#model)). `/open-sheet` keeps working until teams move.

**Do:**
- [ ] A snapshot read route; the PC page reading it through the export's schema.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: open another player's PC from the series page; search, filter by type, open a summary and the bag; switch snapshot when there are two; on a phone, the same.
- Reuse: `src/open-sheet/components/pc.tsx`, `summary.tsx`, `bag.tsx`, `src/open-sheet/dex.ts`.
- Neighbors: `src/pages/open-sheet.tsx`.
- Forbidden: a second copy of the PC components.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `docs/pkmn/site/`
**After:** Players upload their save zip as a snapshot

## Build teams locked to a snapshot, stored in the account

`/teams` lists the player's teams; `/teams/<id>` builds one from one snapshot with Open Sheet's PC, strip, bag, item and Mini Seta limits, Team view and Analysis (Summary, Graph, Archetype, Members, Matrices), Showdown copy and import (unbacked sets left out, as today). A new team starts on the player's latest snapshot of the running series. Others' teams are readable, not editable, from their PC page ([Team Building](discovery.md#team-building)). `/open-sheet`, the Dexie database and its local data go.

**Do:**
- [ ] Teams table and migration (owner, sources, slots); team routes, the owner alone writing; `npm run seed` extended with a team on the seeded snapshot.
- [ ] Move Open Sheet's builder under `/teams/<id>` on stored snapshots; delete `/open-sheet`, `src/open-sheet/db.ts`, the import tabs and Dexie, and the browser's old database on first load.
- [ ] Rewrite `open-sheet.md` as the team builder's doc (rename it) and update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "dexie\|open-sheet:tab" pkmn/site/src pkmn/site/package.json` finds nothing.
- Human-run: make a team on your series 1 snapshot, give items until one runs out, switch an ability and see the Mini Seta count, copy it for Showdown and paste it back as a new team; reload on another device and see the teams; open another player's team read-only.
- Reuse: `src/open-sheet/team.ts`, `showdown.ts`, `components/team-view.tsx`, `sheet-analysis.tsx`, `src/analysis/`.
- Neighbors: `src/open-sheet/components/team-bar.tsx`.
- Forbidden: teams in `localStorage` or IndexedDB; another player able to write a team.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `pkmn/site/package.json`, `pkmn/site/package-lock.json`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Browse any player's PC at any snapshot

## Upload old exports as snapshots, with warnings for what they lack

The upload also takes an export `.json`, and every export is read as far as it goes ([Exports from older versions](discovery.md#snapshots-in)): the export schema treats every field but the species as optional, a snapshot stores what was missing, and its series page row and PC page show the warning. Series 1's MIRAMEEE and Vicky exports, in `pkmn/site/saves/`, go in through it.

**Do:**
- [ ] A lenient export schema with the missing-field report; entries without a usable species skipped and counted; refuse only non-JSON or nothing usable.
- [ ] JSON in the upload flow (player and admin); the warning chip; `moves` without rolled TMs marked unchecked in the move picker.
- [ ] Record in the snapshot format's reference which fields old exports lack and how the site reads them.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, upload `saves/Vicky-open-sheet.json` and `saves/MIRAMEEE-open-sheet.json` for two test players, see each warning on the series page and the PC page, open a Pokémon's summary and the bag in each, and build a team from each with Level 50 ranges shown; upload a JSON with one entry missing its species and read "1 skipped"; upload a file that is not JSON and read its refusal.
- Human-run: upload the two exports for MIRAMEEE and Vicky on production and open their PCs.
- Reuse: `src/open-sheet/schema.ts`'s zod schema, made lenient rather than copied.
- Neighbors: the save zip upload.
- Forbidden: refusing an export for a missing field; a second schema for old exports.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `pkmn/site/scripts/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`, `docs/pkmn/games/anil/reference/open-sheet-json.md`
**After:** Build teams locked to a snapshot, stored in the account

## Build teams from several snapshots, any player's

A team's sources picker takes any number of snapshots, any player's; the PC shows each source's Pokémon, and each member draws its item and Mini Setas from its own snapshot ([Item limits across several sources?](discovery.md#team-building)).

**Do:**
- [ ] The sources picker; per-source PC sections and limits.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: add another player's snapshot to a team, put one of their Pokémon in it, and see its item limited by their bag, not yours; remove that source and see the member flagged.
- Reuse: the team builder from the entry above.
- Neighbors: `src/open-sheet/components/pc.tsx`.
- Forbidden: one pooled bag across sources.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/shared/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account

## Add free members, and import unbacked sets as free members

A free member is a full Showdown set (any species in the team's pool, item, ability, nature, EVs, IVs, level, four moves), marked as free and counted against no bag. A pasted team's sets the sources cannot back come in as free members, listed in the dialog ([Team Building](discovery.md#team-building)).

**Do:**
- [ ] The free member editor; free members in the stored slots, the copy and the analysis.
- [ ] The import keeps backed matching and makes free members of the rest.

**Acceptance:**
- Claude-run: `npm run gate`.
- Human-run: make a team with no sources and six free members, copy it to Showdown and check it imports there; paste a team mixing your Pokémon and others and see the free ones marked and listed.
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
- [ ] Delete `src/pages/team-analysis.tsx`, `src/team-analysis/drafts.ts`, the route, `src/tools.ts` and the old `localStorage` drafts on load; rewrite `team-analysis.md` into the team builder's doc and `add-a-page-to-the-site.md` without tools; drop the tools from `pkmn/site/CLAUDE.md`'s Routes rule and `site.md`'s opening and Stack; update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "team-analysis:drafts\|carryTeam\|tools.ts\|/team-analysis" pkmn/site/src docs/pkmn` finds nothing.
- Human-run: compare three of your teams and read the scoreboard and a damage calc; open `/team-analysis` and see the not-found page.
- Reuse: `src/team-analysis/components/compare-view.tsx`, `src/analysis/compare.ts`.
- Neighbors: the team builder.
- Forbidden: keeping `/team-analysis` as a redirect.

**Touches:** `pkmn/site/src/`, `pkmn/site/CLAUDE.md`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Give each team its pool, the Pool view, Speed Tiers and Tera
