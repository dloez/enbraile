# Zombies Coach — Tasks

## Draw the survey sheet's inks from tokens

The zone's hatch, the drawn plan's grid and its lines are raw hex in a component: `zombies/site/src/art.tsx:107` (`#c4321a`), `:110` (`#2945a8`) and `:118` (`#15140f`). That breaks "Tokens only in the site's code … no hex in components" (`docs/zombies/site/reference/design-system.md:27`). The doc's `:52` says the survey sheet's inks "become tokens when those features are built", and zones were built in e681f38.

**Do:**
- [ ] Add the survey inks as tokens in `src/index.css` `:root`, and have `SurveyZone` read them (CSS classes or `var(--…)` on the SVG attributes).
- [ ] Add them to the design system's Colour Tokens table, and drop the survey sheet from `:52`'s list of raw values.

**Acceptance:**
- Claude-run: `npm run gate`. `grep -nE '#[0-9a-fA-F]{3,6}' zombies/site/src/*.tsx` finds nothing. Through `verify-site`-style local checks in the Playwright MCP, the test map's level-3 slip shows its zone on the drawn plan, looking the same as before.
- Human-run: none.
- Reuse: the token pattern in `src/index.css`.
- Neighbors: the `slip-*` tokens.
- Forbidden: a changed colour; hex in a component.

**Touches:** `zombies/site/src/art.tsx`, `zombies/site/src/index.css`, `docs/zombies/site/reference/design-system.md`

## Answer a failed voice turn with 500, as the site doc says

`docs/zombies/site/explanation/site.md:108` says "A turn that fails answers 500, which the bot logs and also meets with silence." It does not. When the Claude call fails, `coachTurn` catches the error, logs it in `coach_calls` and only emits a `failed` event (`zombies/site/api/_lib/coach.ts:729-736`, `:908`). `voiceTurn` reads only `text` events (`zombies/site/api/_lib/voice.ts:28-31`), so the route answers 200 `{ reply: null }` (`api/_lib/app.ts:139`). The bot then treats it as Cari choosing silence and logs nothing (`zombies/bot/src/call.ts`, `ask` and `heard`). Only a thrown database error reaches a 500. In the chat, a failed reply already says so rather than staying silent ("A failed reply says so", `site.md:205`). So the doc's behaviour is the intended one, and the code is what falls short.

**Do:**
- [ ] Have `voiceTurn` notice the turn's `failed` event and make the `/api/voice` route answer 500, so the bot logs it as the doc says. A refusal and a deliberate silence still answer `{ reply: null }`.
- [ ] Check `site.md:108` and `docs/zombies/bot/explanation/bot.md`'s Hearing line still read true.

**Acceptance:**
- Claude-run: `npm run gate`. Against the local site with `ANTHROPIC_API_KEY` set to an invalid key, a «cari» request posted to `/api/voice` with `INTERNAL_SECRET` answers 500 and the run's `coach_calls` row holds the error. With the real key, a chat line that needs nothing still answers `{ reply: null }` with 200.
- Human-run: none.
- Reuse: the `failed` event `coachTurn` already emits; the typed path's handling of it in `src/RunPage.tsx`.
- Neighbors: the `POST /api/runs/<id>/messages` stream.
- Forbidden: a retry in the site or the bot; speaking an error line in the call (a sound or line would be a new behaviour the docs do not describe).

**Touches:** `zombies/site/api/_lib/voice.ts`, `zombies/site/api/_lib/app.ts`, `docs/zombies/`

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
