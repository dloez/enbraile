# Site v2: Accounts, Snapshots and Team Building

Scoped with the owner on 2026-10-22.

## Goal

The site stops being a shelf of standalone tools and becomes the way a player of the group builds their teams. Each player signs in, sees the PC (with its bag and TMs) of every series they play as **snapshots** taken at milestones, and builds teams from any snapshot, or from Pokémon made from scratch, with the full analysis that today lives in Open Sheet's Team view and the Team Analysis tool. The site knows which series is being played, on what game, and when the group fights.

Done when, on `pkmn.enbraile.vip`: a player the admin has allowed signs in with Discord, lands on the current series' page, uploads their save zip and sees it as a snapshot; opens any player's PC at any snapshot; and builds, analyses, compares and copies teams stored in their account. `/open-sheet`, `/team-analysis` and the "tools" home page are gone.

## Decisions

### Accounts and Access

- **Q: How do players sign in?** A: Discord. **Why:** one click, no passwords, and the Discord name is how the group knows each other.
- **Q: Who can get in?** A: An allowlist kept by the admins: anyone can sign in with Discord, but sees nothing until an admin adds them. **Why:** the PCs are the group's own; no invite links to manage.
- **Q: What is an admin?** A: A separate, local account (username and password, signed in at `/admin`) that is not a player: no saves, no teams, no Discord. The owner plays under their own Discord account like everyone else. **Why:** the owner: a player building a team should not carry admin powers.
- **Q: How are admin accounts made?** A: A script run against the database (`npm run admin:create <name>`, which asks for the password). No sign-up page; admins cannot make admins. **Why:** nobody can make themselves an admin through the site.
- **Q: What does an admin do?** A: Everything in an admin UI: creates games and series, keeps the allowlist, picks a series' players, and can upload a save for any player. **Why:** the owner chose an admin UI over code for series and players.
- **Q: What is a game?** A: An admin-made entry (name, e.g. "Pokémon Añil + Randomlocke") with an uploaded zip of the game files, linked to one or more series. Players of a linked series download it from the series page. **Why:** the owner: games are made once and reused by many series.
- **Q: What does creating a series take?** A: A draft series is edited freely: number, name, game, players, milestones (e.g. Gym 1, 2, 3, 5, 7 and Post-League) and rules. Starting it is gated by a checklist that shows what is missing: rules written, a game chosen that has an uploaded file, at least two players, at least one milestone. A series is draft, running or finished, and the running one is the current series players land on; one runs at a time. **Why:** the owner asked for the checklist; one running series is _proposed_, from "we are currently playing series 2".
- **Q: What are a series' rules?** A: Markdown text written in the series form, which can start as a copy of another series' rules and stays editable after the series starts; every player reads it on the series page. Series 1's starts as a copy of [Series 1 Rules](../../pkmn/series/1/reference/rules.md). The site enforces nothing from it yet. **Why:** the owner; enforcing rules in team building is a backlog idea.

### Model

- **Q: What are the pieces called?** A: Game → series → save → snapshot. A series is played on one game, and a game serves many series. A player has a save per series; a save holds snapshots, each one PC export (Pokémon, bag, TMs) taken at a milestone ("Gym 3", "Post-League"). "Box" stays the game's meaning: a page of the PC. **Why:** the owner's pick.
- **Q: How many saves per series?** A: One per player, shown to the player as series → snapshot; the save stays in the model underneath. Uploading again to a milestone replaces its snapshot. **Why:** the owner: only one save per series is supported, with overwrites.
- **Q: Series 1?** A: One snapshot per player, "Post-League", since only the post-League PCs exist.
- **Q: What can players see of each other?** A: Everything, for now: every PC at every snapshot, and every team. **Why:** the owner: "I would not worry about this now". Showing only what a series' rules allow (the league's box sheet) is a later idea.

### Snapshots In

- **Q: How does a snapshot get in?** A: The player uploads the zip of their save folder (`%APPDATA%\Pokemon Anil`), picks the `Partida N.rxdata` slot when there are several, and picks the milestone. An admin can do the same for any player. **Why:** the owner; most players are not technical.
- **Q: The client app that reports gym progress and makes snapshots by itself?** A: Later, out of this idea; no endpoint for it now.
- **Q: TM rolls the export makes?** A: Made in memory and thrown away; the upload stores the export and offers nothing back. **Why:** the owner: after series 1's upload there is nothing left to play; syncing rolls with the game is for later.
- **Q: Moves?** A: Always exported (known, relearner and TM moves); the `--moves` flag goes. **Why:** the owner thought it was already the default; it is still opt-in at `export_data.py:6867`.
- **Q: Exports from older versions of the export script?** A: Supported, for every series: the upload also takes an export `.json` (player or admin), and every export, old or new, is read as far as it goes and never refused for missing data. A missing field reads as absent and the snapshot carries a warning naming what is missing (e.g. "no IVs, EVs or stats · no moves"), shown on its series page row and its PC page; an entry with no usable species is skipped and counted in the warning. Only a file that is not JSON or holds nothing usable is refused. The views already cope: Level 50 ranges without IVs, any Gen 1–5 move without `moves`; `moves` from before TM rolling are marked unchecked. **Why:** the owner; series 1's MIRAMEEE (2026-10-17: no IVs, EVs or stats, unrolled TM moves) and Vicky (2026-10-16: no IVs, EVs, stats or moves) exports cannot be made again with the current script, and the site never stops working for a gap.
- **Q: Uploaded save zips?** A: Kept in the file store (Backblaze B2, below), so snapshots can be re-exported when the export improves.

### Pages

- **Q: First page after sign-in?** A: The current series: its game, where the group is ("next fight: after Gym 3"), every player with their latest snapshot and a PC link, an upload button on the player's own row, and the player's teams. A series switcher reaches the others. A signed-in player not on the allowlist sees that they are waiting to be added.
- **Q: Top-level sections?** A: Series · Teams · Admin (Admin for admins only). Routes: `/series/<n>`, `/series/<n>/players/<player>?snapshot=<milestone>`, `/teams`, `/teams/<id>`, `/admin`. No "tools" anywhere. **Why:** the owner dislikes "tools" as a concept: they read as standalone. This takes over the backlog's "series hubs" idea.
- **Q: Design?** A: A Claude Design pass for the new screens (sign-in, waiting, series page, PC page, team list, team builder with its sources and free members, admin), signed off before they are built. The PC, bag and team views carry over from Open Sheet and Team Analysis's signed-off designs. **Why:** the owner chose a design pass first.

### Team Building

- **Q: Where do members come from?** A: A team picks its sources: one snapshot (locked, as built for a fight, with that snapshot's item and Mini Seta limits), several, or none; any team can also hold free members. Any player's snapshot can be a source. **Why:** the owner: fights, theorycrafting and scouting an opponent.
- **Q: A new team's sources?** A: The player's latest snapshot in the current series, the one they are probably building for; any combination can be picked instead.
- **Q: Item limits across several sources?** A: Each member draws its item from its own snapshot's bag, and Mini Setas from its own snapshot's count. Free members are counted against nothing. _(proposed, follows from per-snapshot limits)_
- **Q: Free members?** A: A full Showdown set: any species in the team's pool, any item, ability, nature, EVs, IVs, level and four moves, marked as free.
- **Q: A pasted Showdown team with Pokémon the sources can't back?** A: The backed ones match as today; the rest come in as free members, listed in the dialog. **Why:** the owner; when tournaments run inside the site, a tournament will force a team's sources.
- **Q: Who sees a team?** A: Everyone (read-only); only its owner edits it.
- **Q: The pool?** A: Per team, with Team Analysis's pool bar, defaulted from the series (series 1: Gen 9 data, species up to Gen 5, fully evolved).
- **Q: Compare, Speed Tiers, Tera?** A: All come over. Compare puts 2–4 of the player's teams side by side (theirs, including ones built from others' snapshots); Speed Tiers joins the views; Tera shows when the pool's gen is 9.

### Data, Stack and Config

- **Q: Backend?** A: Full TypeScript: a Hono API in `pkmn/site/api/`, deployed as Vercel Functions through Hono's Vercel adapter and run locally on Node behind Vite's proxy, so one `npm run dev` serves both without `vercel dev`; Neon Postgres (Vercel Marketplace, free tier) through Drizzle with `drizzle-kit` migrations in the repo, Better Auth (Discord, plus username/password for admins) with its Drizzle adapter, zod schemas shared by browser and API. **Why:** the owner wants one backend language, preferring Python only if it lost nothing; TypeScript has Better Auth and shared types, and the frontend is TypeScript anyway. All of it is free at the group's size; Supabase was turned down because a free project pauses after a week idle.
- **Q: Where do files live?** A: Backblaze B2 (S3-compatible, through the AWS S3 SDK), for game zips (~600 MB each) and save zips alike. Uploads go straight from the browser to B2 with presigned URLs, since a Vercel Function body is capped at a few MB; downloads are short-lived presigned links for players of a linked series. **Why:** the owner; Vercel Blob's free allowance is about one game download round a month, and Cloudflare R2's URLs sit on the IPs Spanish ISPs block during LaLiga matches.
- **Q: The export?** A: Ported to TypeScript in the site; `export_data.py`'s embedded `DATA` table (about 6,150 of its 6,934 lines) becomes a JSON file that `generate_export_data.py` writes for the site, and its ~750 lines of logic (Ruby Marshal reader, abilities, TM rolls, items) are ported. `export_data.py` and its CLI docs are retired. **Why:** the owner chose full TypeScript and retiring the Python CLI, since players now upload on the site.
- **Q: Browser data today?** A: Dropped: Open Sheet's IndexedDB tabs and teams and Team Analysis's `localStorage` drafts are deleted once accounts land; series 1's PCs come back as uploads and teams by Showdown paste. **Why:** greenfield.
- **Q: Environments and secrets?** A: Production on its own Neon branch, previews on a `dev` branch; local dev on `docker compose` (Postgres, and MinIO standing in for B2 through the same S3 SDK), so it needs no cloud account and resets at will. Discord sign-in is registered for production and localhost; previews sign in as an admin or not at all. Secrets (database URL, Better Auth secret, Discord client, B2 key) live in Vercel's environment and `.env.local`, never in the repo.
- **Q: Rollback?** A: Code by Vercel's Instant Rollback or a revert; schema by a forward migration (no down scripts); data by Neon's point-in-time restore.

### Observability and Verification

- **Q: Logs?** A: Vercel's function logs; a failed upload shows the reader why. No analytics, as now.
- **Q: Checks?** A: `npm run gate` (`tsc -b`) covers browser and functions. Beyond it, Claude checks every slice by driving the real site, backend to browser: the Playwright MCP server (in the repo's `.mcp.json`, `WAYLAND_DISPLAY=""` for WSL) on the local stack, signing in as a test player or an admin, then reading the database and the file store. A `verify-site` skill and a how-to doc say how. It is a driver, not a test runner: no test files and no gate step (root `CLAUDE.md`). **Why:** the owner asked that Claude can check the whole site in a real browser; unlit's Playwright MCP setup is the model.
- **Q: Local data to check with?** A: A seed script (admin, test players, a game, series 1) for a known state after a reset, uploading snapshots from `pkmn/site/saves/`, a gitignored folder where the owner puts real save zips and exports (MIRAMEEE's and Vicky's old exports are there). **Why:** the owner confirmed the seed is for checking; players' saves never enter the public repo.
- **Q: Signing in without Discord locally?** A: A dev-only sign-in for test players, enabled by an environment flag production never sets. Discord itself is checked by hand on production.
- **Q: Versions?** A: The latest stable of everything set up here, pinned exactly, Playwright MCP included; nothing copied from unlit's versions. **Why:** the owner.

## Out of Scope

- The client app that reports gym progress and makes snapshots automatically.
- Showing only what a series' rules allow of others' PCs.
- Tournaments inside the site (which would force a team's sources).
- Syncing TM rolls back to the player's save.
- Games other than Añil: any game can be created and downloaded, but the save upload reads Añil saves only, until a series is played on another game.
- Enforcing a series' rules in the site (e.g. one legendary per team): a backlog idea.

## References

- [The pkmn Site](../../pkmn/site/explanation/site.md), [Open Sheet](../../pkmn/site/explanation/open-sheet.md), [Team Analysis](../../pkmn/site/explanation/team-analysis.md), [Site Design System](../../pkmn/site/reference/design-system.md), [How to Run and Deploy the Site](../../pkmn/site/how-to/run-and-deploy-the-site.md)
- [Open Sheet Export](../../pkmn/games/anil/explanation/open-sheet-export.md), [Open Sheet JSON](../../pkmn/games/anil/reference/open-sheet-json.md), [How to Run the Open Sheet Export](../../pkmn/games/anil/how-to/run-the-open-sheet-export.md)
- [Series 1 Rules](../../pkmn/series/1/reference/rules.md)
- Code: `pkmn/site/src/router.tsx`, `src/tools.ts`, `src/open-sheet/`, `src/team-analysis/`, `src/pages/team-analysis.tsx`, `src/analysis/`, `src/components/analysis/`; `pkmn/games/anil/export_data.py`, `generate_export_data.py`
