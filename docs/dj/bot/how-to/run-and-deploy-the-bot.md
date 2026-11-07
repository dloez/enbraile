# How to Run and Deploy the Bot

## Prerequisites

- Docker running, and Wrangler signed in to the owner's Cloudflare account (`npx wrangler whoami`).
- `dj/bot/.env.local` (gitignored) holding `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` and `INTERNAL_SECRET`.

## Steps

1. Install, from `dj/bot/`: `npm ci`, and `npm ci` in `container/`.
2. Check types: `npm run gate`.
3. Write `.secrets.json` (gitignored), a JSON object of `DISCORD_BOT_TOKEN` and `INTERNAL_SECRET` from `.env.local`.
4. Deploy: `npm run deploy`. A deploy replaces the running Container, so do it when nobody is listening.
5. After changing a command, register commands and the interactions endpoint: `npm run commands`.
6. Check it by running `/play` in a voice channel and listening. `npx wrangler tail dj-bot` shows the Worker's logs.

To roll back, `npx wrangler rollback`.
