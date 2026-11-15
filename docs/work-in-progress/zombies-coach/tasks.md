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

## Continue the Blood of the Dead session on the site

Import the Blood of the Dead terminal session into production so the group continues it on the site, then retire the old workspace ([Discovery → Migration](discovery.md#migration)). The importer landed and the session imported locally (2 members, 23 rungs on 16 cards, 67 marks, 17 steps done, none with a requirement left undone); the gitignored `zombies/maps/bo4/blood-of-the-dead/import.json` is ready.

**Do:**
- [ ] With the owner's yes, run the import against production (`ZOMBIES_URL` the production site), using `import.json` with the players' real names and Discord IDs (the session names neither; the local import used "Jugador 1" and "Jugador 2").
- [ ] Delete `~/workspace/zombies/` after the owner confirms the run reads right on the site.

**Acceptance:**
- Human-run: open the imported run, ask for the next hint, and get what the terminal would have given; confirm deleting the old folder.
- Forbidden: importing into production or deleting the old workspace before the owner's yes.

**Touches:** `zombies/maps/` (gitignored), `~/workspace/zombies/`
**Needs the author:**
- Import the Blood of the Dead session into production now? Give the two players' names and Discord IDs.
- After opening the imported run and asking for a hint, may `~/workspace/zombies/` be deleted?

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
