# The Zombies Site

The site in `zombies/site/`, for `zombies.enbraile.vip`, where the group will start runs on a map and talk to the coach, Cari. Today it lists the maps Claude has published, and members start or join a run on one and talk in its shared chat; Cari's answers and hints come next ([Zombies Coach](../../../work-in-progress/zombies-coach/discovery.md)). Its look is in the [Site Design System](../reference/design-system.md).

## How It Is Built

It mirrors the [DJ panel](../../../dj/panel/explanation/panel.md): a Vite + React page, and one Hono function, `api/index.ts`, holding every route in `api/_lib/app.ts`. A signed-out reader is sent to the [root site](../../../home/site/explanation/site.md) and back: the function reads the session from the root's `/api/me` with the reader's cookie, so the site keeps no sign-in tables of its own. Locally, `DEV_USER_ID` stands in for a session: it holds a comma-separated list of members, each `<id>` or `<id>:<name>`, and `GET /api/dev/sign-in/<id>` sets a cookie that makes that browser one of them (the first one otherwise), so one machine can be two members of one run. The route answers 404 wherever `DEV_USER_ID` is unset, as it is on every Vercel deployment. The chrome is in English or Spanish, following the reader's `lang` cookie as the other sites do.

Maps live in their own Postgres database, never pkmn's, through Drizzle with `pg` as in [the pkmn site](../../../pkmn/site/explanation/site.md); the migrations in `drizzle/` run in the Vercel build. Its tables:

| Table | Holds |
|-------|-------|
| `maps` | One row per published map, keyed by game and map slug, with its latest version |
| `bundle_versions` | Every published bundle, numbered per map, with the SHA-256 of its canonical JSON |
| `runs` | One row per run: its map, the language Cari speaks, and who started it |
| `run_members` | Each time a person joined a run, with when they left it; a unique index over the rows not left keeps a person in one run at a time |
| `messages` | The run's chat, each line from a member or from Cari |
| `run_knowledge` | The knowledge entries known in a run; an entry without a row is unknown |

## Map Bundles

A bundle is everything the live coach will need about one map, as one JSON document checked by the zod schema in `shared/bundle.ts`: the map's name in each language, which drawn plan stands for it, the knowledge entries with their `known` or `unknown` marks, the steps (`requires`, conditions, `optional`, the `onSuccess` line, the ladder, part ladders and heads-ups), the map's own calibration notes, and the dossier and sources as the durable copy. Every rung, each of its Alts (with `when` it replaces the rung) and every `onSuccess` line carries its wording in Spanish and English, the knowledge entries it `mentions`, which must already be known, and those it `reveals`; a heads-up carries its `mentions` only. The schema rejects a `mentions`, `reveals` or `requires` that names nothing, and repeated IDs.

A real map's bundle is not written by hand: `npm run compile -- <dir>` builds it from the files the ee-coach skill prepares in that map's dir ([Research and dossier building → Compile and publish](../../../../.claude/skills/ee-coach/references/research.md#4-compile-and-publish)) and writes `<dir>/bundle.json`. It reads `map.json` (the names and art plan), `hints.md` and `hints.es.md` paired line by line, the `L4 as spoken` and `Conditions` of each step in `dossier.md` (each indented `- ` item one condition, an indented line without one joined to the item above), `knowledge.md`, the map's `calibration.md` and every file under `sources/`, and checks what the schema cannot: that both languages hold the same lines with the same IDs, that a line reveals only what it mentions, and that no card text carries a step, hint or level number. Its messages name a file and line or a step and rung, never the text, and its summary is counts only, so its output can be quoted where the players read.

`npm run publish -- <dir>` reads `<dir>/bundle.json`, checks it, and sends it to `PUT /api/admin/maps/<game>/<map>` with `ZOMBIES_ADMIN_TOKEN`. The function stores it as a new version unless its digest equals the latest one's, so publishing the same bundle twice leaves one version; an older bundle published again becomes the newest version, which is how a map is reverted. Real maps' bundles stay in the gitignored `zombies/maps/<game>/<map>/` ([Repository Layout](../../../general/explanation/repository-layout.md#decisions)); the one committed bundle is the made-up test map in `zombies/site/test-map/`, Harrow Station.

The maps page reads `GET /api/maps`, which returns each map's game and map IDs, its names, its `art` plan key, test flag and version and nothing else from the bundle, so no solution reaches a browser. The same reply carries each map's open runs and the reader's own run.

## Runs

A member starts a run from a map's row on the maps page, choosing the language Cari speaks (Spanish unless they pick English): `POST /api/runs`. Anyone signed in can join an open run from its row or its link, `/runs/<id>`, which shows the run's sheet to a reader not in it and the run to a member (`POST /api/runs/<id>/join`). A person is in one run at a time, so starting or joining a run leaves the one they were in. Nothing closes or ends a run: every run stays on its map's row, even once everyone has left it, and can be joined again.

A new run's knowledge marks are the latest bundle's `known` entries plus every entry known in the starter's earlier runs on that map; each member who joins adds what was known in their own earlier runs there.

The run page polls `GET /api/runs/<id>/messages?after=<last id>` every 2 seconds for new lines and the current members, and `POST /api/runs/<id>/messages` adds a member's line. Both answer 403 to anyone not in the run. Cari does not answer yet.

## Hosting

Vercel serves the site from the owner's Hobby team as the project `enbraile-zombies`: the Vite build's static `dist/` and the API as a Vercel Function (`api/index.ts`) in the same project, as pkmn's and the DJ panel's are. `vercel.json` runs the function in Frankfurt (`fra1`), beside its Neon database (`aws-eu-central-1`), and rewrites every path but `/api/` and `/assets/` to `/index.html`. The database is the Neon project `zombies`, its own and never pkmn's, with a `main` branch for production and a `dev` branch for previews. The `zombies-site.yml` workflow deploys pushes to `main` touching `zombies/site/` to production, and other branches' pushes as previews, which Vercel's Deployment Protection keeps to the team ([How to Deploy the Vercel Projects](../../../general/how-to/deploy-vercel-projects.md)). `zombies.enbraile.vip` is on the project's domains and is to be a DNS-only (grey-cloud) `CNAME` to the Vercel target in the `enbraile.vip` zone on the owner's Cloudflare account; until the owner adds that record the name does not resolve. It is DNS-only for the reason pkmn's is: Cloudflare's proxied IPs are blocked by Spanish ISPs during LaLiga matches ([The pkmn Site → Decisions](../../../pkmn/site/explanation/site.md#decisions)). The root site lists the domain in its `trustedOrigins`, so sign-in returns to it. Setting it up is in [How to Run and Deploy the Site](../how-to/run-and-deploy-the-site.md#8-set-up-production-once).

## Decisions

- **No numbers, no step list, the UI is never a hint:** no step or hint numbers anywhere (the terminal's "Step 5 · hint 2/4" is not shown), no list of steps, and no buttons or suggestions that tell players what to try. _(owner, 2026-11-15)_
- **Hints as cards:** one shared chat with Cari, where hints arrive as cards with a generic "more" control and the three feedback controls (too obvious, right, too vague); a level-3 zone shows under its card. _(owner, 2026-11-15)_
- **Cari's voice only:** no chimes or clips on a new hint, since a cue would itself carry meaning. _(owner, 2026-11-15)_
- **One `bundle.json` per map dir:** `publish` takes the dir that holds a map's files, and `compile` writes the bundle there. _(the agent's choice, 2026-11-15)_
- **Bundle IDs from the prepare files' numbers:** steps become `step-<n>`, a step's part ladders `part-<n>` in order, and knowledge entries their `K` IDs in lowercase, so the bundle needs no second set of names to keep in step with `hints.md`. _(the agent's choice, 2026-11-15)_
- **`reveals` written by hand in the hints:** each line lists after its `Mentions` the IDs it is meant to give away (`Reveals:`), rather than `compile` guessing them from step order, since players choose the order. _(the agent's choice, 2026-11-15)_
- **Several Alts per rung, each with its `when`:** prepared hints hold more than one Alt for a step, each replacing one named rung in one situation. _(the agent's choice, 2026-11-15)_
- **L4 stays in the dossier:** `compile` takes level 4 from the dossier's `L4 as spoken`, so `hints.md`, which the blind check reads, never holds an answer; the Spanish copy holds it as `L4`. _(the agent's choice, 2026-11-15)_
- **A bundle's baseline marks:** a knowledge entry is `known` in the bundle only when `knowledge.md` marks it `known`; `revealed` counts as `unknown`, since it records what one terminal session gave away rather than what the players brought. _(the agent's choice, 2026-11-15)_
- **Names per language, art as a drawn plan:** the map's name is stored in both languages, since in-game names differ by language, and its row shows one of three drawn plans chosen in the bundle's `art`, since no game's art goes on the site. The keys stay `teal`, `rust` and `furnace` from the first take's tinted silhouettes, standing for the boards' Harrow Station, Saltmarsh Asylum and Kessel Works plans. _(the agent's choice, 2026-11-15)_
- **The radio log look:** the owner found the first boards "very AI", so the site was redrawn as the group's radio log (transcript rows, dispatch slips, survey sheets, condensed type and five flat inks on paper), which replaces the first take. _(owner, 2026-11-15)_
- **A map's label is its game:** the boards label the made-up maps "Sample"; a published map that is not the test map shows its `game` instead, as the bundle holds no other short line about it. _(the agent's choice, 2026-11-15)_
- **A rung's `reveals`:** the discovery lets a rung mention an unknown thing when it is the rung meant to reveal it; the bundle says which rung that is with `reveals`, next to `mentions`. _(the agent's choice, 2026-11-15)_
- **Versions numbered per map, deduplicated by digest:** the SHA-256 of the bundle's JSON with sorted keys, so key order in the file never makes a new version. _(the agent's choice, 2026-11-15)_
- **Map rows without Start a run yet:** the boards draw it on every map's row, but a button that does nothing until runs exist would be a dead control; it comes with runs. _(the agent's choice, 2026-11-15)_ It came with runs on 2026-11-15.
- **Several local members:** `DEV_USER_ID` takes a list and each browser picks one of them, so a Claude-run check can be two members of one run; it exists only where `DEV_USER_ID` is set, never in production, which keeps Discord through the root as the DJ panel does. _(owner, 2026-11-15)_
- **The player picks the map:** a run is started from the map the players are playing, picked from the maps list as the boards draw it. _(owner, 2026-11-15)_
- **Runs stay open:** there is no way to close or end a run. _(owner, 2026-11-15)_
- **Knowledge follows the people:** a run's marks start from the bundle's baseline and the starter's earlier runs on the map, and each member who joins adds what their own earlier runs on it knew, so the marks are never lowered by who joins. _(the agent's choice, 2026-11-15)_
- **One link per run:** `/runs/<id>` is both the run and its join page, chosen by whether the reader is in it, so a link sent to a friend opens the run sheet the boards draw. _(the agent's choice, 2026-11-15)_
- **Neon from the Vercel Marketplace, without its variables:** the Neon organization is managed by Vercel and refuses a project made with `neonctl`, so the `zombies` project comes from the integration with `--no-connect`, and `DATABASE_URL` is set by hand per environment with `sslmode=verify-full`, as pkmn's table has it, rather than the integration's own variables. _(the agent's choice, 2026-11-15)_
