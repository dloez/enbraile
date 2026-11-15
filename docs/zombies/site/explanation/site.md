# The Zombies Site

The site in `zombies/site/`, for `zombies.enbraile.vip`, where the group will start runs on a map and talk to the coach, Cari. Today it lists the maps Claude has published; runs, the chat and hints come next ([Zombies Coach](../../../work-in-progress/zombies-coach/discovery.md)). Its look is in the [Site Design System](../reference/design-system.md).

## How It Is Built

It mirrors the [DJ panel](../../../dj/panel/explanation/panel.md): a Vite + React page, and one Hono function, `api/index.ts`, holding every route in `api/_lib/app.ts`. A signed-out reader is sent to the [root site](../../../home/site/explanation/site.md) and back: the function reads the session from the root's `/api/me` with the reader's cookie, so the site keeps no sign-in tables of its own. Locally, `DEV_USER_ID` stands in for a session. The chrome is in English or Spanish, following the reader's `lang` cookie as the other sites do.

Maps live in their own Postgres database, never pkmn's, through Drizzle with `pg` as in [the pkmn site](../../../pkmn/site/explanation/site.md); the migrations in `drizzle/` run in the Vercel build. Two tables:

| Table | Holds |
|-------|-------|
| `maps` | One row per published map, keyed by game and map slug, with its latest version |
| `bundle_versions` | Every published bundle, numbered per map, with the SHA-256 of its canonical JSON |

## Map Bundles

A bundle is everything the live coach will need about one map, as one JSON document checked by the zod schema in `shared/bundle.ts`: the map's name in each language, its art tint, the knowledge entries with their `known` or `unknown` marks, the steps (`requires`, conditions, `optional`, the `onSuccess` line, the ladder, part ladders and heads-ups), the map's own calibration notes, and the dossier and sources as the durable copy. Every rung and Alt carries its wording in Spanish and English, the knowledge entries it `mentions` and those it `reveals`. The schema rejects a `mentions`, `reveals` or `requires` that names nothing, and repeated IDs.

`npm run publish -- <dir>` reads `<dir>/bundle.json`, checks it, and sends it to `PUT /api/admin/maps/<game>/<map>` with `ZOMBIES_ADMIN_TOKEN`. The function stores it as a new version unless its digest equals the latest one's, so publishing the same bundle twice leaves one version; an older bundle published again becomes the newest version, which is how a map is reverted. Real maps' bundles stay in the gitignored `zombies/maps/<game>/<map>/` ([Repository Layout](../../../general/explanation/repository-layout.md#decisions)); the one committed bundle is the made-up test map in `zombies/site/test-map/`, Harrow Station.

The maps page reads `GET /api/maps`, which returns each map's name, tint, test flag and version and nothing else from the bundle, so no solution reaches a browser.

## Decisions

- **One `bundle.json` per map dir:** `publish` takes the dir that holds a map's files, as the queue's `compile` will write its bundle there. _(the agent's choice, 2026-11-15)_
- **Names per language, art as a tint:** the map's name is stored in both languages, since in-game names differ by language, and its card art is one of the three drawn silhouettes (teal, rust, furnace) chosen in the bundle, since no game's art goes on the site. _(the agent's choice, 2026-11-15)_
- **A rung's `reveals`:** the discovery lets a rung mention an unknown thing when it is the rung meant to reveal it; the bundle says which rung that is with `reveals`, next to `mentions`. _(the agent's choice, 2026-11-15)_
- **Versions numbered per map, deduplicated by digest:** the SHA-256 of the bundle's JSON with sorted keys, so key order in the file never makes a new version. _(the agent's choice, 2026-11-15)_
- **Map cards without Start a run yet:** the boards draw it on every card, but a button that does nothing until runs exist would be a dead control; it comes with runs. _(the agent's choice, 2026-11-15)_
