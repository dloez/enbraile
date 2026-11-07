# The DJ Bot

The group's music bot for the `TemploManchego` Discord server (`757377019536211988`), in `dj/bot/`. Members use slash commands or the [panel](../../panel/explanation/panel.md) to play music in the voice channel they are in.

## How It Runs

One Node process (`src/main.ts`) runs in the `dj` namespace of the owner's home Kubernetes cluster, `tom` (two Raspberry Pi CM5 boards, arm64), declared in the owner's `dloez` repository under `homelab/apps/tom/dj.yaml`. It holds:

- the Discord gateway connection (`src/client.ts`). Slash commands arrive over it (`src/discord.ts`), so the application has no interactions endpoint URL.
- voice, with `@discordjs/voice`, `@snazzah/davey`, yt-dlp and ffmpeg (`src/player.ts`).
- the queue, settings, playlists and history (`src/session.ts`), in SQLite through `node:sqlite` (`src/db.ts`), on a 1 Gi Longhorn volume at `/data`.
- an HTTP API for the panel behind `INTERNAL_SECRET`, plus the `/live` WebSocket (`src/api.ts`).

A `cloudflared` pod beside it runs a Cloudflare Tunnel, which publishes the API at `https://dj-api.enbraile.vip` without opening a port on the home network.

A tick every 15 seconds while a session runs saves the position, rejoins and resumes if the voice connection dropped, and applies the leave rules. On shutdown the process saves the position, and on start it rejoins and resumes a session that was running.

## Deploying

A push to `main` touching `dj/bot/` runs `.github/workflows/dj-bot.yml` on GitHub's arm64 runner. It runs the gate and pushes `ghcr.io/dloez/enbraile-dj-bot:main-<UTC timestamp>-<short sha>`. Flux in `tom` scans the repository every minute, picks the newest tag (`clusters/tom/dj-image-automation.yaml` in `dloez`), commits it to `dloez`'s `main`, and rolls the pod. See [How to Run and Deploy the Bot](../how-to/run-and-deploy-the-bot.md).

## Measurements

From throwaway probes on 2026-11-06 and 2026-11-07, one run each.

| Fact | Measurement |
|------|-------------|
| Playback on Cloudflare's `basic` Container, the first host | 42 s, 0 missed frames, 110–123 MB of memory |
| SoundCloud search | HTTP 403 from yt-dlp |
| YouTube Music song search from a home connection and from Cloudflare | The official track first for five popular songs, with artist, album, length, cover and play count |

## Decisions

- **On the owner's cluster `tom`, not Cloudflare:** the bot is one long-lived process holding gateway and voice connections, which Workers, a Durable Object and a Container that woke on demand only imitated, slowly and for about $5–8 a month. Supersedes running on Cloudflare Workers Paid with Containers (2026-11-06) and deploying through Workers Builds (2026-11-07). _(owner, 2026-11-07)_
- **API published through a Cloudflare Tunnel at `dj-api.enbraile.vip`:** outbound-only, so no port forwarding and the home IP stays private. During a LaLiga block of Cloudflare's IPs the panel's socket fails and the panel polls through Vercel, which reaches the tunnel. _(owner, 2026-11-07)_
- **Deployed by Flux image automation pushing straight to `dloez`'s `main`,** unlike pihole's reviewed bumps, so a push to `enbraile` deploys like the panel does. _(owner asked for deploy on push, 2026-11-07)_
- **Either node:** the pod has no node pinning. _(owner, 2026-11-07)_
- **No monthly hour limit:** it only capped the Container bill. _(owner, 2026-11-07)_
- **`@discordjs/voice` with yt-dlp and ffmpeg, not Lavalink:** a single TypeScript process rather than a Java server in a TypeScript repo. _(2026-11-06)_
- **SQLite on the pod's volume:** one guild and one process, and nothing else reads it. _(2026-11-07)_
- **One shared Discord application,** renamed `Enbraile`, for login and bot; private, server installs only, with View Channels, Connect and Speak. _(owner, 2026-11-06)_
- **Access:** members of one DJ role, picked on the panel by a user with Manage Server; until one is picked, only Manage Server users. No votes to skip. _(owner, 2026-11-07)_
- **Sources:** YouTube Music song search, YouTube videos and playlists, and Spotify links, matched to YouTube by title from Spotify's embed page so no credentials are needed. _(owner, 2026-11-07)_
- **YouTube Music songs, not YouTube videos, for text:** plain YouTube search returned music videos, covers and other versions. `src/music.ts` asks YouTube Music's web API for songs only, which needs no key. The panel lists its results; `/play` with text takes the top song. Spotify tracks resolve lazily, as a `music.youtube.com/search?…#songs` URL that yt-dlp plays the first song of. If that API changes, `/play` falls back to the lazy search URL, and the panel reports that search failed and asks for a link. _(owner asked for better results, 2026-11-07; the mechanism the agent's choice)_
- **Leaving:** 1 minute after the channel empties, 5 after the queue ends, 15 while paused. _(owner, 2026-11-07)_
- **Autoplay:** off by default, stopping after an hour without human action and as soon as nobody is in the call. Keeping it going is a button on the panel; the bot posts nothing to Discord, since that would need Send Messages. The next autoplay song is picked when the last queued song starts, preloaded, and shown at the end of the panel's queue; adding a song drops the pick, so it is always based on the newest one. _(owner's rule, 2026-11-07; the panel-only prompt chosen by the agent when told not to ask, so open to change)_
