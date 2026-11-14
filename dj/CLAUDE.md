# dj

@../docs/dj/index.md

Adds to the root `CLAUDE.md`; never repeats it. This category's docs live in `docs/dj/`, never under `dj/`.

- **Gate:** `npm run gate` in `home/bot/` (which checks the DJ module too) or `dj/panel/`. A change is then checked by running it: audio can only be judged by listening in a voice channel.
- **Versions:** every package is pinned exactly.
- **Secrets:** `home/bot/.env.local` and the cluster's 1Password item; `dj/panel/.env.local` and Vercel. The bot token and `INTERNAL_SECRET` never reach a browser.
