# How to Run and Deploy the Bot

## Prerequisites

- `dj/bot/.env.local` (gitignored) holding `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` and `INTERNAL_SECRET`.
- For the cluster steps, `kubectl` and `flux` pointed at `tom`, and the owner's `dloez` repository.

## Run It Locally

1. From `dj/bot/`: `npm ci`, then `npm run gate`.
2. `npm run dev`. It logs in with the real bot token and serves the API on port 8080, with its database in `data/` (gitignored). Only one copy of the bot should join voice at a time, so don't play anything locally while the cluster's bot is in a call.
3. Point the panel at it with `BOT_URL=http://localhost:8080` in `dj/panel/.env.local`.

## Deploy

Push to `main`. The `dj bot image` workflow builds and pushes the image, and within a few minutes Flux commits the new tag to `dloez` and rolls the pod. A rollout restarts the bot, which rejoins the call and resumes the song from its last saved position. Check it by running `/play` in a voice channel and listening.

Follow a deploy with `flux get images policy dj` (the tag it picked) and `kubectl -n dj rollout status deploy/dj`. Read the logs with `kubectl -n dj logs deploy/dj`.

To roll back, revert the commit in `enbraile` and push, which builds a newer image of the older code.

## Set It Up Once

1. In Cloudflare Zero Trust → Networks → Tunnels, create a cloudflared tunnel named `dj`, and copy its token. Add a public hostname `dj-api.enbraile.vip` with service `http://dj.dj.svc.cluster.local:8080`.
2. In 1Password, vault `Homelab - Tom`, create an item `dj` with the fields `bot-token` (the bot token), `internal-secret` (the same `INTERNAL_SECRET` as the panel's) and `tunnel-token`.
3. Push `enbraile` so the workflow publishes the first image. In GitHub → Packages → `enbraile-dj-bot` → Package settings, make the package public, so the cluster can pull it without credentials.
4. Put that first tag in `homelab/apps/tom/dj.yaml` in `dloez` and push. Flux creates the namespace, the secret, the volume and both pods, and then keeps the tag current.
5. From `dj/bot/`, run `npm run commands`. It registers the slash commands and clears the application's interactions endpoint URL, so Discord sends commands over the gateway.
6. In Vercel, set the panel's `BOT_URL` to `https://dj-api.enbraile.vip` for Production, and redeploy.

## Verification

- `curl -s https://dj-api.enbraile.vip/healthz` prints `{"ok":true}`, and `curl -s -o /dev/null -w '%{http_code}' https://dj-api.enbraile.vip/internal/state` prints `404`.
- The panel at `dj.enbraile.vip` loads the player, and a search lists songs.
- `/play` in a voice channel plays.
