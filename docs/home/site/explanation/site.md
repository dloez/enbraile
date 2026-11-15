# The Root Site

`enbraile.vip`, in `home/site/`: a sign-in page with links to pkmn and DJ once signed in. Opening an app signed out redirects here with `?return=`, and back afterwards; `return` is limited to `enbraile.vip` and its subdomains.

It runs Better Auth (`api/_lib/auth.ts`) over [pkmn's](../../../pkmn/site/explanation/site.md#accounts) `user`, `session`, `account` and `verification` tables, which pkmn's migrations own; the schema here only declares what it reads and writes. The session cookie, prefixed `enbraile`, is set on `enbraile.vip`, so each subdomain receives it. `GET /api/me` answers with the reader and their Discord user ID, which lives in `account`.

## Load Time

The API is one Vercel Function, bundled at build: `npm run build` (the `buildCommand` in `vercel.json`) runs the gate and `scripts/build-api.ts`, which bundles `api/_lib/handler.ts` (the Hono app as a Node request listener) with esbuild into `.vercel/output/functions/api.func/`, copies `public/` to `.vercel/output/static/` and sends every `/api/` path to the function, and Vercel deploys that [Build Output API](https://vercel.com/docs/build-output-api) directory as it stands. The function runs in Frankfurt (`fra1`), beside pkmn's Neon database. Every sign-in check of the zombies site waits on `/api/me`, so its cold start is on the zombies site's first load ([The Zombies Site → Load Time](../../../zombies/site/explanation/site.md#load-time)).

Measured on 2026-11-15:

| Where | What | Before | After |
|-------|------|--------|-------|
| Production, signed out | `/api/me`, cold after 10 idle minutes | 2.2 s | not deployed yet |
| Locally | Loading the API module | 480 ms | 70 ms |
| Preview, cold after 12 to 14 idle minutes, two rounds | `/api/me` without a cookie | 1.9–2.4 s | 0.79–0.80 s |
| Preview, warm | The same | 125–265 ms | 130–250 ms |
| Preview, cold | A function that only answers 401: Vercel's own share | 0.57 s | |

Before, Vercel built the function from `api/index.ts`, compiling it and shipping Better Auth, Drizzle and `pg` as `node_modules` files a cold start read one by one. The previews ran with stand-in variables, since the project's are set for Production only; a request without a cookie touches no database. Previews get no bytecode caching, which Vercel gives production only, so production starts should be at or under them.

## Decisions

- **Better Auth with a shared cookie, not an OAuth provider of our own:** `user` and `account` rows stay where they are, so pkmn's data does not move. _(owner, 2026-11-06)_
- **A redirect, not a sign-in page per app:** pkmn's Poké Ball sign-in page is no longer used in production; its waiting page and admin sign-in stay. Local and preview builds, with no `VITE_ROOT_URL`, keep it. _(owner, 2026-11-07)_
- **A new cookie prefix:** an old host-only pkmn cookie could not be cleared by a sign-out on the shared domain, so old cookies are ignored and everyone signs in once more. _(2026-11-07)_
- **Only the group's own apps live under the domain,** since the cookie reaches every subdomain. _(2026-11-06)_
- **One bundled function, handed over as Build Output API:** bundled with esbuild, the API loaded in 70 ms locally instead of 480 ms and a cold preview answered in 0.79–0.80 s instead of 1.9–2.4 s; Vercel compiles whatever function it finds in `api/` its own way, so the build writes the function, the static files and the route to `.vercel/output/` and `api/index.ts` is gone, as on [the zombies site](../../../zombies/site/explanation/site.md#decisions). `vercel.json` sets `fluid: true`, the project's default, so the hand-made function keeps Fluid compute. _(the agent's choice, 2026-11-15)_
