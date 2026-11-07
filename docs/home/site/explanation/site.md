# The Root Site

`enbraile.vip`, in `home/site/`: a sign-in page with links to pkmn and DJ once signed in. Opening an app signed out redirects here with `?return=`, and back afterwards; `return` is limited to `enbraile.vip` and its subdomains.

It runs Better Auth (`api/_lib/auth.ts`) over [pkmn's](../../../pkmn/site/explanation/site.md#accounts) `user`, `session`, `account` and `verification` tables, which pkmn's migrations own; the schema here only declares what it reads and writes. The session cookie, prefixed `enbraile`, is set on `enbraile.vip`, so each subdomain receives it. `GET /api/me` answers with the reader and their Discord user ID, which lives in `account`.

## Decisions

- **Better Auth with a shared cookie, not an OAuth provider of our own:** `user` and `account` rows stay where they are, so pkmn's data does not move. _(owner, 2026-11-06)_
- **A redirect, not a sign-in page per app:** pkmn's Poké Ball sign-in page is no longer used in production; its waiting page and admin sign-in stay. Local and preview builds, with no `VITE_ROOT_URL`, keep it. _(owner, 2026-11-07)_
- **A new cookie prefix:** an old host-only pkmn cookie could not be cleared by a sign-out on the shared domain, so old cookies are ignored and everyone signs in once more. _(2026-11-07)_
- **Only the group's own apps live under the domain,** since the cookie reaches every subdomain. _(2026-11-06)_
