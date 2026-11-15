# Zombies Coach — Tasks

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

## Show each map's real art on the maps list and map view

The owner wants the real map assets shown, not drawn stand-ins, for the maps themselves as well as the hints (2026-11-15). A full overhead map would show areas the players have not found, which the knowledge marks forbid until a hint reveals them, so the maps list and the map view show the map's official key art or loading screen (mood, no layout), and the overhead map stays inside level-3 zone cards ("Show a zone on the map for level-3 hints"). Images live with the published bundle, never in git ([Discovery → Visual hints](discovery.md#visual-hints)).

**Do:**
- [ ] At prepare, the ee-coach skill finds the map's key art or loading screen, saves it in the gitignored map dir, and checks in a subagent that it shows no layout, no area the baseline marks unknown, and no step; `compile` puts it in the bundle and `publish` sends it.
- [ ] Where a published image is stored and served is the build's choice (recorded in `docs/zombies/site/explanation/site.md`); the site shows it on the map's row and at the head of its view, in place of the drawn plan, with a skeleton while it loads; a map without one (the test map) keeps its drawn plan.
- [ ] Blood of the Dead's art found, checked, compiled and published.
- [ ] Docs: the bundle's image field, the decision, and the design-system doc's map row and map view.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; `compile` rejects an image path that is missing; through the Playwright MCP locally, a map with art shows it on its row and view at desktop and phone width, the test map keeps its plan; `git ls-files | grep -iE '\.(png|jpe?g|webp)$'` finds no map image tracked.
- Human-run: the owner sees Blood of the Dead's art on the maps list and finds it reveals nothing they have not seen.
- Reuse: the bundle, `compile` and `publish`; the map row and map view of the third take.
- Neighbors: "Show a zone on the map for level-3 hints", which stores the overhead map the same way.
- Forbidden: an overhead map or any layout on the maps list or map view; any map image in a tracked file.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`

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
