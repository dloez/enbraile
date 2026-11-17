# Zombies Coach — Tasks

## Publish the zones for every place-giving rung of both maps

`compile` now warns about every level 3 or 4 rung with no zone decision ([Decisions](../../zombies/site/explanation/site.md#decisions), "Every place-giving rung has its zone, checked by compile"); Kowakujo was published with zones on 6 of its 90 level 3 and 4 rungs, Blood of the Dead with 46 of 80.

**Do:**
- [ ] In subagents that report addresses and counts only, place or `null` every undecided rung of both maps with the render check and the blind check of `research.md` 3b, until `compile` prints no zones warning.
- [ ] Publish both to production through the `watch-run` skill's `prod` wrapper, quoting only `publish`'s output.

**Acceptance:**
- Claude-run: `npm run compile` on both map dirs prints no `warning: zones`; `publish` prints a new version for each.
- Human-run: on the next night, a level 3 hint that names a place shows its map.
- Reuse: `research.md` 3b, the `prod` wrapper.
- Neighbors: none.
- Forbidden: hint text or place names in the conversation or a tracked file.

**Touches:** `zombies/maps/` (gitignored)

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
