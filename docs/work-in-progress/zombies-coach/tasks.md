# Zombies Coach — Tasks

## Tell a rung that cannot be placed from one that gives no place

`zones.json`'s `null` means a rung gives no place, and `compile` stays quiet about it; the 2026-11-17 prepares also used it for rungs whose spot could not be found on the survey image (Kowakujo's 53 single spots and 23 multi-place rungs, two of Blood of the Dead's), so those name a place and show no map without any warning.

**Do:**
- [ ] In a subagent per map that reports addresses and counts only, turn the low-confidence `null`s into `"unplaced"`.

**Acceptance:**
- Claude-run: `npm run gate`; `compile` on Kowakujo prints an unplaced count matching the prepare's report.
- Human-run: none.
- Reuse: `zoneAt` in `scripts/compile.ts`.
- Neighbors: the undecided zones warning.
- Forbidden: map content in a tracked file.

**Touches:** `zombies/site/scripts/compile.ts`, `.claude/skills/ee-coach/references/research.md`, `zombies/maps/` (gitignored)

## Blind-check Blood of the Dead's zone lists again from private folders

Both 2026-11-17 zone agents found files in their shared scratch folder overwritten by the other while they worked; Blood of the Dead's 12 zone lists that passed then are published.

**Do:**
- [ ] In a subagent working only in a folder of its own, render and blind-check every zone list of Blood of the Dead as `research.md` 3b says, fixing and publishing only what fails.

**Acceptance:**
- Claude-run: the subagent reports passes and failures by address only; anything fixed is published through the `prod` wrapper.
- Human-run: none.
- Reuse: `research.md` 3b.
- Neighbors: none.
- Forbidden: a shared scratch folder between agents; map content in the conversation.

**Touches:** `zombies/maps/` (gitignored)

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
