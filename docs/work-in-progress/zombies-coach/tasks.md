# Zombies Coach — Tasks

## Say the coach is busy instead of dropping a line

When another reply holds the run's lease past the 30 s wait, `coachTurn` returns `"ok"` with no event (`zombies/site/api/_lib/coach.ts:760`), so the asker's stream ends empty and the page looks exactly like a coach choosing silence: the line is posted and never answered ([The Zombies Site → The Coach](../../zombies/site/explanation/site.md#the-coach)). Found reading the code, 2026-11-17.

**Do:**
- [ ] Return `"busy"` from `coachTurn` when `acquire` gives no lease, and have the messages and More routes in `api/_lib/app.ts` send a `busy` event for it.
- [ ] On the run page, a `busy` stream sets the trouble line ("<coach> was answering someone else; ask again") with the existing retry, worded in both languages in `src/i18n.ts`.
- [ ] The voice route keeps its "say that again" line for this case; check `api/_lib/voice.ts` still says it.
- [ ] Update The Coach and the "One reply at a time per run" decision in `site.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`. Locally, with `leaseWaitMs` temporarily lowered, two members' lines posted together on the test map: the second gets the busy line and its retry posts again; the temporary change is reverted before commit.
- Human-run: none.
- Reuse: the `Trouble` notice and `listen` in `src/RunPage.tsx`, `acquire` in `coach.ts`.
- Neighbors: the `failed` event and its "did not answer" line.
- Forbidden: a second lease mechanism; a typed line answered silently.

**Touches:** `zombies/site/api/_lib/coach.ts`, `zombies/site/api/_lib/app.ts`, `zombies/site/src/RunPage.tsx`, `zombies/site/src/i18n.ts`, `docs/zombies/site/explanation/site.md`

## Bound the coach's Claude call

`new Anthropic()` (`zombies/site/api/_lib/coach.ts:131`) runs with the SDK's defaults, a 10-minute timeout and 2 retries, so one hung call holds the run's 60 s lease and the next member's line waits behind it, while a reply's first words normally come in about 1 s ([Decisions](../../zombies/site/explanation/site.md#decisions), "Reasoning off, measured"). Found reading the code, 2026-11-17.

**Do:**
- [ ] Give the client a request timeout and retry count that fit a live reply (about 15 s, one retry), the progress check's call included, as named constants beside `leaseMs`.
- [ ] Check the lease (60 s) still covers the worst turn, `maxSteps` calls at that timeout; if it does not, say in `site.md` which wins and why.
- [ ] Record the values and why in The Coach and a dated decision in `site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; locally with the timeout set to 1 ms a line ends in the `failed` event and its retry, and the lease is released (a second line right after is answered).
- Human-run: none.
- Reuse: the existing `failed` path in `api/_lib/app.ts`.
- Neighbors: `AbortSignal.timeout` in `api/_lib/bot.ts`.
- Forbidden: a timeout shorter than the measured maximum reply in `site.md`.

**Touches:** `zombies/site/api/_lib/coach.ts`, `docs/zombies/site/explanation/site.md`

## Close and reopen an attempt

Any member closes the attempt from its rail (the phone's strip) after a confirm; it becomes read-only, every member is released, the coach answers nothing, and it stays on its map's list marked closed; any member of it reopens it ([Decisions](../../zombies/site/explanation/site.md#decisions), "A closed attempt is read-only and can be reopened").

**Do:**
- [ ] A Drizzle migration adding `closed_at` and `closed_by` to `runs`.
- [ ] `POST /api/runs/<id>/close` (member only): under the run's coach lease, sets them and marks every open `run_members` row left. `POST /api/runs/<id>/reopen` (anyone who was ever a member) clears them and joins the reader, leaving their current attempt as join does.
- [ ] Refuse on a closed run: posting a line, More, rating, voice change, join, voice join, `/api/voice` (the speaker is in no run then, so it gets `done`), Claude's `say`; `GET` routes still answer.
- [ ] The run page: a Close attempt control with a confirm, a closed attempt shown as its log without composer, More or ratings, and Reopen; the map view's list and the maps page's counts mark it closed; the watch stream gets `closed` and `reopened` events, `npm run runs` carries the fields.
- [ ] Mock the control and the closed state as boards in `zombies/site/design/` first, in the third take's look, and add them to the design-system doc.
- [ ] Rewrite Attempts and the closing decisions in `site.md`, and the how-to if a command changed.

**Acceptance:**
- Claude-run: `npm run gate`; through the `verify-site`-style local stack with two dev members on the test map: close from one, the other's next poll shows it closed and its composer gone, a line post answers 403/409, the map view marks it, reopen from the other and both can play again; `watch` prints the two events.
- Human-run: on production, close the group's attempt after a night and reopen it.
- Reuse: `joinRun`'s leave-the-current-attempt path in `api/_lib/runs.ts`, `acquire`/`release` in `coach.ts`.
- Neighbors: `delete-run`'s locking under the coach lease.
- Forbidden: deleting anything on close; closing without a confirm; a closed run counted as "someone is in it".

**Touches:** `zombies/site/drizzle/`, `zombies/site/api/_lib/`, `zombies/site/src/`, `zombies/site/shared/runs.ts`, `zombies/site/scripts/watch.ts`, `zombies/site/design/`, `docs/zombies/site/`

## Design the roadmap tree

The attempt gets a tree of its done steps, branched by `requires`, revealed whole once beaten ([Decisions](../../zombies/site/explanation/site.md#decisions), "A roadmap of done steps only"). The owner wants it visually interesting, and does not review boards beforehand ([Discovery → Runs and the site](discovery.md#runs-and-the-site)). It must reveal nothing not done: no empty slots, no count, no open-thread marker, and its shape may follow only edges between done steps.

**Do:**
- [ ] Draw it with Claude design as boards in `zombies/site/design/`, in the third take's warm dark look with the slips and survey-sheet identity: where it lives in the rail and on a phone, a node lighting up when a step is recorded (who reported it, when), optional steps as side trails, a node whose label is withheld, the beaten reveal, and a closed attempt's tree. Use the made-up Harrow Station steps only.
- [ ] Add the tree's components and motion to `docs/zombies/site/reference/design-system.md`.

**Acceptance:**
- Claude-run: the boards open in a browser; the design-system doc names each component; no real map's text in any tracked file.
- Human-run: none (the owner sees it built, by his choice).
- Reuse: the third take's tokens and slip components in the design system.
- Neighbors: the `run-zone` boards.
- Forbidden: a node, outline or counter for a step not done before beaten; step or hint numbers.

**Touches:** `zombies/site/design/`, `docs/zombies/site/reference/design-system.md`

## Prepare a milestone label for every step

Each step gets a short label per language naming what was achieved, shown on its roadmap node ([Decisions](../../zombies/site/explanation/site.md#decisions), "A roadmap of done steps only").

**Do:**
- [ ] In the ee-coach skill's `references/research.md` and `hint-craft.md`: a `- Milestone: <a few words> Mentions: …` line per step in `hints.md` and `hints.es.md`, naming only what the players know once the step is done, never a hint toward the next; blind-checked with the hints.
- [ ] `compile` reads it as a line (both languages, `mentions`), warns on a step without one; `shared/bundle.ts` takes `milestone` as optional on a step and checks its mentions like any line.
- [ ] Give the test map's steps their milestones in `zombies/site/test-map/`.
- [ ] In a subagent that returns only `compile`'s output, write Blood of the Dead's milestones, blind-check them, compile and publish to production.
- [ ] Update Map Bundles in `site.md` and the research reference.

**Acceptance:**
- Claude-run: `npm run gate`; `npm run compile` on the test map and Blood of the Dead with no milestone warning; no real map's text in the conversation or a tracked file.
- Human-run: none.
- Reuse: `parseLine` and the line pairing in `scripts/compile.ts`, `checkLine` in `shared/bundle.ts`.
- Neighbors: the `On success` line.
- Forbidden: labels generated at runtime by the model.

**Touches:** `.claude/skills/ee-coach/references/`, `zombies/site/scripts/compile.ts`, `zombies/site/shared/bundle.ts`, `zombies/site/test-map/`, `docs/zombies/site/explanation/site.md`
**After:** Design the roadmap tree

## Show the attempt's roadmap of done steps

Build the boards' tree on the run page from what `run_steps` records done ([Decisions](../../zombies/site/explanation/site.md#decisions), "A roadmap of done steps only").

**Do:**
- [ ] The run's poll and `/api/runs/<id>` carry `roadmap`: for each step recorded done (whole step, not parts), its ID-free node key, its milestone in the run's language (withheld when it mentions an unknown entry), when and by whose line it was recorded, whether it is optional, and edges only between done steps from `requires`. Nothing about any step not done.
- [ ] Draw it as the boards do, a node appearing with its motion on the poll that brings it.
- [ ] Rewrite "Progress kept in `run_steps`, never shown" and add a Roadmap section to `site.md`, saying exactly which fields reach the browser.

**Acceptance:**
- Claude-run: `npm run gate`; on the local stack with the test map, step-ins recording steps done make nodes appear on both members' pages; a context-free subagent reads the `roadmap` field of a reply mid-run and confirms it names no step not done.
- Human-run: on a game night, the group says whether the tree matches what they did, and corrects a missing step with a revision.
- Reuse: `run_steps`, the knowledge check the coach uses for unknown names (`namedIn`).
- Neighbors: the pinned slip in `src/RunPage.tsx`.
- Forbidden: a step not done, its count or its handle in any browser reply.

**Touches:** `zombies/site/api/_lib/`, `zombies/site/shared/runs.ts`, `zombies/site/src/`, `docs/zombies/site/explanation/site.md`
**After:** Prepare a milestone label for every step

## Reveal the whole tree once an attempt is beaten

Once beaten, the roadmap shows every step, the optional ones not done dimmed, as the boards draw the reveal; a label still mentioning an unknown entry stays withheld.

**Do:**
- [ ] Add the not-done steps to `roadmap` only when the attempt is beaten, and draw the reveal.
- [ ] Say so in the Roadmap section of `site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; on the test map, recording the last required step done reveals the rest on both pages.
- Human-run: none.
- Reuse: the beaten query in `api/_lib/maps.ts`.
- Neighbors: the roadmap above.
- Forbidden: any not-done step in a reply before beaten.

**Touches:** `zombies/site/api/_lib/`, `zombies/site/src/`, `docs/zombies/site/explanation/site.md`
**After:** Show the attempt's roadmap of done steps

## Show who the coach is answering

A member does not see that the coach is answering someone else, so their own line seems ignored. The poll carries the run's lease holder while a reply runs, and every member's page shows "<coach> is answering <name>…" in the transmitting row's style.

**Do:**
- [ ] Store who took the lease beside `coach_busy_until`, return it on the poll while the lease is live, show it on the page, and say so in Attempts in `site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; two dev members, one asks, the other's page shows the line within one poll and loses it when the reply lands.
- Human-run: none.
- Reuse: the lease row in `coach.ts`, the transmitting row in `src/RunPage.tsx`.
- Neighbors: "Say the coach is busy instead of dropping a line".
- Forbidden: a new table.

**Touches:** `zombies/site/api/_lib/`, `zombies/site/src/`, `zombies/site/drizzle/`, `docs/zombies/site/explanation/site.md`
**After:** Say the coach is busy instead of dropping a line

## Ride out a dropped poll

One failed poll sets `lost` and shows the failure notice (`zombies/site/src/RunPage.tsx` `poll`), so a phone on a patchy network flickers it during play. Show it only after three polls in a row fail, and back off to 5 s while lost.

**Do:**
- [ ] Count consecutive failures in `poll`, show the notice from the third, back off while lost, and say so in Attempts in `site.md`.

**Acceptance:**
- Claude-run: `npm run gate`; with the dev API stopped for 3 s the page shows nothing, for 10 s it shows the notice, and restarting it clears it.
- Human-run: none.
- Reuse: the existing `lost` notice and retry.
- Neighbors: the voice offer's poll cadence in the same file.
- Forbidden: hiding a signed-out or 403 reply behind the count.

**Touches:** `zombies/site/src/RunPage.tsx`, `docs/zombies/site/explanation/site.md`

## Time the bot's names lookup in production and set its limit

The site's names lookup gives the bot 10 s for Discord's forced member fetches (`lookupMs` in `zombies/site/api/_lib/names.ts`), while a reply waits at most 1.5 s; the 10 s is a starting value, since the fetches could not be timed without the real bot ([The Zombies Site → Decisions](../../zombies/site/explanation/site.md#decisions), "Names never go back to stored ones on an open page"). Each lookup logs `bot names` with its count of IDs, its time in ms and whether the bot answered.

**Do:**
- [ ] After a deploy and a game night, read the `bot names` lines from the production site's logs (Vercel) and note the times by count of IDs, the slowest included.
- [ ] Set `lookupMs` from them with headroom, and decide from the same figures whether the 1.5 s a reply waits still fits; record the figures and the values in the names paragraph and that decision in `docs/zombies/site/explanation/site.md`.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; the doc quotes the measured times and the values set from them.
- Human-run: none.
- Reuse: the `bot names` log line.
- Neighbors: none.
- Forbidden: guessing the limit without the log; a page that waits on the bot longer than it does now.

**Touches:** `zombies/site/api/_lib/names.ts`, `docs/zombies/site/explanation/site.md`

## Decide whether hints get each voice's own wording

**Needs the author:**
- Should prepared hints also get a wording per character (Richtofen's version of every rung, written and blind-checked at prepare like the hints are, roughly doubling a map's prepare work), or do hints stay in one plain wording while only the coach's own words take the character?

**Acceptance:**
- Claude-run: the answer recorded as a dated decision in `docs/zombies/site/explanation/site.md`.
- Human-run: none.
- Reuse: none.
- Neighbors: "Let the coach speak in the character of its voice".
- Forbidden: building per-voice hint wordings before this is answered.

**Touches:** `docs/zombies/site/explanation/site.md`

## Measure a signed-in production load

Every production figure in `docs/zombies/site/explanation/site.md` was taken signed out or on a preview. `:139` says the owner's `Server-Timing` split (cold and warm), the zombies database's Neon wake and the session read in pkmn's database "are still not measured". `:152` says production after the bundled function "is not measured". `:226` leaves the `pg`-versus-serverless-driver choice to "the `Server-Timing` figures from a signed-in production load". `docs/home/site/explanation/site.md`'s Load Time table still reads "not deployed yet" for the root's bundled `/api/me`, though a2803a1 is on `origin/main` and has deployed.

**Do:**
- [ ] Measure production with the owner's session: `/api/maps`, `/api/maps/<game>/<map>` and `/api/runs/<id>`, cold (after 10 idle minutes) and warm, each with its `Server-Timing` split. Also measure the root's `/api/me` cold and warm.
- [ ] Put the figures in both Load Time sections, with the date and how they were taken. Remove the "not measured" and "not deployed yet" lines.
- [ ] Revisit the `pg` decision as `:226` says. If the figures leave one workable option, record it as forced by evidence. Otherwise keep the decision and say why.

**Acceptance:**
- Claude-run: the figures and their method are in both docs. `grep -n 'not measured\|not deployed yet' docs/zombies/site/explanation/site.md docs/home/site/explanation/site.md` finds nothing.
- Human-run: the owner, signed in, gives the session to the measuring browser (the Playwright MCP browser signed in through Discord, or their own browser's network panel copying each reply's `Server-Timing`), after the idle waits.
- Reuse: the method in `site.md`'s Load Time (`curl -sD - -o /dev/null` with the reader's cookie, Paris edge, 10 idle minutes).
- Neighbors: the Load Time tables already in both docs.
- Forbidden: the session cookie printed in the conversation, a command line or a doc; figures from a preview presented as production.

**Touches:** `docs/zombies/site/explanation/site.md`, `docs/home/site/explanation/site.md`

## Play a game night on the site and read how the coach did

The discovery's goal is a game night played from the site and voice with no terminal needed, every hint coming from prepared, checked lines, and Haiku "to start; the group will report whether it is enough" ([Discovery → Goal](discovery.md#goal), [Architecture](discovery.md#architecture)). None of it has been measured. The three Blood of the Dead runs on file are imports. Their reads hold no Claude call, no gap, no feedback and no audit finding. No watch events file exists, so the watch loop has never followed a real attempt. Blood of the Dead's local bundle now holds 58 zones and its survey image, and the zones entry's human check (is a zone readable mid-round) was never run. A replay of a recorded run (2026-11-16, [The Zombies Site → Decisions](../../zombies/site/explanation/site.md#decisions)) measured reply latency and judged spoilers offline, but not a live night: so nothing shows whether Haiku keeps to the rules on a real map (how often code drops a sentence for brackets, repeats, an unknown named or a number), how often it holds, how long a reply takes, or whether the group finds the hints right.

**Do:**
- [ ] Before the night, publish Blood of the Dead to production from its dir (`unchanged` if the zones version is already there), in a subagent that returns only `publish`'s output.
- [ ] During the night, follow the attempt with `npm run watch -- <id>` under `Monitor`, as the ee-coach skill's Watch a run says.
- [ ] After the night, `npm run runs -- <id>`. A subagent tallies from the run's file, counts only: the coach's replies, Claude calls with their median and maximum latency, each violation kind code caught, audits by finding, refusals, gaps held and answered, revisions, ratings by value, rungs by level, and the voice turns. Then the ee-coach debrief folds the feedback into calibration and the hints.
- [ ] Record the counts, dated, in a section of `docs/zombies/site/explanation/site.md` on how the coach did.

**Acceptance:**
- Claude-run: the counts are in `site.md`, with the run's ID and date, and no hint text or question in them. The debrief's calibration changes are committed. Map-specific changes stay in the gitignored map dir.
- Human-run: the group plays a Blood of the Dead night on `zombies.enbraile.vip`, asking the coach in the chat and by its wake word in the call, with nobody at the terminal. They judge a level-3 zone mid-round, rate cards and send at least one revision.
- Reuse: `npm run watch`, `npm run runs`, the ee-coach skill's Watch a run and Debrief sections.
- Neighbors: the Load Time section's way of recording dated figures.
- Forbidden: hint text, questions or solution content in the conversation or a tracked file; switching `COACH_MODEL`.

**Touches:** `docs/zombies/site/explanation/site.md`, `zombies/calibration.md`, `.claude/skills/ee-coach/references/hint-craft.md`

## Decide whether Haiku is enough to coach live

The discovery chose Haiku 5.5 "to start; the group will report whether it is enough", with a switch to Sonnet being config ([Discovery → Architecture](discovery.md#architecture)). The game night's counts (violations caught, holds, audits, ratings) and the group's impressions are what that report rests on. A candidate model can also be measured before then: `npm run replay` with `COACH_MODEL` set runs it on a recorded run locally, and a context-free subagent judges the replay file against one on Haiku ([How to Run and Deploy the Site → Read a run](../../zombies/site/how-to/run-and-deploy-the-site.md#7-read-a-run)); Haiku with reasoning off is what the 2026-11-16 replays measured ([The Zombies Site → Decisions](../../zombies/site/explanation/site.md#decisions)).

**Needs the author:**
- With the game night's counts in hand, does the coach stay on Haiku, or does `COACH_MODEL` move to Sonnet in Production?

**Acceptance:**
- Claude-run: the answer recorded as a dated owner decision in `docs/zombies/site/explanation/site.md`. If it is Sonnet, Production's `COACH_MODEL` is set with `npx vercel env`, and the Hosting paragraph and the how-to's variable table say so.
- Human-run: none.
- Reuse: none.
- Neighbors: "Claude through the Messages API…" in `docs/home/bot/explanation/bot.md`'s Decisions, for how the model choice is recorded.
- Forbidden: a model switch before this is answered; a model chosen per reply in code.

**Touches:** `docs/zombies/site/`
**After:** Play a game night on the site and read how the coach did

## Decide whether a wake word asked during another reply is spoken late or not at all

A voice turn waits up to 30 s for the run's lease (`zombies/site/api/_lib/coach.ts:15`), then runs the whole Claude turn, up to 4 tool rounds (`:11`). The bot gives up after 25 s for the whole request (`zombies/bot/src/call.ts:8`). A wake word asked while another member's reply runs, or a slow turn on its own, therefore lands in the chat with its answer but is not spoken (`docs/zombies/site/explanation/site.md:108` names only the lease case). The game night's latency figures say how often this happens.

**Needs the author:**
- When a spoken question cannot be answered within the bot's wait, should the bot wait longer and speak the answer late (raise the bot's timeout above the lease wait plus a turn), or should the site stop waiting sooner and leave the answer in the chat only, as it is now but by design?

**Acceptance:**
- Claude-run: the answer recorded as a dated decision in `docs/zombies/site/explanation/site.md`. The next entry's Do matches it.
- Human-run: none.
- Reuse: none.
- Neighbors: "One reply at a time per run" in `site.md`'s Decisions.
- Forbidden: changing the timeouts before this is answered.

**Touches:** `docs/zombies/site/explanation/site.md`
**After:** Play a game night on the site and read how the coach did

## Make the voice turn's wait match the decision

Apply the answer to the entry above, so a wake word asked during another reply behaves as decided instead of falling between the site's 30 s lease wait and the bot's 25 s timeout.

**Do:**
- [ ] Set the bot's `SITE_TIMEOUT_MS` (`zombies/bot/src/call.ts:8`) and the voice turn's lease wait (`zombies/site/api/_lib/coach.ts`, used by `voiceTurn` in `api/_lib/voice.ts`) so that one covers the other the decided way.
- [ ] Update the Hearing lines in `docs/zombies/site/explanation/site.md:108` and `docs/zombies/bot/explanation/bot.md` ("A failed or slow request (25 s)…").

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site` and `home/bot`. Against a local site and bot, two `/api/voice` requests posted together for one run behave as decided: the second answer is spoken late, or the stream ends with no `say` before the bot's timeout with the answer in the chat.
- Human-run: in a call, two members say «bebé …» one right after the other, and the second answer arrives as decided.
- Reuse: the lease in `coach.ts` (`acquire`/`release`), `voiceTurn`.
- Neighbors: the typed reply path, which keeps its 30 s wait.
- Forbidden: a second lease mechanism; changing the typed chat's wait.

**Touches:** `zombies/bot/src/call.ts`, `zombies/site/api/_lib/coach.ts`, `zombies/site/api/_lib/voice.ts`, `docs/zombies/`
**After:** Decide whether a wake word asked during another reply is spoken late or not at all
