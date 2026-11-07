# How to Run and Deploy the Bot

## Prerequisites

- Docker running, and Wrangler signed in to the owner's Cloudflare account (`npx wrangler whoami`).
- `dj/bot/.env.local` (gitignored) holding `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` and `INTERNAL_SECRET`.

## Steps

1. Install, from `dj/bot/`: `npm ci`, and `npm ci` in `container/`.
2. Check types: `npm run gate`.
3. Push to `main`. Workers Builds deploys every push that touches `dj/bot/` (see [Deploy on Push](#deploy-on-push)), and its log is under the Worker's Deployments in the dashboard. A deploy replaces the running Container, which cuts the song that is playing.
4. To deploy by hand instead, write `.secrets.json` (gitignored), a JSON object of `DISCORD_BOT_TOKEN` and `INTERNAL_SECRET` from `.env.local`, then run `npm run deploy`.
5. After changing a command, register commands and the interactions endpoint: `npm run commands`.
6. Check it by running `/play` in a voice channel and listening. `npx wrangler tail dj-bot` shows the Worker's logs.

To roll back, `npx wrangler rollback`, or revert the commit and push.

## Deploy on Push

Set up once, in the Cloudflare dashboard (the GitHub app is approved there, so it can't be done from the CLI):

1. Workers & Pages → `dj-bot` → Settings → Builds → Connect, and pick the `enbraile` GitHub repository.
2. Production branch `main`. Root directory `dj/bot`. Build command `npm ci && npm ci --prefix container && npm run gate`. Deploy command `npx wrangler deploy`.
3. Build watch paths: include `dj/bot/*`, so pushes that touch only other projects don't deploy it. Cloudflare's docs don't say whether these paths are relative to the repository or to the root directory: if a push touching `dj/bot/` doesn't build, use `*` instead.
4. Under Settings → Build → Branch control, untick Enable Preview Builds: their default command uploads Worker code only, and pointing it at a full deploy would roll the live Container.

The Worker's secrets stay on it between deploys, so the build needs none, and its own build token covers the deploy.
