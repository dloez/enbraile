# The Enbraile Bot

The group's Discord bot, `Enbraile`, for the `TemploManchego` server (`757377019536211988`). One Node process in `home/bot/` hosts the bot's features as modules; the first is the [DJ](../../../dj/bot/explanation/bot.md). The host holds what Discord allows only once per bot: the gateway connection, the server's slash commands and the voice connection. It also holds what every module needs: the database and the API.

## How It Runs

The process runs in the `dj` namespace of the owner's home Kubernetes cluster, `tom` (two Raspberry Pi CM5 boards, arm64), declared in the owner's `dloez` repository under `homelab/apps/tom/dj.yaml`. A `tailscale` pod beside it publishes the API with Tailscale Funnel at `https://dj.<tailnet>.ts.net`, over an outbound connection, so no port opens on the home network. See [How to Run and Deploy the Bot](../how-to/run-and-deploy-the-bot.md).

The host (`home/bot/src/`) holds:

- the gateway client (`discord.ts`), with the Guilds and Guild Voice States intents.
- the slash commands (`commands.ts`): on every start it registers every module's commands with the server in one call, and routes each command and autocomplete to the module that declared it. A command's reply is deferred, ephemeral if the module asks, and a command that throws answers "That didn't work." in the user's language.
- SQLite through `node:sqlite` (`db.ts`), at `DATA_PATH`, on a 1 Gi Longhorn volume at `/data`, with a `kv` table; each module creates its own tables in the same file.
- the HTTP API behind `INTERNAL_SECRET` (`api.ts`): `/<module>/<path>` goes to that module's route, as the user named by `userId` in the query or body; `/healthz` answers `{"ok":true}`; anything else is 404.
- the live sockets (`api.ts`, `ticket.ts`): a module's route can hand out a ticket, signed for one user and one module and valid for 60 s, which opens `/<module>/live`. The socket gets the module's pushes and answers the same calls as its HTTP routes, as that user, except `ticket`. Every 10 s the host pings each socket, closing one whose last ping went unanswered, and sends a `beat` message.

A module (`home/bot/src/module.ts`) is an object with a `name` and any of `commands`, `route`, `live`, `start` (run once the gateway is ready) and `stop` (run on shutdown). The modules are listed in `home/bot/src/modules.ts`. A module imports only `home/bot/src/sdk.ts`, which exports the client, the server, member lookup, the database, tickets and the voice hub.

## Voice

A bot can be in one voice channel per server, so the host owns the one voice connection (`voice.ts`) and modules hold leases on it. `voice.hold(owner, channel)` adds a lease and joins the channel, moving the bot if it was elsewhere; `voice.release(owner)` drops it, and the bot leaves when no lease is left. A module hands the hub the audio player it plays through (`voice.play`), which the hub subscribes to every connection it makes. `voice.members()` lists the people in the bot's channel, read from the gateway's voice states.

The hub rejoins on its own. A connection that has not started reconnecting by itself within 5 s of dropping is joined again at once, and a check every 15 s rejoins one that is still down; after four failed joins in a row it drops every lease and leaves. Modules follow it through `voice.watch` events: `lost` when it starts rejoining, `rejoined` when it is back, `gone` when it gives up, `moved` when someone drags the bot to another channel, and `members` when someone joins or leaves the bot's channel.

## Modules in Other Categories

A module's code stays in its own category (`dj/bot/` for the DJ), so the host imports it by relative path. A module has no dependencies of its own: the host's `package.json` holds them all, and `npm ci` in `home/bot/` links each module's `node_modules` to the host's (`scripts/link-modules.mjs`). Node caches a package by its real path, so the host and every module share one copy of `discord.js` and `@discordjs/voice`. A module keeps a `package.json` that only says `"type": "module"`.

## Deploying

A push to `main` touching `home/bot/` or `dj/bot/` runs `.github/workflows/home-bot.yml` on GitHub's arm64 runner. It runs the gate and builds `home/bot/Dockerfile` from the repository root, pushing `ghcr.io/dloez/enbraile-dj-bot:main-<UTC timestamp>-<short sha>`. Flux in `tom` scans the repository every minute, picks the newest tag (`clusters/tom/dj-image-automation.yaml` in `dloez`), commits it to `dloez`'s `main`, and rolls the pod.

## Decisions

- **One process hosting modules, not one bot per feature:** a bot account can be in one voice channel per server, and a voice assistant has to control and talk over the music in the same call. The one shared Discord application, below, stays. Separate processes talking over RPC were rejected as too much for two Raspberry Pis and one server. _(owner, 2026-11-15)_
- **The host in `home/`, each module in its own category:** `home` holds what the group's apps share, as the shared login does; the DJ's code stays in `dj/bot/`. _(owner, 2026-11-15)_
- **Modules share the host's `node_modules` through a link, not an npm workspace:** a workspace needs a `package.json` at the repository root, which could change how Vercel installs the three web projects. A workspace rooted in `home/bot/` does not work either: Node resolves a module's imports from its real path, outside the host, and refuses to strip types from files under `node_modules`. Checked in throwaway probes, 2026-11-15. _(the agent's choice, 2026-11-15)_
- **Module routes under `/<module>/`:** the DJ's routes moved from `/internal/` to `/dj/`, and the panel with them in the same commit. _(the agent's choice, 2026-11-15)_
- **Slash commands registered on every start,** replacing a script run by hand after each change to them; the one-time clearing of the interactions endpoint URL that script also did is not repeated, since a new application has none. _(the agent's choice, 2026-11-15)_
- **The deployment keeps its `dj` names:** the image `enbraile-dj-bot`, the `dj` namespace, the `dj.<tailnet>.ts.net` address and `/data/dj.db` are set in `dloez`, so renaming them is a change there, left for later. _(the agent's choice, 2026-11-15)_
- **On the owner's cluster `tom`, not Cloudflare:** the bot is one long-lived process holding gateway and voice connections, which Workers, a Durable Object and a Container that woke on demand only imitated, slowly and for about $5–8 a month. Supersedes running on Cloudflare Workers Paid with Containers (2026-11-06) and deploying through Workers Builds (2026-11-07). _(owner, 2026-11-07)_
- **API published through Tailscale Funnel, not a Cloudflare Tunnel:** both are outbound-only, so no port forwarding and the home IP stays private, but Funnel's public relays are Tailscale's own servers rather than Cloudflare's IPs, which Spanish ISPs block during LaLiga matches, so the panel's live socket should keep working then. No report of a LaLiga block hitting Tailscale was found on 2026-11-07; if one does, the panel polls through Vercel as before. The cost is a `ts.net` address instead of an `enbraile.vip` one, which only the panel sees. _(owner, 2026-11-07)_
- **Deployed by Flux image automation pushing straight to `dloez`'s `main`,** unlike pihole's reviewed bumps, so a push to `enbraile` deploys like the panel does. _(owner asked for deploy on push, 2026-11-07)_
- **Either node:** the pod has no node pinning. _(owner, 2026-11-07)_
- **No monthly hour limit:** it only capped the Container bill. _(owner, 2026-11-07)_
- **SQLite on the pod's volume:** one guild and one process, and nothing else reads it; every module shares the file. _(2026-11-07)_
- **One shared Discord application,** renamed `Enbraile`, for login and bot; private, server installs only, with View Channels, Connect and Speak. _(owner, 2026-11-06)_
- **The voice connection and rejoining moved from the DJ into the host,** with the DJ's numbers kept (5 s to recover, a check every 15 s, four failed joins), so every module gets the same rejoin and a voice assistant can share the call with the music. _(owner, 2026-11-15; the lease mechanism the agent's choice)_
