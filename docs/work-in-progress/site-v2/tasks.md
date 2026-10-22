# Site v2 Tasks

Decisions are in [discovery.md](discovery.md). Every entry runs `npm run gate` from `pkmn/site/`, drives its flow through the `verify-site` skill once that entry has landed, and updates the site docs it changes (`docs/pkmn/site/`), recording its decisions there as it lands.

## Design the new screens in Claude Design

The owner chose a design pass before building ([Pages](discovery.md#pages)). Mock, in the site's look and on its design system, the sign-in page, the waiting-to-be-added page, the series page (game download, players with their latest snapshot, upload, the player's teams, the rules), the PC page with its snapshot picker, the upload flow (slot and milestone pick), the team list, the team builder (sources picker, free member editor, the analysis views including Pool and Compare), and the admin pages (admin sign-in, allowlist, games with their upload, the series form with players, milestones, Markdown rules with "copy from series", and the start checklist). Desktop and phone.

**Do:**
- [ ] Build the screens in Claude Design from `docs/pkmn/site/reference/design-system.md` and the Open Sheet and Team Analysis screens.
- [ ] Get the owner's sign-off; record it, with the design's link, in `docs/pkmn/site/explanation/site.md` → Look and Decisions.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner opens the design and signs it off, or lists changes.
- Reuse: [Open Sheet Screens](https://claude.ai/artifact/SfpFcW5UoLVLeLAmdJZMG1), [Team Analysis Screens](https://claude.ai/artifact/4tyDvGNZXHqSRAvABaszfH).
- Neighbors: `docs/pkmn/site/reference/design-system.md`.
- Forbidden: new colours or components outside the design system without naming them as additions; helper text.

**Touches:** `docs/pkmn/site/explanation/site.md`
**Needs the author:** sign-off on the new screens.

## Admins sign in at /admin

The first server-side piece: Vercel Functions in `pkmn/site/api/`, Neon through Drizzle with its first migration, and Better Auth with username and password ([Data, Stack and Config](discovery.md#data-stack-and-config), [Accounts and Access](discovery.md#accounts-and-access)). `npm run admin:create <name>` makes an admin; `/admin` signs one in and shows an empty admin home with sign-out. Replaces the decision "Nothing is stored server-side".

**Do:**
- [ ] Add Hono, Drizzle, drizzle-kit and Better Auth at their latest stable versions, pinned; the schema and first migration; `.env.example` naming every variable.
- [ ] The auth API route, the admin script (password prompted, never an argument), and the `/admin` sign-in and home in the signed-off design.
- [ ] Neon production and `dev` branches and Vercel environment variables (owner-run).
- [ ] Rewrite `site.md`'s Data and Storage and Hosting sections and the "Nothing is stored server-side" decision; add local setup (`.env.local`, migrations, `admin:create`) to `run-and-deploy-the-site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`; `git grep -n "DATABASE_URL=\|BETTER_AUTH_SECRET=" -- ':!.env.example'` finds nothing.
- Human-run: run `npm run admin:create owner` against the `dev` branch, sign in at `/admin` locally with it, sign out, see a wrong password refused; then the same on production after its migration.
- Reuse: `src/components/controls.tsx`, `src/components/page.ts`, `src/router.tsx`.
- Neighbors: `src/pages/home.tsx`.
- Forbidden: a sign-up route for admins; secrets in the repo; down migrations.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/package.json`, `pkmn/site/drizzle/`, `pkmn/site/vercel.json`, `docs/pkmn/site/`
**After:** Design the new screens in Claude Design

## Run the whole site locally and drive it in a browser

The verification setup ([Observability and Verification](discovery.md#observability-and-verification)): `docker compose` with Postgres and MinIO, one `npm run dev` for Vite and the Hono API, the dev-only test sign-in, Playwright MCP in `.mcp.json`, and a `verify-site` skill with its how-to doc, so every later entry is checked from the database to the browser.

**Do:**
- [ ] `pkmn/site/compose.yaml` (Postgres, MinIO, latest stable images, pinned); `.env.example` for local; migrations run against it.
- [ ] The dev-only test sign-in behind its flag; `npm run seed` (an admin, test players, a game with a small stand-in zip, series 1), which later entries extend to upload snapshots from `pkmn/site/saves/`.
- [ ] Playwright MCP, pinned, in `.mcp.json` with `WAYLAND_DISPLAY=""`; `.playwright-mcp/` gitignored.
- [ ] `.claude/skills/verify-site/SKILL.md` and `docs/pkmn/site/how-to/verify-the-site.md`: start the stack, sign in as a test player or admin, drive a flow, read the database and the bucket, reset; listed in `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; from a clean clone, `docker compose up -d`, migrations, `npm run dev`, then through Playwright MCP sign in as admin at `/admin` and as a test player, take a screenshot of each, and read both sessions back from Postgres; `docker compose down -v` and the same again.
- Human-run: none.
- Reuse: the API and auth from "Admins sign in at /admin".
- Neighbors: unlit's `docs/general/how-to/setup-playwright-mcp.md` and `.claude/skills/verify-ui/` (`~/workspace/unlit/`), for shape, not versions.
- Forbidden: test files, a test runner or a gate step; the test sign-in reachable when its flag is unset; versions copied from unlit.

**Touches:** `pkmn/site/compose.yaml`, `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/package.json`, `.mcp.json`, `.gitignore`, `.claude/skills/verify-site/`, `docs/pkmn/site/how-to/`, `docs/pkmn/index.md`
**After:** Admins sign in at /admin

## Players sign in with Discord and admins keep the allowlist

Discord sign-in through Better Auth; a signed-in player who is not allowed sees the waiting page, an allowed one an empty home. The admin's allowlist page lists everyone who has signed in and allows or removes them.

**Do:**
- [ ] The Discord provider (owner-run: the Discord application, its redirect URIs for production and localhost, its secrets in Vercel).
- [ ] An `allowed` flag on players, the admin allowlist page, the waiting page, the site header's avatar and sign-out.
- [ ] Every API route but sign-in refuses players not allowed.

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`.
- Claude-run: through Playwright MCP, a test player not allowed sees the waiting page, and after the admin allows them, the home.
- Human-run: on production, sign in with Discord as a new user and see the waiting page; as an admin in another browser, allow them; reload and see the home; remove them and see the waiting page again.
- Reuse: the Better Auth setup from "Admins sign in at /admin".
- Neighbors: the `/admin` pages.
- Forbidden: an admin account linked to Discord; admin powers on a Discord session.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Run the whole site locally and drive it in a browser

## Admins create games and upload their files

An admin creates a game, uploads its zip straight from the browser to Backblaze B2 through a presigned URL, and sees it listed with its size and upload date; replacing the file is a new upload ([Where do files live?](discovery.md#data-stack-and-config)).

**Do:**
- [ ] The B2 bucket and key (owner-run); the AWS S3 SDK, pinned; presigned upload and download routes, admin-only for games.
- [ ] The games table and migration; the admin games page.

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`.
- Human-run: as admin, create "Pokémon Añil + Randomlocke" and upload the package zip from `pkmn/games/anil/game/archives/`; reload and see it listed; download it from the admin page and check its size matches.
- Reuse: the admin pages and auth from the entries above.
- Neighbors: `src/open-sheet/components/drop-zone.tsx` for picking a file.
- Forbidden: file bodies through a Vercel Function; public bucket URLs.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Run the whole site locally and drive it in a browser

## Admins create and start series; players land on the current one

The series form (number, name, game, players from the allowlist, milestones, Markdown rules with "copy from series"), the start checklist, and the draft → running → finished states ([Accounts and Access](discovery.md#accounts-and-access)). A player lands on the running series' page: its name and game with a download button, its milestones, its players, its rules, and a series switcher for the series they play. Series 1 is created through it, its rules pasted from `docs/pkmn/series/1/reference/rules.md`. The home page's tool list gives way to this page for signed-in players.

**Do:**
- [ ] Series, series players and milestones tables and migration; the admin series list, form and checklist; starting and finishing a series.
- [ ] `/series/<n>` and the landing redirect; the game's download for players of a linked series; the Markdown rules rendered (a pinned Markdown renderer, no raw HTML).

**Acceptance:**
- Claude-run: `npm run gate`; `npx drizzle-kit check`.
- Human-run: as admin, make a draft series and see the checklist list what is missing; fill it in item by item until "Start" enables; start it. As an allowed player of it, sign in and land on its page, read its rules, download its game. As an allowed player not in it, see no download. Make a second draft by "copy from series 1" and see the rules copied.
- Reuse: the games and allowlist from the entries above; `src/components/controls.tsx`.
- Neighbors: `src/pages/home.tsx`.
- Forbidden: rules enforced in team building; raw HTML in rendered rules.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Players sign in with Discord and admins keep the allowlist, Admins create games and upload their files

## Players upload their save zip as a snapshot

The export ported to TypeScript in the site, run in a Vercel Function on the save zip the browser put in B2 ([Snapshots In](discovery.md#snapshots-in), [The export?](discovery.md#data-stack-and-config)). `generate_export_data.py` writes the export's data as JSON for the site; the port reads the zip, lists its `Partida N.rxdata` slots, and exports with moves always and the TM rolls thrown away. The player picks the slot and milestone on their row of the series page; the row then shows the snapshot with its Pokémon count. Uploading again to a milestone replaces it. An admin can upload for any player.

**Do:**
- [ ] `generate_export_data.py` writes the data JSON into the site; port the Ruby Marshal reader, slot pick, abilities, moves and items.
- [ ] Saves and snapshots tables and migration; the zip kept in B2 under its snapshot; the upload flow; a failed export shows its reason.
- [ ] Move [Open Sheet JSON](../../pkmn/games/anil/reference/open-sheet-json.md) to be the snapshot format's reference.

**Acceptance:**
- Claude-run: `npm run gate`; for a save zip the owner provides, the port's JSON equals `uv run pkmn/games/anil/export_data.py --save <zip> --moves` except for TM rolls (`diff` after stripping rolled entries).
- Human-run: upload your series 1 zip as "Post-League" and see the count on your row; upload it again and see one snapshot, replaced; as admin, upload another player's zip for them; upload a zip without a save and read its refusal.
- Reuse: `pkmn/site/src/open-sheet/schema.ts` (the export's zod schema); the B2 presigned upload route.
- Neighbors: `pkmn/games/anil/export_data.py`.
- Forbidden: Python in the site's functions; offering the rolled zip back.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `pkmn/games/anil/generate_export_data.py`, `docs/pkmn/games/anil/`, `docs/pkmn/site/`
**After:** Admins create and start series; players land on the current one

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

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `docs/pkmn/site/`
**After:** Players upload their save zip as a snapshot

## Build teams locked to a snapshot, stored in the account

`/teams` lists the player's teams; `/teams/<id>` builds one from one snapshot with Open Sheet's PC, strip, bag, item and Mini Seta limits, Team view and Analysis (Summary, Graph, Archetype, Members, Matrices), Showdown copy and import (unbacked sets left out, as today). A new team starts on the player's latest snapshot of the running series. Others' teams are readable, not editable, from their PC page ([Team Building](discovery.md#team-building)). `/open-sheet`, the Dexie database and its local data go.

**Do:**
- [ ] Teams table and migration (owner, sources, slots); team routes, the owner alone writing.
- [ ] Move Open Sheet's builder under `/teams/<id>` on stored snapshots; delete `/open-sheet`, `src/open-sheet/db.ts`, the import tabs and Dexie, and the browser's old database on first load.
- [ ] Rewrite `open-sheet.md` as the team builder's doc (rename it) and update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "dexie\|open-sheet:tab" pkmn/site/src pkmn/site/package.json` finds nothing.
- Human-run: make a team on your series 1 snapshot, give items until one runs out, switch an ability and see the Mini Seta count, copy it for Showdown and paste it back as a new team; reload on another device and see the teams; open another player's team read-only.
- Reuse: `src/open-sheet/team.ts`, `showdown.ts`, `components/team-view.tsx`, `sheet-analysis.tsx`, `src/analysis/`.
- Neighbors: `src/open-sheet/components/team-bar.tsx`.
- Forbidden: teams in `localStorage` or IndexedDB; another player able to write a team.

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `pkmn/site/package.json`, `docs/pkmn/site/`, `docs/pkmn/index.md`
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

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`, `docs/pkmn/games/anil/reference/open-sheet-json.md`
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

**Touches:** `pkmn/site/api/`, `pkmn/site/src/`, `docs/pkmn/site/`
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

**Touches:** `pkmn/site/src/`, `pkmn/site/api/`, `docs/pkmn/site/`
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

**Touches:** `pkmn/site/src/`, `pkmn/site/api/`, `pkmn/site/drizzle/`, `docs/pkmn/site/`
**After:** Build teams locked to a snapshot, stored in the account

## Compare teams; /team-analysis and the tools list go

Compare puts 2–4 of the player's teams side by side with the scoreboard and damage calc. With it, `/team-analysis`, its page, drafts and `carryTeam`, `src/tools.ts` and the tools home are deleted ([Team Building](discovery.md#team-building), [Pages](discovery.md#pages)).

**Do:**
- [ ] Compare in the team builder over stored teams.
- [ ] Delete `src/pages/team-analysis.tsx`, `src/team-analysis/drafts.ts`, the route, `src/tools.ts` and the old `localStorage` drafts on load; rewrite `team-analysis.md` into the team builder's doc and `add-a-page-to-the-site.md` without tools; update `docs/pkmn/index.md`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn "team-analysis:drafts\|carryTeam\|tools.ts\|/team-analysis" pkmn/site/src docs/pkmn` finds nothing.
- Human-run: compare three of your teams and read the scoreboard and a damage calc; open `/team-analysis` and see the not-found page.
- Reuse: `src/team-analysis/components/compare-view.tsx`, `src/analysis/compare.ts`.
- Neighbors: the team builder.
- Forbidden: keeping `/team-analysis` as a redirect.

**Touches:** `pkmn/site/src/`, `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** Give each team its pool, the Pool view, Speed Tiers and Tera
