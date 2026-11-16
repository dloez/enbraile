# The Zombies Bot Module

Cari's voice in the group's Discord call: a module of the [Enbraile bot](../../../home/bot/explanation/bot.md) with its code in `zombies/bot/`. It brings the bot into a run member's voice channel, hears «cari …» and passes it to the [site](../../site/explanation/site.md), which answers as the speaker's run, speaks the answer back, and sends the site everything else said in the call for the run to keep. The bot is only the interface: it holds no run state and calls no model ([The Zombies Site → Decisions](../../site/explanation/site.md#decisions), "The site is the brain, the bot only an interface").

## How It Works

The module (`src/index.ts`) brings the `/cari` command and the routes; the call itself is in `src/call.ts`.

- **Joining:** `/cari` in Discord, or the site's `POST /zombies/join` with the member's `userId`, holds the host's voice connection for `zombies` in the channel that member is in, with `listen`, so the bot hears the call. Joining answers `{ channelId }`, or 409 with `{ error }` set to `notInVoice`, `noAccess` (the bot's role cannot view, connect or speak there) or `full`. `/cari` gives the same outcome as an ephemeral reply in the user's language. If the DJ is playing in another channel, joining moves the bot, as any lease does.
- **Looking:** `GET /zombies/voice?userId=` answers `{ channel, cari }`: the member's voice channel (`id`, `name`, `canJoin` and the `reason` it cannot) or `null`, and the channel the module holds or `null`, so the site can decide whether to offer bringing Cari in.
- **Naming:** `POST /zombies/names` with `{ ids }`, up to 50 Discord IDs, answers `{ names }`, each ID that is a member of the server mapped to its current server display name, fetched from Discord rather than the cache, since the bot gets no member updates; an ID it cannot find is left out. The site shows members by these names ([The Zombies Site → Attempts](../../site/explanation/site.md#attempts)).
- **Leaving:** `POST /zombies/leave` drops the lease, and so does the last person leaving the bot's channel; the bot stays if the DJ still holds it.
- **Hearing:** the module registers «cari» with `hearing.onTrigger` once, at start. While it holds the call, each trigger is sent to `POST <ZOMBIES_URL>/api/voice` as `{ userId, text }`, with `INTERNAL_SECRET` as the bearer token; the site finds the speaker's run, answers there and returns `{ reply }`. A non-empty `reply` is spoken with `hearing.say`; `null` is silence. A failed or slow request (25 s) is logged and nothing is said.
- **Keeping the call:** while the module holds the call it asks the host for transcripts with `transcripts.keep("zombies", true)`, and takes the request back when it leaves or loses the lease, so the bucket stores the call too when it is configured. Its `hearing.onTranscript` handler, registered once at start, sends each line said in the call, triggers included, to `POST <ZOMBIES_URL>/api/voice/transcript` as `{ userId, name, text, at, ms, broughtBy }`, `broughtBy` being the member who brought Cari in last, so the site can file a line from someone in no run under that member's run. A failed request is logged and the line is not sent again. Cari's own spoken lines are not sent, since her replies are already in the run's chat.

Every route sits behind the host's `INTERNAL_SECRET` ([The Enbraile Bot → How It Runs](../../../home/bot/explanation/bot.md#how-it-runs)). `ZOMBIES_URL` defaults to `https://zombies.enbraile.vip`; a local run against a local site sets it.

## Deploying

The module deploys with the host: see [The Enbraile Bot → Deploying](../../../home/bot/explanation/bot.md#deploying).

## Decisions

- **The site's address defaults to production:** the bot's cluster manifest in `dloez` needs no new variable, and a local run overrides it with `ZOMBIES_URL`. _(the agent's choice, 2026-11-15)_
- **A `voice` route beside `join`:** the site offers to bring Cari in only when a member is in a channel, and only the bot can see voice states. _(the agent's choice, 2026-11-15)_
- **The lease drops when the call empties,** since a listening lease left behind would keep the bot in an empty channel hearing nothing. _(the agent's choice, 2026-11-15)_
- **The chime on «cari» stays on** (the trigger's default `ack`): it only says the word was heard, which the voice tests asked for, not that a hint is new, so it is not one of the sound cues the site's "Cari's voice only" rules out ([The Zombies Site → Decisions](../../site/explanation/site.md#decisions)). _(the agent's choice, 2026-11-15)_
- **Each call line goes to the site as it is heard,** one request per sentence and none retried: sentences come seconds apart, and the bucket keeps the full call when it is configured. _(the agent's choice, 2026-11-15)_
- **A line from someone in no run goes to the run of whoever brought Cari in,** since a friend in the call who never opened the site is still part of the attempt. _(the agent's choice, 2026-11-15)_
- **Names fetched one by one, fresh:** `names` fetches each member from Discord with `force`, in parallel, since the host has no `GuildMembers` intent and so its member cache is never updated after a rename; the site's one-minute cache keeps the requests few. _(the agent's choice, 2026-11-16)_
- **The site's reply is `{ reply: string | null }`,** spoken as it comes; the language is the run's, chosen on the site. _(the agent's choice, 2026-11-15)_
