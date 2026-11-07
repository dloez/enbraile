# The DJ Panel

The web panel for the [DJ bot](../../bot/explanation/bot.md), in `dj/panel/`, for `dj.enbraile.vip`. It shows what is playing and offers the player's controls, the queue, playlists, history and, for users with Manage Server, the DJ role and hour limit, in English or Spanish.

A signed-out reader is sent to the [root site](../../../home/site/explanation/site.md) and back. A Vercel function (`api/_lib/app.ts`) reads the session from the root's `/api/me` and forwards calls to the Worker with `INTERNAL_SECRET`, so the Discord user ID comes from the session, never the browser. Locally, `DEV_USER_ID` stands in for a session.

Live updates arrive by a WebSocket straight to the Durable Object, authorised by a ticket that lasts a minute. Spanish ISPs block Cloudflare's IPs during LaLiga matches ([The pkmn Site → Decisions](../../../pkmn/site/explanation/site.md#decisions)), so the page itself is on Vercel, and when the socket fails it polls through the function every 10 seconds and says so. Vercel project `enbraile-dj`, root directory `dj/panel`, deploys every push to `main` that touches `dj/panel/`, set up as the [root site's](../../../home/site/how-to/deploy-the-site.md) is; its Production variables are `ROOT_URL`, `WORKER_URL` and `INTERNAL_SECRET`.

## Decisions

- **On Vercel with `dj` as a DNS-only record:** the page and its controls stay reachable during a block. Polling is not the normal path because pkmn shares Vercel Hobby's 1M calls and 4 CPU-hours a month. _(2026-11-06)_
- **Designed directly:** a plain dark page of its own, with no Claude Design boards. Plain CSS rather than shadcn, since it has few controls. _(owner, 2026-11-07; the CSS the agent's choice)_
- **Starting needs the caller in voice:** the bot joins their channel; if a session is running, anything added goes to its queue. _(owner, 2026-11-07)_
- **Playlists:** one owner edits each, and anyone allowed can browse and play it. _(owner, 2026-11-07)_
