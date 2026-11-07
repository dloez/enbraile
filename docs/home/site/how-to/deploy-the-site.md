# How to Deploy the Root Site

## Prerequisites

- The Vercel CLI signed in (`npx vercel whoami`).
- `https://enbraile.vip/api/auth/callback/discord` among the Discord application's redirects (registered 2026-11-06).

## Steps

1. From `home/site/`, link a Vercel project: `npx vercel link --project enbraile-home`.
2. Connect pkmn's Neon store (`pkmn-site`) to the project for Production, from the Vercel dashboard's Storage tab or `POST /v1/storage/stores/<store id>/connections`; that sets `DATABASE_URL`. pkmn's variables are sensitive, so `vercel env pull` hands back placeholders and none can be copied.
3. Set Production's `DISCORD_CLIENT_ID` (`1563596205026443535`), `DISCORD_CLIENT_SECRET` and a `BETTER_AUTH_SECRET` (`openssl rand -base64 32`). Keep both secrets in the untracked `home/site/.env.production.local`: pkmn's Production `BETTER_AUTH_SECRET` and `DISCORD_CLIENT_SECRET` must hold the same values, or pkmn cannot read the shared session.
4. Deploy with `npx vercel deploy --prod`, and attach the domain with `npx vercel domains add enbraile.vip enbraile-home`.
5. In Cloudflare DNS, add a CNAME for `@` to the target Vercel names (`vercel api "/v6/domains/enbraile.vip/config"`, `recommendedCNAME`), with the proxy off; Cloudflare flattens it at the apex. A proxied record would be blocked during LaLiga matches. If HTTPS fails once the record resolves, issue the certificate with `npx vercel certs issue enbraile.vip`.
6. Sign in at `https://enbraile.vip` with Discord and check the links appear.

To switch pkmn on, set its Production `AUTH_COOKIE_DOMAIN=enbraile.vip`, `VITE_ROOT_URL=https://enbraile.vip` and the root site's `BETTER_AUTH_SECRET`, then deploy it; everyone signs in once more. To roll back, unset both and redeploy; the rows never moved.
