# How to Run and Deploy the Bot

## Prerequisites

- `home/bot/.env.local` (gitignored) holding `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` and `INTERNAL_SECRET`, and `ANTHROPIC_API_KEY` for the assistant to answer.
- For the cluster steps, `kubectl` and `flux` pointed at `tom`, and the owner's `dloez` repository.

## Run It Locally

1. From `home/bot/`: `npm ci`, which also links each module's `node_modules` to the host's, then `npm run gate`.
2. `npm run dev`. It logs in with the real bot token, registers the slash commands and serves the API on port 8080, with its database in `data/` (gitignored). Only one copy of the bot should join voice at a time, so don't play anything locally while the cluster's bot is in a call.
3. Point the panel at it with `BOT_URL=http://localhost:8080` in `dj/panel/.env.local`.

## Deploy

Push to `main`. The `bot image` workflow builds and pushes the image, and within a few minutes Flux commits the new tag to `dloez` and rolls the pod. A rollout restarts the bot, which rejoins the call and resumes the song from its last saved position. Check it by running `/play` in a voice channel and listening.

Follow a deploy with `flux get images policy dj` (the tag it picked) and `kubectl -n dj rollout status deploy/dj`. Read the logs with `kubectl -n dj logs deploy/dj`.

To roll back, revert the commit in `enbraile` and push, which builds a newer image of the older code.

## Set It Up Once

1. In the Tailscale admin console → DNS, turn on MagicDNS and HTTPS Certificates, and note the tailnet's DNS name (`<tailnet>.ts.net`).
2. In Access Controls, add `"tag:dj": ["autogroup:admin"]` to `tagOwners`, and a `nodeAttrs` entry `{"target": ["tag:dj"], "attr": ["funnel"]}`.
3. In Settings → Keys, generate an auth key: pre-approved, tagged `tag:dj`, not ephemeral. The pod uses it only for its first login.
4. In 1Password, vault `Homelab - Tom`, create an item `dj` with the fields `bot-token` (the bot token), `internal-secret` (the same `INTERNAL_SECRET` as the panel's), `ts-authkey` and `anthropic-api-key` (a Claude Console key, optional: without it the assistant gives a canned reply).
5. In `dloez`, set `PUBLIC_URL` in `homelab/apps/tom/dj.yaml` to `https://dj.<tailnet>.ts.net` and push. Flux creates the namespace, the secret, the volume and both pods, and then keeps the bot's image current.
6. In the Discord developer portal, check that the application has no Interactions Endpoint URL, so Discord sends commands over the gateway. The bot registers its slash commands itself on every start.
7. In Vercel, set the panel's `BOT_URL` to `https://dj.<tailnet>.ts.net` for Production, and redeploy.

## Verification

- `curl -s https://dj.<tailnet>.ts.net/healthz` prints `{"ok":true}`, and `curl -s -o /dev/null -w '%{http_code}' https://dj.<tailnet>.ts.net/dj/state` prints `404`, since it has no secret. The first request after the pod starts is slow while it gets its certificate.
- The panel at `dj.enbraile.vip` loads the player, and a search lists songs.
- `/play` in a voice channel plays.
