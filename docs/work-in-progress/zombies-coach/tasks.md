# Zombies Coach — Tasks

## Point zombies.enbraile.vip at the site and publish the test map

The owner added the DNS-only `CNAME` `zombies` → `0cedcc0080c9a767.vercel-dns-017.com` and set `CLAUDE_TOKEN` in Vercel Production and in the 1Password item "zombies claude token" (2026-11-15); `https://zombies.enbraile.vip/api/maps` answers 401 signed out. What is left is recording that and the first production publish ([Discovery → Anchor Areas](discovery.md#anchor-areas)).

**Do:**
- [ ] Docs: drop "except the DNS record and the Claude token, which wait on the owner" from step 8 of `docs/zombies/site/how-to/run-and-deploy-the-site.md`, and turn `site.md`'s Hosting sentence about the `CNAME` that "is to be" added into the record as it stands.
- [ ] Redeploy production once the rename to `CLAUDE_TOKEN` has landed (`gh workflow run zombies-site.yml --ref main`), so the deployment reads the variable.

**Acceptance:**
- Claude-run: `curl -s -o /dev/null -w '%{http_code}' https://zombies.enbraile.vip/api/maps` prints 401; the redeploy's workflow run ends with a deployment URL; a `PUT /api/claude/maps/test/test` without a token gets 403.
- Human-run: publish the test map with step 9's command, the token from 1Password, and see a second publish print `unchanged`; open `https://zombies.enbraile.vip` signed out (redirects to `enbraile.vip` and back), then signed in, and see the test map.
- Reuse: steps 8 and 9 of `docs/zombies/site/how-to/run-and-deploy-the-site.md`.
- Neighbors: `home/site/`.
- Forbidden: a proxied record; secrets in the repo or printed in the conversation.

**Touches:** `docs/zombies/site/how-to/run-and-deploy-the-site.md`, `docs/zombies/site/explanation/site.md`

## Review the site's frontend for UX, loading states and glitches

The owner wants the site to feel good to use before the group plays on it (2026-11-15): every screen has a proper loading, empty and error state, and nothing odd happens in the browser. Review what is built so far in `zombies/site/src/` against the boards and fix what falls short.

**Do:**
- [ ] Walk every built screen (maps, Start a run, join, the run page with Cari's hint slips and "more") through the Playwright MCP at desktop 1440×900 and phone 390×844, with two local members, on a normal and a throttled network.
- [ ] Run the walk against the real Haiku at least once: the coach pass that built Cari ran only against a scripted mock, so whether `COACH_MODEL` accepts the request as sent (`output_config.effort`, refusal details) and how its words read are unchecked. The key comes from an `ANTHROPIC_API_KEY=` line the owner puts in the main tree's gitignored `zombies/site/.env.local`; copy it into the worktree's without printing it, and if it is absent, say so in the report.
- [ ] Each fetch, post and poll has a loading state drawn in the boards' language (no blank screen, no spinner the boards do not use), an empty state, and an error state that says what failed and lets the reader retry.
- [ ] Nothing weird: no console errors or warnings, no layout shift as data arrives, no flash of signed-out or empty content, no double submit on a slow click, no message duplicated or reordered by the 2 s poll, no scroll jump in the transcript when a line arrives, focus and keyboard order that make sense, touch targets of 44 px, and the phone layout without horizontal scroll.
- [ ] Take the "Radio log" tag out of the header, leaving the wordmark, the language switch and the name chip (owner, 2026-11-15), and out of the frozen boards in `zombies/site/design/` and the design-system doc's header.
- [ ] Spacing done properly on every screen at both widths: one spacing scale from the design system, consistent gutters, paddings and gaps between like elements, aligned edges and baselines, nothing cramped or floating; written into the design-system doc where it was not.
- [ ] Fix what the walk finds in `zombies/site/src/`; a state the boards do not draw follows the design system's tokens and components, and is added to `docs/zombies/site/reference/design-system.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; the walk above repeated after the fixes with no console error or warning, each screen's loading, empty and error state seen at both widths (the error by stopping the local API), and the report listing every issue found with its fix.
- Human-run: the owner and a friend use the site on phones on `zombies.enbraile.vip` and nothing feels off.
- Reuse: the boards in `zombies/site/design/`; `docs/zombies/site/reference/design-system.md`; the `verify-site` skill's way of driving a local stack, as a pattern.
- Neighbors: `pkmn/site/src/` for loading and error states already in the group's apps.
- Forbidden: new features or screens; changing what a screen does rather than how it feels; step or hint numbers in the UI.

**Touches:** `zombies/site/src/`, `zombies/site/index.html`, `zombies/site/design/`, `docs/zombies/site/reference/design-system.md`
**After:** Point zombies.enbraile.vip at the site and publish the test map

## Follow progress and threads the way ee-coach does

Progress reports, open threads and the session rules that need run state: `On success` plus an L1 in the same reply, the players' order over the dossier's, `Requires`, optional steps never offered (and the one heads-up once they sink time), blocked threads silent until asked then a ladder at the blocker, part ladders, false-block checks, asking the round now and then, single-use resource heads-ups and retries ([Discovery → Architecture](discovery.md#architecture)).

**Do:**
- [ ] A progress tool; open threads kept on the run, never shown; code chooses the L1 candidates whose `Requires` are met and never an optional step.
- [ ] A run stays open: closing a run is not built yet, and a run never ends by itself on its last required step; when closing is built, a run ends only when the players say so and confirm (owner, 2026-11-15). Record both as dated decisions in `docs/zombies/site/explanation/site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; through the Playwright MCP on the test map, report a step done and get its `On success` and an L1 for a different met step in one reply; start an optional step and see it followed, never offered; reach a blocked step and see no hint until asked.
- Human-run: a test-map run on phones walks one blocked and one optional step.
- Reuse: the run state and tools of the previous entry; "Players choose the order" in the ee-coach skill.
- Neighbors: the hint tools of "Start a run and get prepared hints from Cari in a shared chat".
- Forbidden: listing threads to players; naming what a blocked step lacks before its ladder does; a way to close or end a run.

**Touches:** `zombies/site/`, `docs/zombies/site/`

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
**After:** Follow progress and threads the way ee-coach does

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

## Ask Cari by voice in the Discord call

A `zombies` module in the bot: the site's offer and `/cari` bring Cari into the run's voice channel; «cari …» goes to the site's API as the speaker and the answer is spoken and posted in the chat ([Discovery → Voice](discovery.md#voice)).

**Do:**
- [ ] `zombies/bot/` module listed in `home/bot/src/modules.ts`: `/cari`, a `/zombies/join` route the site calls, `voice.hold("zombies", channel, { listen: true })`, `hearing.onTrigger("cari", …)`, `hearing.say`.
- [ ] Site: `POST /api/voice` behind `INTERNAL_SECRET` (Discord ID + text → the speaker's run → reply), the join offer when a member is in a channel; `BOT_URL` and `INTERNAL_SECRET` in Vercel, `INTERNAL_SECRET` from the cluster's `discord-bot-enbraile` secret; never let the value appear in the conversation or a command line: pipe it as `kubectl -n dj get secret discord-bot-enbraile -o jsonpath='{.data.INTERNAL_SECRET}' | base64 -d | npx vercel env add INTERNAL_SECRET production` (owner, 2026-11-15).
- [ ] Build it into the host as `dj/bot` is: `home/bot/tsconfig.json`'s `include`, the `COPY` lines of `home/bot/Dockerfile`, and the `paths` of `.github/workflows/home-bot.yml`.
- [ ] Docs: `docs/zombies/bot/explanation/bot.md`, the bot doc's module list.

**Acceptance:**
- Claude-run: `npm run gate` in `home/bot` and `zombies/site`; a local bot against the local site answers a fake trigger with the run's reply.
- Human-run: in a call, bring Cari in from the site, say «cari, una pista», hear the hint and see it in the chat; stop the bot and the site still answers typed questions.
- Reuse: `voice.hold`, `hearing.onTrigger`, `hearing.say` (`home/bot/src/sdk.ts`); the DJ's join (`dj/bot/src/player.ts`).
- Neighbors: `dj/bot/`.
- Forbidden: Claude calls from the bot; run state in the bot's SQLite.

**Touches:** `zombies/bot/`, `home/bot/src/modules.ts`, `home/bot/tsconfig.json`, `home/bot/Dockerfile`, `.github/workflows/home-bot.yml`, `zombies/site/`, `docs/zombies/`, `docs/home/bot/explanation/bot.md`
**After:** Follow progress and threads the way ee-coach does

## Keep the call's transcript in the run

While Cari is in the call for a run, what is said there goes into the run for the watch loop and debriefs ([Discovery → Voice](discovery.md#voice)).

**Do:**
- [ ] `hearing.onTranscript(handler)` in the host (`home/bot/src/hearing.ts`, exported in `sdk.ts`), documented in the bot doc.
- [ ] The module asks `transcripts.keep("zombies", true)` while in a run's call and forwards lines to `POST /api/voice/transcript`; the run stores them; `watch` and the Claude read show them.

**Acceptance:**
- Claude-run: `npm run gate` in both; a fake transcript reaches the run in a local pair.
- Human-run: talk in the call during a run and see the lines in the Claude read, and that the coach model got only the «cari» requests (call log).
- Reuse: `transcripts.keep`, the worker's transcript messages (`home/bot/src/hearing.ts`).
- Neighbors: `onTrigger`.
- Forbidden: transcript text in the coach model's prompt.

**Touches:** `home/bot/src/hearing.ts`, `home/bot/src/sdk.ts`, `zombies/bot/`, `zombies/site/`, `docs/home/bot/explanation/bot.md`, `docs/zombies/`
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
