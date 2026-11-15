# Zombies Coach — Tasks

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

## Let the chat's messages and slips use the full width

The owner finds the chat boxes still do not use the full width (2026-11-15): "Use the screen's full width on every page and scroll only the content" wraps messages, sent revisions and hint slips at 52em (the agent's choice recorded in `docs/zombies/site/explanation/site.md`). The owner's call replaces it.

**Do:**
- [ ] Messages, revisions, acknowledgements and hint slips span the transcript's column after the time column, at every width; the composer already does.
- [ ] Replace the "Chat text wraps at 52em" decision with the owner's, dated, and update `docs/zombies/site/reference/design-system.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; through the Playwright MCP at 1920×1080, 1440×900 and 390×844, a long message and a slip reach the column's right edge less its padding; no console error.
- Human-run: the owner sees the chat use the width.
- Reuse: the third take's transcript row.
- Neighbors: none.
- Forbidden: dropping the page's single scroller or any state.

**Touches:** `zombies/site/src/`, `docs/zombies/site/`

## Bring the terminal conversation into the imported Blood of the Dead attempt

The owner expected the imported attempt to hold their messages (2026-11-15). "Import a terminal session as a site run" imported what `session.md` holds (members, marks, rungs, progress, heads-ups), and `session.md` has no conversation; the conversation lives only in Claude Code's transcripts of those sessions, `~/.claude/projects/-home-david-workspace-zombies/*.jsonl` (three sessions), which nothing may delete.

**Do:**
- [ ] In a subagent that reports counts only, extract the players' lines and the coach's replies from those transcripts, in order with their times, leaving out tool calls, research and anything not said to the players.
- [ ] Extend the Claude import (`POST /api/claude/runs` or a sibling route behind `CLAUDE_TOKEN`) to add those lines to an existing attempt as its earlier history, before the imported cards, the coach's replies as Cari's; who typed a terminal line is unknown, so each is attributed as the build decides (recorded as a dated decision).
- [ ] Add them to Blood of the Dead's production attempt `hLzHV-JZ` (with the owner's file, loaded without printing), and check in a subagent that the counts match the transcripts.
- [ ] Docs: the import's history in `docs/zombies/site/explanation/site.md` and the skill's "Move a terminal session to the site".

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; locally on the test map, imported history shows above the cards in order and the coach model's history still reads only what it should; the production attempt's line count matches the subagent's count of player lines and replies.
- Human-run: the owner opens the Blood of the Dead attempt and finds the conversation they had in the terminal.
- Reuse: the importer in `zombies/site/api/_lib/runs.ts` and `scripts/import.ts`.
- Neighbors: the run read (`npm run runs`).
- Forbidden: printing transcript or hint text in the main conversation; deleting or editing the transcripts; tool output or research in the imported lines.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`

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
