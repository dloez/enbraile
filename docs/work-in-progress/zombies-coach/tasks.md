# Zombies Coach — Tasks

## Let Cari speak in the character of her voice

The owner wants Cari's words to sound like the voice saying them, at least for customised voices like Richtofen (2026-11-16, top priority). Hint text stays exactly as prepared (the model never writes hint text), so the character lives in everything around the hints: Cari's own sentences and the fixed lines code says (holds, acknowledgements, the blocked-step line, "From the last session."). Needs the voice worker's configurable voices (backlog: "home/voice: configurable voices, with Castilian Chatterbox and a Richtofen voice") to have landed first.

**Do:**
- [ ] A character per voice, kept beside the voice's settings: a short style brief for the coach's system prompt (for Richtofen: his manic, theatrical manner, in Castilian, as heard in the BO3 dub) and that voice's own wording of every fixed line in both languages; the plain voices keep today's Cari.
- [ ] Which voice an attempt speaks with is chosen when starting it, beside the language, and can be changed in the attempt (the agent's choice, recorded as a dated decision); the coach prompt and the fixed lines follow it, and the voice reply asks the worker for it through `hearing.say`'s voice option.
- [ ] The audit and the sentence filters still apply unchanged: a character never names an unknown, shows a number or carries brackets.
- [ ] Docs: the character in `docs/zombies/site/explanation/site.md` (Cari) and the voice choice in the design-system doc.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site` (and `home/bot` if touched); locally on the test map with the real Haiku, an attempt set to Richtofen gets replies in his manner around unchanged prepared hints, a plain-voice attempt keeps today's Cari, and the audit finds nothing new.
- Human-run: in a call, the owner hears Richtofen say Cari's words and finds they sound like him.
- Reuse: the coach prompt (`api/_lib/coach.ts`); the fixed lines in code; the voice option on `hearing.say`.
- Neighbors: the voices task in the backlog.
- Forbidden: the model writing or restyling hint text; a character that bypasses the audit or the knowledge marks.

**Touches:** `zombies/site/`, `zombies/bot/`, `docs/zombies/`

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
**After:** Let Cari speak in the character of her voice

## Show players by their current Discord names

The owner finds the player names fixed and wants them from Discord (2026-11-16, relayed by another session). A member's name is a snapshot taken when they join (`zombies/site/api/_lib/runs.ts:45`, the root's `/api/me` name) and never refreshed; imported attempts take the names typed on the command line (the Blood of the Dead attempt shows "Jugador 1" and "Jugador 2"), and imported history shows players as "Terminal".

**Do:**
- [ ] Resolve each member's current server display name by Discord ID when a page is read, through the bot, which already holds the guild's members (a route beside `/zombies/voice` behind `INTERNAL_SECRET`, batched per page, cached briefly on the site), falling back to the stored name when the bot does not answer; the same for a line's author in the chat.
- [ ] The Blood of the Dead attempt then shows its two players' real names; imported history keeps "Terminal" (who typed a terminal line is unknown).
- [ ] Docs: `docs/zombies/site/explanation/site.md` and `docs/zombies/bot/explanation/bot.md` (the new route), with the decision dated.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site` and `home/bot`; locally with a fake bot route, a member whose stored name differs shows the bot's name, and with the bot stopped the stored name; no page waits more than the site's timeout on the bot.
- Human-run: the owner opens the Blood of the Dead attempt and sees both players' Discord names.
- Reuse: the site's `BOT_URL` calls (`api/_lib/voice.ts`); the module's member lookup (`zombies/bot/src/`).
- Neighbors: the DJ panel's calls to the bot.
- Forbidden: Discord tokens on the site; a page that fails when the bot is down.

**Touches:** `zombies/site/`, `zombies/bot/`, `docs/zombies/`

## Remove Harrow Station from the production maps

The owner wants the made-up test map gone from the maps page (2026-11-16, relayed by another session). Publishing only adds versions (`docs/zombies/site/explanation/site.md`, Bundles); nothing removes a map. The test map stays in the repo (`zombies/site/test-map/`), since local checks and the how-to's verification use it.

**Do:**
- [ ] Delete the map for good, with its versions and any attempts on it (owner, 2026-11-16): a Claude route behind `CLAUDE_TOKEN` and `npm run unpublish -- <game>/<map>`, then remove `test/harrow-station` from production; docs in `site.md` and the how-to.

**Acceptance:**
- Claude-run: `npm run gate` in `zombies/site`; locally, an unpublished map leaves the maps page and its versions and attempts are gone; on production, `/api/maps` signed in no longer lists Harrow Station.
- Human-run: the owner no longer sees Harrow Station on the site.
- Reuse: the Claude API (`api/_lib/app.ts`).
- Neighbors: `publish`.
- Forbidden: deleting any other map's data; removing `zombies/site/test-map/`.

**Touches:** `zombies/site/`, `docs/zombies/site/`

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
