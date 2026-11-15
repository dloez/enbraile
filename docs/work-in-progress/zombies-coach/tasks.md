# Zombies Coach — Tasks

## Rebuild the site from the third take

The owner found the radio-log site's flow awkward and its UI clumsy and hard to read, and asked for map rows to be clickable and for Claude design to remake it (2026-11-15). The "Third take" page of the canvas [Zombies Site](https://claude.ai/artifact/1C4DeEgm1B7vsMmP4DsXSu) redraws it: every map row opens a new map view with its open runs and one "Start a run" with the language inline; a shared link lands on the join view; a "Your run" pill in the header leads back to your run; body text in Atkinson Hyperlegible Next at 16–18px in sentence case, a warm dark theme with the paper slip and survey sheet as light cards, and soft cards on one spacing scale. It keeps the radio-log identity (the run as a log, hints as dispatch slips) and replaces the v2 look ([Discovery → Runs and the site](discovery.md#runs-and-the-site)).

**Do:**
- [ ] Freeze the canvas's `v3/*.dc.html` boards into `zombies/site/design/`, replacing the current files (kebab-case names, `map.dc.html` and `map-phone.dc.html` new).
- [ ] Build the flow: map rows as single links to a map view route; start and join from there; a shared run link on the join view; the "Your run" pill on every screen outside the run; "Copy link" in the run; the one-run rule as a line under the actions, without a confirmation step.
- [ ] Restyle every built screen to the boards, keeping the loading, empty and error states, focus handling and fixes the UX review added, redrawn in the new look.
- [ ] Rewrite `docs/zombies/site/reference/design-system.md` from the boards (tokens, type, shape, spacing, components, states) and update `docs/zombies/site/explanation/site.md` for the map view route and the owner's decision.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; through the Playwright MCP at 1440×900 and 390×844 with two local members on the test map: pick a map → start (2 taps), pick a map → join (2 taps), run link → join (1 tap), back to my run (1 tap), each screen matching its board, every loading, empty and error state still present, no console error.
- Human-run: the owner and a friend use it on phones on `zombies.enbraile.vip` and find it easy to read and to move around.
- Reuse: the boards; the states and fixes in `zombies/site/src/` from the UX review.
- Neighbors: `pkmn/site/design/` for the freeze format.
- Forbidden: step or hint numbers in the UI; a way to end a run; real map content or any game's art in a board; dropping a state the UX review added.

**Touches:** `zombies/site/design/`, `zombies/site/src/`, `zombies/site/index.html`, `zombies/site/package.json`, `zombies/site/package-lock.json`, `docs/zombies/site/`

## Hold on gaps and take REVISION and card feedback

When no prepared line fits, Cari holds and the run records a gap; `REVISION:` messages and card feedback are stored with the line they refer to and never go to the model as gameplay ([Discovery → Feedback and the watch loop](discovery.md#feedback-and-the-watch-loop)).

**Do:**
- [ ] A hold tool with prepared in-voice non-answers per language; a gap record with the context.
- [ ] `REVISION:` detection (and wherever the boards put feedback) acknowledged briefly; feedback controls on cards; both logged on the run.
- [ ] `GET /api/claude/runs/<id>` behind `CLAUDE_TOKEN` returns the run's log, gaps, feedback and marks for debriefs; the ee-coach debrief reads it.

**Acceptance:**
- Claude-run: `npm run gate`; through the Playwright MCP, a question the test map has no line for gets a hold and a gap; a `REVISION:` message gets an acknowledgement and no model call (read from the call log); card feedback appears in the Claude read.
- Human-run: send a `REVISION:` from a phone; in Claude Code, run the debrief and see it.
- Reuse: the call log and run state of earlier entries.
- Neighbors: the hint tools.
- Forbidden: an improvised hint; a `REVISION:` reaching the coach model.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/site/`

## Continue the Blood of the Dead session on the site

Import the terminal session into a run so the group continues it on the site, then retire the old workspace ([Discovery → Migration](discovery.md#migration)).

**Do:**
- [ ] A Claude import of a run from a map's `session.md` and `knowledge.md` (members, marks, hints given, open threads), in a subagent.
- [ ] Delete `~/workspace/zombies/` after the owner confirms the run reads right on the site.

**Acceptance:**
- Claude-run: `npm run gate`; the imported run's revealed marks and hint log match `session.md` and `knowledge.md` (checked in a subagent, reporting counts only).
- Human-run: open the imported run, ask for the next hint, and get what the terminal would have given; confirm deleting the old folder.
- Reuse: the Claude API and bundle of earlier entries.
- Neighbors: the publish script.
- Forbidden: deleting the old workspace before the owner's yes.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`
**After:** Prepare publishes Haiku-ready bundles, starting with Blood of the Dead; Hold on gaps and take REVISION and card feedback

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
**After:** Continue the Blood of the Dead session on the site

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

## Let modules hear the call's transcript

The host side of keeping a call's transcript, split from "Keep the call's transcript in the run" so it can run beside site work (2026-11-15): modules can subscribe to what the hearing worker transcribes ([Discovery → Voice](discovery.md#voice)).

**Do:**
- [ ] `hearing.onTranscript(handler)` in the host (`home/bot/src/hearing.ts`, exported in `sdk.ts`), called with each transcript line of a call whose transcripts a module keeps; documented in the bot doc.

**Acceptance:**
- Claude-run: `npm run gate` in `home/bot`; a module subscribed with `onTranscript` receives a transcript line fed through the worker's message path in a local run.
- Human-run: none.
- Reuse: `transcripts.keep`, the worker's transcript messages (`home/bot/src/hearing.ts`).
- Neighbors: `hearing.onTrigger`.
- Forbidden: transcript text reaching any Claude call.

**Touches:** `home/bot/src/hearing.ts`, `home/bot/src/sdk.ts`, `docs/home/bot/explanation/bot.md`

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
**After:** Ask Cari by voice in the Discord call; Let modules hear the call's transcript

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
