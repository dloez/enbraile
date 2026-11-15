# Zombies Coach — Tasks

## Use the screen's full width on every page and scroll only the content

The owner reports that the chat does not take the screen's width and that the page scrolls over it (2026-11-15). In `zombies/site/src/index.css`, `.runv` takes `calc(100dvh - var(--hd))` while `#root` only has a `min-height` and the page itself can scroll, so any header or bar above the composer (the trouble notice, revision mode) taller than `--hd` makes the whole page scroll on top of `.rows`; and the chat is capped at fixed widths (`.cmp-in` and `.mode` 784px, `.field` 680px, slips 640px), leaving the right side empty on a wide screen. The owner also wants every page to make full use of the screen's width (2026-11-15): the maps list and the map view sit in fixed containers (`max-width` 1232px and 928px in `index.css`).

**Do:**
- [ ] The attempt page fills exactly the viewport at every width: the page never scrolls there, only the transcript (`.rows`) and, if it overflows, the rail; the composer and the bars above it stay pinned, including with a phone's keyboard open.
- [ ] The transcript, slips, composer and mode bar use the main column's full width, keeping lines readable with the design system's spacing rather than fixed caps; update the boards' widths in `docs/zombies/site/reference/design-system.md` where the built page now differs.
- [ ] Every page (maps list, map view, join, attempt) uses the screen's full width: no fixed container width leaving empty bands; on wide screens the layout adds columns or widens rows (e.g. map rows in a grid, the map view's attempts beside its start panel) rather than centring a narrow column, with line lengths kept readable; no page scrolls over its own content.
- [ ] Redesign the map view's layout (owner, 2026-11-15: a whole column for only the name and image is awful): the map's identity as a banner across the top (the announcement image wide, with the name and the attempt and beaten counts over or beside it), and the space below for the attempts list and Start a run, side by side on wide screens, keeping every mark, the one-tap join, the inline language, the one-run note and the skeletons.
- [ ] Draw the wide layouts on the canvas [Zombies Site](https://claude.ai/artifact/1C4DeEgm1B7vsMmP4DsXSu) ("Third take" boards at 1920×1080 beside the 1440 ones) before building them, and freeze them into `zombies/site/design/`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; through the Playwright MCP at 1920×1080, 1440×900 and 390×844 with a long transcript and the trouble notice and revision mode shown: `document.scrollingElement.scrollHeight` equals the viewport height on the attempt page, only `.rows` scrolls, the composer stays in view, and the chat spans the main column; at 1920×1080 the maps list, map view and join view leave no empty side bands and match their wide boards.
- Human-run: the owner reads a long attempt on desktop and phone and only the chat scrolls.
- Reuse: the third take's layout shell; the stick-to-bottom scroll the UX review added.
- Neighbors: the DJ panel's full-height layout in `dj/panel/src/index.css`.
- Forbidden: dropping a state or the transcript's scroll behaviour.

**Touches:** `zombies/site/src/`, `zombies/site/design/`, `docs/zombies/site/reference/design-system.md`

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
