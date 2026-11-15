# Zombies Coach — Tasks

## Point zombies.enbraile.vip at the site and publish the test map

The Vercel project, its Neon database, the workflow and the root's `trustedOrigins` are in place; what is left is the domain's DNS record, the admin token and the first production publish, so a signed-in member opens `zombies.enbraile.vip` and sees the published test map ([Discovery → Anchor Areas](discovery.md#anchor-areas)).

**Do:**
- [ ] `zombies.enbraile.vip` as a DNS-only CNAME to `0cedcc0080c9a767.vercel-dns-017.com` (`npx vercel api /v6/domains/zombies.enbraile.vip/config`, `recommendedCNAME`) in the Cloudflare `enbraile.vip` zone.
- [ ] `ZOMBIES_ADMIN_TOKEN` generated in 1Password and set in Vercel Production with the commands in step 8 of `docs/zombies/site/how-to/run-and-deploy-the-site.md`; never let the value appear in the conversation or a command line.
- [ ] Publish the test map to production with step 9's command (`ZOMBIES_URL=https://zombies.enbraile.vip npm run publish -- test-map`, the token read from 1Password).
- [ ] Docs: drop "except the DNS record and the admin token, which wait on the owner" from step 8 of the how-to, and turn `site.md`'s Hosting sentence "is to be a DNS-only (grey-cloud) `CNAME` … until the owner adds that record the name does not resolve" into the record as it stands.

**Acceptance:**
- Claude-run: `curl -s https://zombies.enbraile.vip/api/maps` answers 401 signed out; a second production publish prints `unchanged`; the first push to `main` touching `zombies/site/` runs `zombies-site.yml` to a deployment URL.
- Human-run: open `https://zombies.enbraile.vip` signed out (redirects to `enbraile.vip` and back), then signed in, and see the test map; the 1Password item holds `ZOMBIES_ADMIN_TOKEN`.
- Reuse: steps 8 and 9 of `docs/zombies/site/how-to/run-and-deploy-the-site.md`.
- Neighbors: `home/site/`.
- Forbidden: a proxied record; secrets in the repo or printed in the conversation.

**Touches:** `docs/zombies/site/how-to/run-and-deploy-the-site.md`, `docs/zombies/site/explanation/site.md`
**Needs the author:**
- Add the DNS-only CNAME `zombies` → `0cedcc0080c9a767.vercel-dns-017.com` in Cloudflare's `enbraile.vip` zone yourself, or give agents a Cloudflare API token limited to DNS edit on that zone? Agents have no access to it today.
- Create the 1Password item "zombies admin token" and set Vercel's Production `ZOMBIES_ADMIN_TOKEN` with step 8's commands (agents have no 1Password session). Then publish the test map yourself with step 9, or unlock 1Password for an agent run?

## Decide how two members sign in to the local site

"Start a run…" asks for two signed-in browsers as two members of one run, with one active run per person, but locally every request is the same person: `zombies/site/api/_lib/viewer.ts:5-6` returns one fixed `DEV_USER_ID` viewer, and without it the root's session cookie is set on `enbraile.vip` (`home/site/api/_lib/auth.ts:25`), which a `localhost` browser (or a `vercel.app` preview) never carries. pkmn's test players (`pkmn/site/api/_lib/dev-sign-in.ts`) live in its own auth tables, which the zombies site may not have ([Discovery → Data and storage](discovery.md#data-and-storage)).

**Needs the author:**
- How does a Claude-run check act as two different members: a second local identity on the zombies site's dev sign-in, or the two-browser check run against `zombies.enbraile.vip` with two real accounts?

**Acceptance:**
- Claude-run: the answer recorded as a dated decision in `docs/zombies/site/explanation/site.md`; the Claude-run line of "Start a run and get prepared hints from Cari in a shared chat" matches it.
- Human-run: none.
- Reuse: none.
- Neighbors: `dj/panel/api/_lib/app.ts`, which has the same single `DEV_USER_ID`.
- Forbidden: a sign-in path that works in production without the root session; auth tables in the zombies database.

**Touches:** `docs/zombies/site/explanation/site.md`

## Start a run and get prepared hints from Cari in a shared chat

Members start or join a run on a map and talk to Cari; Haiku answers through tools, delivering only prepared rungs that code allows ([Discovery → Architecture](discovery.md#architecture)).

**Do:**
- [ ] Runs, members (one active run per person), chat messages, the run's knowledge marks (baseline plus what the same people learned in earlier runs) and language (Spanish by default).
- [ ] The coach on the function: `ANTHROPIC_API_KEY`, `COACH_MODEL` (default `claude-haiku-5-5`), a system prompt distilled from ee-coach's session rules, tools to give a rung (the next one, or its Alt), mark something known and ask the round; code offers only rungs whose `Mentions` are known or meant to be revealed, one rung at a time, and updates marks on delivery.
- [ ] Hint cards with "more" and no numbers; the asker's reply streams, others poll every 2 s.
- [ ] Each Claude call's model, tokens, latency and refusals stored on the run.

**Acceptance:**
- Claude-run: `npm run gate`; through the Playwright MCP with the test map, two signed-in browsers join one run; one asks for a hint, both see the card; "more" gives the next rung; a rung mentioning an unknown thing is never delivered before the rung meant to reveal it (read back from the stored log); `grep` finds no step or rung number rendered.
- Claude-run (setup): set Vercel's `COACH_MODEL`, and `ANTHROPIC_API_KEY` from the cluster's `discord-bot-enbraile` secret; never let the value appear in the conversation or a command line: pipe it as `kubectl -n dj get secret discord-bot-enbraile -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 -d | npx vercel env add ANTHROPIC_API_KEY production` (owner, 2026-11-15).
- Human-run: two people on phones join a test-map run and ask for hints.
- Reuse: the `Anthropic` SDK as in `home/bot/src/claude.ts` (tool loop shape), but on Vercel; the hint-delivery rules in `.claude/skills/ee-coach/SKILL.md` and `references/hint-craft.md`.
- Neighbors: the DJ panel's streaming-less polling fallback (`dj/panel/src/`).
- Forbidden: the dossier or unknown entries in the model's prompt; the model writing hint text; step or hint numbers in the UI.

**Touches:** `zombies/site/`, `docs/zombies/`
**After:** Decide how two members sign in to the local site

## Decide how a run ends

A run ends only when the players say so, and is not closed until they confirm; it never ends by itself on its last required step (owner, 2026-11-15).

**Needs the author:**
- What do members see once a run has ended (a debrief prompt, the run read-only)? And can a finished run be reopened?

**Acceptance:**
- Claude-run: the answers recorded as dated decisions in `docs/zombies/site/explanation/site.md`.
- Human-run: none.
- Reuse: none.
- Neighbors: none.
- Forbidden: building an ending before this is answered.

**Touches:** `docs/zombies/site/explanation/site.md`

## Follow progress and threads the way ee-coach does

Progress reports, open threads and the session rules that need run state: `On success` plus an L1 in the same reply, the players' order over the dossier's, `Requires`, optional steps never offered (and the one heads-up once they sink time), blocked threads silent until asked then a ladder at the blocker, part ladders, false-block checks, asking the round now and then, single-use resource heads-ups, retries, and the run's ending ([Discovery → Architecture](discovery.md#architecture)).

**Do:**
- [ ] A progress tool; open threads kept on the run, never shown; code chooses the L1 candidates whose `Requires` are met and never an optional step.
- [ ] The run ends only when the players say so, after they confirm, never by itself on its last required step (owner, 2026-11-15, recorded under "Decide how a run ends"); record it as a dated decision in `docs/zombies/site/explanation/site.md`. What members see afterwards and reopening stay with that entry.

**Acceptance:**
- Claude-run: `npm run gate`; through the Playwright MCP on the test map, report a step done and get its `On success` and an L1 for a different met step in one reply; start an optional step and see it followed, never offered; reach a blocked step and see no hint until asked.
- Human-run: a test-map run on phones walks one blocked and one optional step.
- Reuse: the run state and tools of the previous entry; "Players choose the order" in the ee-coach skill.
- Neighbors: the hint tools of "Start a run and get prepared hints from Cari in a shared chat".
- Forbidden: listing threads to players; naming what a blocked step lacks before its ladder does.

**Touches:** `zombies/site/`, `docs/zombies/site/`
**After:** Start a run and get prepared hints from Cari in a shared chat

## Prepare publishes Haiku-ready bundles, starting with Blood of the Dead

ee-coach's prepare writes the structured data the live coach needs and publishes it; Blood of the Dead is the first real bundle ([Discovery → Data and storage](discovery.md#data-and-storage)).

**Do:**
- [ ] Extend `references/research.md` and `SKILL.md`: every step, rung, Alt, part ladder, `Mentions`, condition and heads-up in a form the bundle schema takes; Spanish wording translated once; card text never carries numbers.
- [ ] `npm run compile -- <map dir>` (in `zombies/site/scripts/`) builds the bundle from a map's files and checks it against the schema (every `Mentions` names a knowledge entry, every `Requires` a step); `publish` sends it.
- [ ] Compile and publish Blood of the Dead, in a subagent so no solution reaches the terminal.
- [ ] Docs: `compile` in `docs/zombies/site/how-to/run-and-deploy-the-site.md`, and `site.md`'s "as the queue's `compile` will write its bundle there" made true of the shipped command.

**Acceptance:**
- Claude-run: `npm run gate`; `compile` on Blood of the Dead exits 0; publishing it adds a version; the bundle's ladder count matches `hints.md`'s, checked in a subagent.
- Human-run: start a Blood of the Dead run on the site and ask for a hint at a point you already passed; the card's wording matches `hints.es.md`.
- Reuse: the bundle schema in `zombies/site/shared/`; the existing map files.
- Neighbors: the test map bundle.
- Forbidden: map content in tracked files; solutions printed in the main conversation.

**Touches:** `.claude/skills/ee-coach/`, `zombies/site/scripts/`, `zombies/site/shared/`, `zombies/site/package.json`, `docs/zombies/site/`

## Hold on gaps and take REVISION and card feedback

When no prepared line fits, Cari holds and the run records a gap; `REVISION:` messages and card feedback are stored with the line they refer to and never go to the model as gameplay ([Discovery → Feedback and the watch loop](discovery.md#feedback-and-the-watch-loop)).

**Do:**
- [ ] A hold tool with prepared in-voice non-answers per language; a gap record with the context.
- [ ] `REVISION:` detection (and wherever the boards put feedback) acknowledged briefly; feedback controls on cards; both logged on the run.
- [ ] `GET /api/admin/runs/<id>` behind `ZOMBIES_ADMIN_TOKEN` returns the run's log, gaps, feedback and marks for debriefs; the ee-coach debrief reads it.

**Acceptance:**
- Claude-run: `npm run gate`; through the Playwright MCP, a question the test map has no line for gets a hold and a gap; a `REVISION:` message gets an acknowledgement and no model call (read from the call log); card feedback appears in the admin read.
- Human-run: send a `REVISION:` from a phone; in Claude Code, run the debrief and see it.
- Reuse: the call log and run state of earlier entries.
- Neighbors: the hint tools.
- Forbidden: an improvised hint; a `REVISION:` reaching the coach model.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/site/`
**After:** Follow progress and threads the way ee-coach does

## Continue the Blood of the Dead session on the site

Import the terminal session into a run so the group continues it on the site, then retire the old workspace ([Discovery → Migration](discovery.md#migration)).

**Do:**
- [ ] An admin import of a run from a map's `session.md` and `knowledge.md` (members, marks, hints given, open threads), in a subagent.
- [ ] Delete `~/workspace/zombies/` after the owner confirms the run reads right on the site.

**Acceptance:**
- Claude-run: `npm run gate`; the imported run's revealed marks and hint log match `session.md` and `knowledge.md` (checked in a subagent, reporting counts only).
- Human-run: open the imported run, ask for the next hint, and get what the terminal would have given; confirm deleting the old folder.
- Reuse: the admin API and bundle of earlier entries.
- Neighbors: the publish script.
- Forbidden: deleting the old workspace before the owner's yes.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`
**After:** Prepare publishes Haiku-ready bundles, starting with Blood of the Dead; Hold on gaps and take REVISION and card feedback

## Watch a run from Claude Code and fix things live

A `watch` stream on the admin API and a skill section so Claude follows a run while it is played: closing gaps with a checked line, applying revisions and card feedback, and fixing the dossier when players report something it contradicts, all in subagents, the terminal showing spoiler-free one-liners ([Discovery → Feedback and the watch loop](discovery.md#feedback-and-the-watch-loop)).

**Do:**
- [ ] `GET /api/admin/runs/<id>/events?after=` and `npm run watch -- <run>` printing one line per event, for `Monitor`.
- [ ] A "Watch" section in the ee-coach skill: per event type, what to do, which subagent, publish, and what one line to print.
- [ ] A held gap is answered on the run's next message, or posted at once if the run is waiting, once the new version lands.

**Acceptance:**
- Claude-run: `npm run gate`; with a test-map run open in the Playwright MCP, a gap appears in `watch`, a new line is published and the run delivers it; a revision changes a rung and the next delivery uses it.
- Human-run: on a game night, run the watch from Claude Code, send a `REVISION:` and see it applied without leaving the game.
- Reuse: the admin API, `compile` and `publish`.
- Neighbors: the debrief in the ee-coach skill.
- Forbidden: solutions or rung text printed in the main conversation.

**Touches:** `zombies/site/`, `.claude/skills/ee-coach/`, `docs/zombies/`
**After:** Continue the Blood of the Dead session on the site

## Audit every reply and step in as Cari

The watch loop checks each live reply against the rules and Claude can post into a run as Cari when Haiku is lost ([Discovery → Feedback and the watch loop](discovery.md#feedback-and-the-watch-loop)).

**Do:**
- [ ] Code-side checks recorded on each reply (an unknown named, a rung skipped, an optional offered, a number shown), surfaced in `watch`; the skill's audit of what code cannot judge.
- [ ] `POST /api/admin/runs/<id>/say` behind `ZOMBIES_ADMIN_TOKEN` posting as Cari, logged as from Claude Code.

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
- [ ] The module asks `transcripts.keep("zombies", true)` while in a run's call and forwards lines to `POST /api/voice/transcript`; the run stores them; `watch` and the admin read show them.

**Acceptance:**
- Claude-run: `npm run gate` in both; a fake transcript reaches the run in a local pair.
- Human-run: talk in the call during a run and see the lines in the admin read, and that the coach model got only the «cari» requests (call log).
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
