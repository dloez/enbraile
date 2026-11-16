# Zombies Coach — Tasks

## Speak Claude's step-ins and published answers in the call

The owner notices that lines Claude sends as Cari are not read aloud, so the group may miss them when playing by voice (2026-11-16). Only replies to a spoken wake word are spoken, since they return to the bot in `POST /api/voice`'s answer; a step-in (`POST /api/claude/runs/:id/say`, `npm run say`) and a held question answered at once on publish post a coach line the bot never hears of.

**Do:**
- [ ] When the site posts a coach line that is not the answer to a voice turn (a step-in, a gap answered on publish), and the bot holds that attempt's call, the site asks the bot to say it: a new bot route beside `/zombies/join`, behind `INTERNAL_SECRET`, taking the text and the attempt's voice, which speaks with `hearing.say(text, { voice })`; the text spoken is the line plus any hint card it carries, as voice replies already are.
- [ ] Whether replies to typed lines are also spoken while the coach is in the call is the build's choice, recorded (the owner asked for Claude's lines; typed chatter may not want a voice).
- [ ] A failed or slow bot call never delays or fails the post; it is logged.
- [ ] Docs: `docs/zombies/site/explanation/site.md` (Voice, the step-in) and `docs/zombies/bot/explanation/bot.md` (the new route).

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site` and `home/bot`; locally with a fake bot, a step-in and a publish-time gap answer each reach the bot's say route with the attempt's voice, and with the bot down the post still succeeds.
- Human-run: during a call with the coach in, Claude steps in from the watch session and the group hears it.
- Reuse: `bot()` (`zombies/site/api/_lib/bot.ts`), `stepIn` (`api/_lib/coach.ts`), the module's `hearing.say` with voice.
- Neighbors: `POST /api/voice`.
- Forbidden: speaking in a call the module does not hold; a post that waits on the bot.

**Touches:** `zombies/site/`, `zombies/bot/`, `docs/zombies/`

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
- Should prepared hints also get a wording per character (Richtofen's version of every rung, written and blind-checked at prepare like the hints are, roughly doubling a map's prepare work), or do hints stay in one plain wording while only Cari's own words take the character?

**Acceptance:**
- Claude-run: the answer recorded as a dated decision in `docs/zombies/site/explanation/site.md`.
- Human-run: none.
- Reuse: none.
- Neighbors: "Let Cari speak in the character of her voice".
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

## Play a game night on the site and read how Cari did

The discovery's goal is a game night played from the site and voice with no terminal needed, every hint coming from prepared, checked lines, and Haiku "to start; the group will report whether it is enough" ([Discovery → Goal](discovery.md#goal), [Architecture](discovery.md#architecture)). None of it has been measured. The three Blood of the Dead runs on file are imports. Their reads hold no Claude call, no gap, no feedback and no audit finding. No watch events file exists, so the watch loop has never followed a real attempt. Blood of the Dead's local bundle now holds 58 zones and its survey image, and the zones entry's human check (is a zone readable mid-round) was never run. So nothing shows whether Haiku keeps to the rules on a real map (how often code drops a sentence for brackets, repeats, an unknown named or a number), how often it holds, how long a reply takes, or whether the group finds the hints right.

**Do:**
- [ ] Before the night, publish Blood of the Dead to production from its dir (`unchanged` if the zones version is already there), in a subagent that returns only `publish`'s output.
- [ ] During the night, follow the attempt with `npm run watch -- <id>` under `Monitor`, as the ee-coach skill's Watch a run says.
- [ ] After the night, `npm run runs -- <id>`. A subagent tallies from the run's file, counts only: Cari's replies, Claude calls with their median and maximum latency, each violation kind code caught, audits by finding, refusals, gaps held and answered, revisions, ratings by value, rungs by level, and the voice turns. Then the ee-coach debrief folds the feedback into calibration and the hints.
- [ ] Record the counts, dated, in a section of `docs/zombies/site/explanation/site.md` on how Cari did.

**Acceptance:**
- Claude-run: the counts are in `site.md`, with the run's ID and date, and no hint text or question in them. The debrief's calibration changes are committed. Map-specific changes stay in the gitignored map dir.
- Human-run: the group plays a Blood of the Dead night on `zombies.enbraile.vip`, asking Cari in the chat and by «cari» in the call, with nobody at the terminal. They judge a level-3 zone mid-round, rate cards and send at least one revision.
- Reuse: `npm run watch`, `npm run runs`, the ee-coach skill's Watch a run and Debrief sections.
- Neighbors: the Load Time section's way of recording dated figures.
- Forbidden: hint text, questions or solution content in the conversation or a tracked file; switching `COACH_MODEL`.

**Touches:** `docs/zombies/site/explanation/site.md`, `zombies/calibration.md`, `.claude/skills/ee-coach/references/hint-craft.md`

## Decide whether Haiku is enough to coach live

The discovery chose Haiku 5.5 "to start; the group will report whether it is enough", with a switch to Sonnet being config ([Discovery → Architecture](discovery.md#architecture)). The game night's counts (violations caught, holds, audits, ratings) and the group's impressions are what that report rests on.

**Needs the author:**
- With the game night's counts in hand, does Cari stay on Haiku, or does `COACH_MODEL` move to Sonnet in Production?

**Acceptance:**
- Claude-run: the answer recorded as a dated owner decision in `docs/zombies/site/explanation/site.md`. If it is Sonnet, Production's `COACH_MODEL` is set with `npx vercel env`, and the Hosting paragraph and the how-to's variable table say so.
- Human-run: none.
- Reuse: none.
- Neighbors: "Claude through the Messages API…" in `docs/home/bot/explanation/bot.md`'s Decisions, for how the model choice is recorded.
- Forbidden: a model switch before this is answered; a model chosen per reply in code.

**Touches:** `docs/zombies/site/`
**After:** Play a game night on the site and read how Cari did

## Decide whether a «cari» asked during another reply is spoken late or not at all

A voice turn waits up to 30 s for the run's lease (`zombies/site/api/_lib/coach.ts:15`), then runs the whole Claude turn, up to 4 tool rounds (`:11`). The bot gives up after 25 s for the whole request (`zombies/bot/src/call.ts:8`). A «cari» asked while another member's reply runs, or a slow turn on its own, therefore lands in the chat with its answer but is not spoken (`docs/zombies/site/explanation/site.md:108` names only the lease case). The game night's latency figures say how often this happens.

**Needs the author:**
- When a spoken question cannot be answered within the bot's wait, should the bot wait longer and speak the answer late (raise the bot's timeout above the lease wait plus a turn), or should the site stop waiting sooner and leave the answer in the chat only, as it is now but by design?

**Acceptance:**
- Claude-run: the answer recorded as a dated decision in `docs/zombies/site/explanation/site.md`. The next entry's Do matches it.
- Human-run: none.
- Reuse: none.
- Neighbors: "One reply at a time per run" in `site.md`'s Decisions.
- Forbidden: changing the timeouts before this is answered.

**Touches:** `docs/zombies/site/explanation/site.md`
**After:** Play a game night on the site and read how Cari did

## Make the voice turn's wait match the decision

Apply the answer to the entry above, so a «cari» asked during another reply behaves as decided instead of falling between the site's 30 s lease wait and the bot's 25 s timeout.

**Do:**
- [ ] Set the bot's `SITE_TIMEOUT_MS` (`zombies/bot/src/call.ts:8`) and the voice turn's lease wait (`zombies/site/api/_lib/coach.ts`, used by `voiceTurn` in `api/_lib/voice.ts`) so that one covers the other the decided way.
- [ ] Update the Hearing lines in `docs/zombies/site/explanation/site.md:108` and `docs/zombies/bot/explanation/bot.md` ("A failed or slow request (25 s)…").

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site` and `home/bot`. Against a local site and bot, two `/api/voice` requests posted together for one run behave as decided: the second answer is spoken late, or `{ reply: null }` comes back before the bot's timeout with the answer in the chat.
- Human-run: in a call, two members say «cari …» one right after the other, and the second answer arrives as decided.
- Reuse: the lease in `coach.ts` (`acquire`/`release`), `voiceTurn`.
- Neighbors: the typed reply path, which keeps its 30 s wait.
- Forbidden: a second lease mechanism; changing the typed chat's wait.

**Touches:** `zombies/bot/src/call.ts`, `zombies/site/api/_lib/coach.ts`, `zombies/site/api/_lib/voice.ts`, `docs/zombies/`
**After:** Decide whether a «cari» asked during another reply is spoken late or not at all
