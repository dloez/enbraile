# The DJ Bot

The group's music bot for the `TemploManchego` Discord server (`757377019536211988`), in `dj/bot/`. Members use slash commands or the [panel](../../panel/explanation/panel.md) to play music in the voice channel they are in.

## How It Runs

A Worker (`src/worker.ts`) takes slash commands over Discord's HTTP interactions webhook and an internal API, behind `INTERNAL_SECRET`, used by the panel. One Durable Object (`Session`, `src/session.ts`) owns the queue, position, settings, playlists and history, in its storage and SQLite. It wakes a `basic` Container (`container/src/server.ts`) that runs discord.js, `@discordjs/voice`, `@snazzah/davey`, yt-dlp and ffmpeg, and holds the gateway and voice connections only while a session is active. No connection stays open between sessions, so the Container costs nothing idle.

A tick every 15 seconds renews the Container, counts its hours, saves the position, rejoins and resumes if the Container restarted, and applies the leave rules. The Container reports each track's start, end or failure back to the Worker.

## Measurements

From throwaway probes on 2026-11-06 and 2026-11-07, one run each.

| Fact | Measurement |
|------|-------------|
| Outbound UDP from a Container | Replies from three STUN servers in 18–36 ms; Cloudflare's docs do not document this either way |
| Discord voice from a `basic` Container | Ready with `aead_aes256_gcm_rtpsize` and DAVE protocol v1 |
| YouTube from a Cloudflare IP, no cookies | URL and search both streamed |
| Playback | 42 s, 0 missed frames |
| Memory | 110–123 MB |
| CPU while streaming | 0.135–0.228 busy fraction of `/proc/stat`, not established whether of the 1/4 vCPU or the host |
| SoundCloud search | HTTP 403 from yt-dlp |

YouTube may block the Cloudflare range later. The fallbacks are cookies from a throwaway account, then running the Container's workload at home, which needs only outbound connections.

## Cost

About $5.60 a month at 3 hours a day and $7.50 at 8 hours, including the $5 Workers Paid plan, assuming 0.05 vCPU on average. This is an estimate until a month's bill confirms it. The owner set a budget alert in the dashboard on 2026-11-07; alerts can arrive a day late and stop nothing, so the bot also refuses new playback past a monthly hour limit.

## Decisions

- **Cloudflare, on Workers Paid:** the owner accepts about $5 a month to keep the bot in one place. Oracle Always Free and a home machine stay as fallbacks. _(owner, 2026-11-06)_
- **`@discordjs/voice` with yt-dlp and ffmpeg, not Lavalink:** a single TypeScript process rather than a Java server in a TypeScript repo. _(2026-11-06)_
- **No outbound gateway connection in the Durable Object:** outgoing WebSockets do not hibernate, and HTTP interactions need none. _(2026-11-06)_
- **State in the Durable Object's SQLite, not D1:** one guild, one object, and nothing else reads it. _(2026-11-07)_
- **One shared Discord application,** renamed `Enbraile`, for login and bot; private, server installs only, with View Channels, Connect and Speak. _(owner, 2026-11-06)_
- **Access:** members of one DJ role, picked on the panel by a user with Manage Server; until one is picked, only Manage Server users. No votes to skip. _(owner, 2026-11-07)_
- **Sources:** YouTube search, videos and playlists; Spotify links matched to YouTube by title, read from Spotify's embed page so no credentials are needed. _(owner, 2026-11-07)_
- **Leaving:** 1 minute after the channel empties, 5 after the queue ends, 15 while paused. _(owner, 2026-11-07)_
- **200-hour monthly limit:** about $7–8 by the estimate above; Cloudflare's `usage_block` spend policy names only `workers` and `durable_objects`. _(owner, 2026-11-07)_
- **Autoplay:** off by default, stopping after an hour without human action and as soon as nobody is in the call. Keeping it going is a button on the panel; the bot posts nothing to Discord, since that would need Send Messages. _(owner's rule, 2026-11-07; the panel-only prompt chosen by the agent when told not to ask, so open to change)_
