# Zombies Coach — Tasks

## Cut the API functions' cold start

After 10 idle minutes a signed-out `/api/maps` on production took 4.0 s to its first byte with no database query: about 1.85 s for the zombies function to start and 2.2 s for the root's `/api/me`, one after the other (signed-out figures on the deployment before "Make the site's pages load fast", [The Zombies Site → Load Time](../../zombies/site/explanation/site.md#load-time)). Warm, the same calls take 55–110 ms. Locally, importing the zombies API module takes about 0.4 s, `drizzle-orm/node-postgres` alone about 240 ms, so module loading is a likely share of it; the root loads Better Auth.

**Do:**
- [ ] Read the first signed-in `Server-Timing` figures from production (the owner's, cold and warm) and set them beside the function start times.
- [ ] Measure where each function's cold start goes (module load against Vercel's own start), then cut it: bundle the function into one file, load the Anthropic client and the coach only on the routes that use them, and the same for the root's `/api/me` if it holds.
- [ ] If the Neon wake turns out to dominate instead, say so in the report with the figure, since keeping a compute awake is a cost the owner decides.
- [ ] Docs: the figures and what changed in `docs/zombies/site/explanation/site.md` and `docs/home/site/explanation/site.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site` and `home/site`; signed-out cold and warm time to first byte on production before and after; the maps page and the run page through the Playwright MCP locally with no change in what they show.
- Human-run: the owner opens the site after it has been idle and finds the maps quick to appear; reads `Server-Timing` on `/api/maps` signed in, cold and warm.
- Reuse: the `Server-Timing` metrics in `zombies/site/api/_lib/app.ts`.
- Neighbors: `dj/panel/api/_lib/app.ts`, which makes the same root lookup.
- Forbidden: a paid Neon or Vercel setting changed without the owner's yes; caching the reader across requests.

**Touches:** `zombies/site/api/`, `zombies/site/package.json`, `zombies/site/package-lock.json`, `zombies/site/vercel.json`, `home/site/api/`, `home/site/package.json`, `home/site/package-lock.json`, `docs/zombies/site/explanation/site.md`, `docs/home/site/explanation/site.md`

## Load with skeletons like the DJ panel

The owner finds the "— receiving —" loading line terrible and wants loading done as the DJ panel does it (2026-11-15): grey blocks in the shape of the content that is coming (the panel's `.skeleton` with a 1.4 s pulse in `dj/panel/src/index.css`, `SkeletonSongs` in `dj/panel/src/App.tsx`), with the real content fading in over them.

**Do:**
- [ ] Replace every "receiving" loading line in `zombies/site/src/` with skeletons shaped like what loads there: map rows (plan tile, name, meta) on the maps list; the map view's header and its run rows; the run page's rail, a few transcript rows and the composer; the join view.
- [ ] One `.skeleton` style in the site's dark tokens with a soft pulse, still under `prefers-reduced-motion`; content fades in when it arrives, with no layout shift between skeleton and content.
- [ ] Keep every empty and error state the UX review added.
- [ ] Docs: the loading state in `docs/zombies/site/reference/design-system.md` (States).

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; through the Playwright MCP at 1440×900 and 390×844 on a throttled network, each screen shows skeletons shaped like its content, then the content in the same place with no jump; no "receiving" text left (`grep -rni receiv zombies/site/src` finds none); no console error.
- Human-run: the owner opens the site after it has been idle and finds the wait looks like the DJ panel's.
- Reuse: the DJ panel's skeleton CSS and `SkeletonSongs` as the pattern.
- Neighbors: `dj/panel/src/`.
- Forbidden: a spinner; text standing in for loading; dropping an empty or error state.

**Touches:** `zombies/site/src/`, `docs/zombies/site/reference/design-system.md`

## Call runs attempts and list a map's attempts

The owner is not sold on runs as they show now (2026-11-15): a run is to be called an attempt, opening a map shows the list of its attempts, the ones that beat the easter egg are visually identifiable, and the one being played is easy to see. This also settles the question left by "Make the site's pages load fast", which hid runs nobody is in: a map's view lists every attempt again.

**Do:**
- [ ] Rename runs to attempts everywhere a player sees them: the UI copy in both languages ("attempt" / "intento"), the page URLs (`/attempts/<id>`), and the site docs' vocabulary; the internal tables and code names stay `runs` (the agent's choice, recorded in `docs/zombies/site/explanation/site.md`, so no migration renames data).
- [ ] The map view lists all its attempts, newest first, each with who played it, its language and when it was last played; the maps list row says how many attempts a map has and how many are beaten.
- [ ] An attempt is beaten once every required (non-optional) step of the map's bundle is recorded done in `run_steps`; it stays open, since nothing closes an attempt. A beaten attempt carries a distinct mark, and the attempt being played (someone in it; yours first) is highlighted at the top of the list.
- [ ] Draw the map view's attempts list, the beaten mark and the playing highlight on the canvas [Zombies Site](https://claude.ai/artifact/1C4DeEgm1B7vsMmP4DsXSu) (its "Third take" `Map` and `MapPhone` boards) in the design system's look, freeze them into `zombies/site/design/`, then build them; update `docs/zombies/site/reference/design-system.md`.
- [ ] Loading on the new list uses the skeletons from "Load with skeletons like the DJ panel".
- [ ] Record the owner's decision (attempts, the list, beaten and playing marks) and the beaten rule as dated decisions, replacing "Only runs with someone in them are listed".

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; through the Playwright MCP at desktop and phone width with two local members on the test map: three attempts on one map (one beaten by recording every required step done, one being played, one left), each identifiable at a glance, the played one at the top; no player-facing "run" left (`grep -rniE '\bruns?\b|partida' zombies/site/src` finds only code identifiers).
- Human-run: the owner opens Blood of the Dead's map view and finds the imported attempt, and later a beaten one, easy to pick out.
- Reuse: `run_steps` and the bundle's `requires` and `optional`; the map view from the third take.
- Neighbors: the backlog idea "zombies: the site as the hub of the group's runs", which this moves toward without scoping.
- Forbidden: closing or ending an attempt; renaming database tables; step or hint numbers, or a count of steps left, in the UI.

**Touches:** `zombies/site/`, `docs/zombies/`

## Watch a run from Claude Code and fix things live

A `watch` stream on the Claude API and a skill section so Claude follows a run while it is played: closing gaps with a checked line, applying revisions and card feedback, and fixing the dossier when players report something it contradicts, all in subagents, the terminal showing spoiler-free one-liners ([Discovery → Feedback and the watch loop](discovery.md#feedback-and-the-watch-loop)).

**Do:**
- [ ] `GET /api/claude/runs/<id>/events?after=` and `npm run watch -- <run>` printing one line per event, for `Monitor`.
- [ ] A "Watch" section in the ee-coach skill: per event type, what to do, which subagent, publish, and what one line to print.
- [ ] A held gap is answered on the run's next message, or posted at once if the run is waiting, once the new version lands.

**Acceptance:**
- Claude-run: `npm run gate`; with a test-map run open in the Playwright MCP, a gap appears in `watch`, a new line is published and the run delivers it; a revision changes a rung and the next delivery uses it.
- Human-run: on a game night, run the watch from Claude Code, send a `REVISION:` and see it applied without leaving the game.
- Reuse: the Claude API, `compile` and `publish`.
- Neighbors: the debrief in the ee-coach skill.
- Forbidden: solutions or rung text printed in the main conversation.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`

## Audit every reply and step in as Cari

The watch loop checks each live reply against the rules and Claude can post into a run as Cari when Haiku is lost ([Discovery → Feedback and the watch loop](discovery.md#feedback-and-the-watch-loop)).

**Do:**
- [ ] Code-side checks recorded on each reply (an unknown named, a rung skipped, an optional offered, a number shown), surfaced in `watch`; the skill's audit of what code cannot judge.
- [ ] `POST /api/claude/runs/<id>/say` behind `CLAUDE_TOKEN` posting as Cari, attributed to Claude.

**Acceptance:**
- Claude-run: `npm run gate`; a forced violation on the test map shows in `watch`; a step-in message shows in both browsers.
- Human-run: on a game night, see a step-in arrive in the run.
- Reuse: the watch stream and call log.
- Neighbors: the hold path.
- Forbidden: step-ins that bypass the knowledge marks.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`
**After:** Watch a run from Claude Code and fix things live

## Ask Cari by voice in the Discord call

The site side: the site's offer brings Cari into the run's voice channel, and «cari …» heard by the bot's `zombies` module becomes a line in the speaker's run, answered in the chat and spoken back ([Discovery → Voice](discovery.md#voice)).

**Do:**
- [ ] Site: `POST /api/voice` behind `INTERNAL_SECRET` (Discord ID + text → the speaker's run → reply), and the join offer when a member is in a channel, calling the bot's `/zombies/join`; `BOT_URL` and `INTERNAL_SECRET` in Vercel, `INTERNAL_SECRET` from the cluster's `discord-bot-enbraile` secret; never let the value appear in the conversation or a command line: pipe it as `kubectl -n dj get secret discord-bot-enbraile -o jsonpath='{.data.INTERNAL_SECRET}' | base64 -d | npx vercel env add INTERNAL_SECRET production` (owner, 2026-11-15).
- [ ] Docs: the voice parts of `docs/zombies/site/explanation/site.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `home/bot` and `zombies/site`; a local bot against the local site answers a fake trigger with the run's reply.
- Human-run: in a call, bring Cari in from the site, say «cari, una pista», hear the hint and see it in the chat; stop the bot and the site still answers typed questions.
- Reuse: the module from "Add the zombies module to the bot".
- Neighbors: `dj/panel/` calling the bot's API.
- Forbidden: Claude calls from the bot; run state in the bot's SQLite.

**Touches:** `zombies/site/`, `docs/zombies/site/`

## Keep the call's transcript in the run

While Cari is in the call for a run, what is said there goes into the run for the watch loop and debriefs ([Discovery → Voice](discovery.md#voice)).

**Do:**
- [ ] The module asks `transcripts.keep("zombies", true)` while in a run's call and forwards lines from `hearing.onTranscript` to `POST /api/voice/transcript`; the run stores them; `watch` and the Claude read show them.

**Acceptance:**
- Claude-run: `npm run gate` in both; a fake transcript reaches the run in a local pair.
- Human-run: talk in the call during a run and see the lines in the Claude read, and that the coach model got only the «cari» requests (call log).
- Reuse: `transcripts.keep`, `hearing.onTranscript`.
- Neighbors: `onTrigger`.
- Forbidden: transcript text in the coach model's prompt.

**Touches:** `zombies/bot/`, `zombies/site/`, `docs/zombies/`
**After:** Ask Cari by voice in the Discord call

## Show a zone on the map for level-3 hints

At prepare Claude finds a community map image and draws zones on the rungs that give a place; the card shows it ([Discovery → Visual hints](discovery.md#visual-hints)).

**Do:**
- [ ] Bundle: map images (stored with the bundle, never in git) and zones on level-3 (and some level-4) rungs.
- [ ] ee-coach prepare: find the image, place zones, blind-check them in a subagent; Blood of the Dead's zones.
- [ ] The card shows the zone as the boards draw it.

**Acceptance:**
- Claude-run: `npm run gate`; `compile` rejects a zone on a level 1–2 rung; the test map's level-3 card shows its zone in the Playwright MCP.
- Human-run: ask for a level-3 hint in Blood of the Dead and judge whether the zone is readable mid-round.
- Reuse: the bundle schema and `compile`.
- Neighbors: the hint card.
- Forbidden: a zone below level 3; a map image in the repo.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`
**After:** Prepare publishes Haiku-ready bundles, starting with Blood of the Dead
