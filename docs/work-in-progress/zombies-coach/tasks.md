# Zombies Coach — Tasks

## Move between pages without reloading what is already known

The owner finds that going from a map back to the maps list, and between other pages, refreshes too much (2026-11-15). Navigation is client-side (`history.pushState` in `zombies/site/src/route.ts`), but every page starts in `loading` on mount (`usePage` in `zombies/site/src/App.tsx`), so each move unmounts the page, shows its skeleton and fetches it again, even for a page seen a second ago.

**Do:**
- [ ] Keep each page's last reply in memory, keyed by what it shows (the maps list, a map, an attempt), and render it at once when the reader comes back, refreshing in the background and swapping the new reply in without a skeleton or a jump; the skeleton shows only when nothing is known yet.
- [ ] Use what one page already has to start the next: opening a map from the maps list shows its banner from the list's data while its attempts load; going back to the list shows it straight away.
- [ ] Start fetching a page when the reader points at or presses its link, so it is usually ready by the time it opens.
- [ ] Keep the header (the reader, the "Your attempt" pill) across navigations instead of re-deriving it each time, and restore the list's scroll position on going back.
- [ ] Docs: the loading behaviour in `docs/zombies/site/explanation/site.md` and the States in `docs/zombies/site/reference/design-system.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; through the Playwright MCP with requests delayed 1 s: maps → map → back → map again shows a skeleton only on the first visit to each page, the second visit renders at once and updates in place; a change made by another member (a new attempt) appears after the background refresh; no console error.
- Human-run: the owner moves around the site and it no longer feels like it refreshes on every click.
- Reuse: `usePage` and the skeletons; the attempt page's polling, which already updates in place.
- Neighbors: `dj/panel/src/`, which keeps its state between views.
- Forbidden: showing one member's data to another; stale data that never refreshes; a data-fetching library added only for this when a small in-memory store does.

**Touches:** `zombies/site/src/`, `docs/zombies/site/`

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
