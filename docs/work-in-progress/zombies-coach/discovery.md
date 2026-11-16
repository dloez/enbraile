# Zombies Coach — Discovery

Scoped with the owner on 2026-11-15, from the zombies workspace (`~/workspace/zombies`) while a Blood of the Dead test session was running there.

## Goal

A new `zombies` category in Enbraile that helps the group beat the easter eggs of the Zombies maps the owner enrols, by themselves, with hints instead of walkthroughs. The loop:

1. In Claude Code the owner names a map; Claude researches it and prepares everything (the existing ee-coach prepare flow, moved into Enbraile).
2. Claude publishes the map to `zombies.enbraile.vip`, where the group starts or joins a run and talks to the coach in a shared chat, with visual hints (a zone on a map image) on rungs that give a place.
3. In Discord voice the group can say the attempt's wake word («coach …» or «richtofen …») and the coach answers in the call through the Enbraile bot.
4. While they play, Claude Code can watch the run and close gaps, apply revisions, audit replies and fix the dossier on the fly.

Done looks like: a game night played from the site and voice with no terminal needed, every hint coming from prepared and checked lines, and the zombies workspace gone, everything useful living in Enbraile.

## Decisions

### Architecture

- **Q: Who answers during play?** **A:** Vercel is the brain: the site's function holds map bundles, run state and chat, calls Claude and enforces the hint rules in code. The bot is only an interface: it turns a wake word and what follows it into a call to the site's API and speaks the answer. **Why:** owner — the bot runs on the homelab and has other jobs; the site must work with the bot down. (A bot-module brain was proposed first and rejected.) _(owner, 2026-11-15)_
- **Q: Which model coaches live?** **A:** Claude Haiku 5.5 to start; the group will report whether it is enough. The model is an environment variable, so a switch to Sonnet is config. **Why:** owner. Onboarding new maps stays in Claude Code because the live model is less capable. _(owner, 2026-11-15)_
- **Q: How does Haiku stay safe?** **A:** The prepared data does the thinking: each map is compiled into a structured bundle (steps with `Requires`, conditions, optional flags, `On success` lines; ladders whose every rung and Alt has its exact wording per language and its `Mentions`; part ladders; knowledge entries with marks). Haiku acts through tools (give a hint, mark something known, record progress, ask the round, hold), and code enforces the rules: only rungs whose `Mentions` are known or meant to be revealed are offered, one rung at a time, no optional step offered, every delivery logged and marks updated. Haiku sees the open threads and the rungs it may give, never the dossier. _(the agent's proposal, owner agreed, 2026-11-15)_
- **Q: What happens when no prepared line fits?** **A:** Hold and log: the coach answers with an in-voice non-answer, may ask what they see, and records a gap. Claude writes and checks the missing line and publishes it; the run picks it up on its next message. No improvisation by the live model. _(owner, 2026-11-15)_

### Data and storage

- **Q: Which database?** **A:** A new Neon project, `zombies` (Frankfurt), with a `dev` branch for previews; not pkmn's. **Why:** owner. _(owner, 2026-11-15)_
- **Q: Sign-in?** **A:** Through `enbraile.vip/api/me` with the reader's cookie, as the DJ panel does (`dj/panel/api/_lib/app.ts`), so zombies holds no auth tables. Decoupling the sign-in tables from pkmn's database is a separate backlog idea, not part of this one. _(owner, 2026-11-15)_
- **Q: Where do spoilers live?** **A:** Sources, dossier, hints and the compiled bundle are edited in a gitignored `zombies/maps/<game>/<map>/` on the owner's PC; publishing uploads the bundle, plus the dossier and sources as the durable copy, to Neon. Nothing about any map goes into git. **Why:** the repo is shared with `izarte`, a player. _(owner, 2026-11-15)_
- **Bundles are versioned:** every publish is a new version; runs follow the latest, so fixes apply mid-run; an older version can be published again to revert. _(the agent's choice, 2026-11-15)_
- **A committed made-up test map** (no real map's content) is the fixture for local and preview checks. _(the agent's choice, 2026-11-15)_

### Runs and the site

- **Q: Who can use it, and what is a run?** **A:** Anyone signed in through `enbraile.vip` sees published maps and can start a run; others join from the site. A run's members share one chat, its hints and progress. Several runs may exist; a person is in one at a time. _(owner, 2026-11-15)_
- **Q: What does a run look like?** **A:** One shared chat with the coach; hints arrive as cards with a generic "more" control and feedback controls (too obvious / right / too vague); a level-3 zone shows under its card. **No step or hint numbers anywhere** (the terminal's "Step 5 · hint 2/4" is not shown), no list of steps, and **the UI is never a hint**: no buttons or suggestions that tell players what to try. _(owner, 2026-11-15)_
- **Q: Who designs the UI?** **A:** Claude design in Artifacts, as for the pkmn site and the DJ panel, frozen as `.dc.html` boards in `zombies/site/design/`. The owner does not review the boards beforehand, to see the site as a surprise; they must reach the taste and "wow" of pkmn and DJ. The decisions above are the brief's constraints, not the design. _(owner, 2026-11-15)_
- **Q: Where do a new run's knowledge marks start?** **A:** The map's baseline (set at prepare from the intake) plus everything that became known in earlier runs by the same people; Claude can adjust a run's marks from Claude Code. _(owner, 2026-11-15)_
- **Q: Language?** **A:** Chosen per run, Spanish by default; the coach's lines come from that language's prepared wording. The site's chrome follows each reader's en/es switch, as pkmn and DJ. _(owner, 2026-11-15)_
- **Live updates:** the asker's reply streams back; other members poll every 2 s (Vercel Hobby has no websockets; a 3-hour night of two players is about 7,200 calls of the shared 1M). _(the agent's choice, 2026-11-15)_

### Feedback and the watch loop

- **Q: REVISION comments?** **A:** A message starting with `REVISION:` (or written wherever the design puts feedback) never reaches the live model as gameplay; it is stored on the run with the line it refers to, and the coach acknowledges it briefly. Card feedback lands in the same log. Claude folds them into calibration and the hints. _(owner, 2026-11-15)_
- **Q: Can Claude act during play?** **A:** Yes, a watch loop in Claude Code: a `watch` stream on the zombies API (followed with `Monitor` or `/loop`) shows each event, and Claude, in subagents so no solution scrolls past in the terminal the players may see, closes gaps, applies revisions and card feedback, **audits every live reply** against the rules (unknown named, rung skipped, optional offered, number shown), **fixes the dossier live** when players report something it contradicts (sources re-checked), and **steps in** by posting in the run as the coach when Haiku is lost. The terminal shows spoiler-free one-liners only. _(owner, 2026-11-15)_

### Voice

- **Q: How do the coach and the call meet?** **A:** When a run member is in a voice channel, the site offers to bring the coach in (through the bot's API, as DJ joins) and `/coach` does the same from Discord. The `zombies` bot module registers each character's wake word («coach», «richtofen»), maps the speaker to their run, sends the request to the site's API and speaks the answer with `hearing.say`; the reply is also posted in the run's chat. Typed questions get text answers only. _(owner, 2026-11-15)_
- **Q: Transcripts?** **A:** While the coach is in the call for a run, the module asks the host to transcribe, and the lines said in its channel go into the run, for the watch loop and debriefs. The live model only gets text after the wake word. The host has no way for a module to read transcript lines today (`home/bot/src/transcripts.ts` writes them to B2 only), so it gains a `hearing.onTranscript`. _(owner; the primitive the agent's choice, 2026-11-15)_
- **Q: Sound hints?** **A:** The coach's voice only; no chimes or clips on new hints, since a cue would itself carry meaning. _(owner, 2026-11-15)_

### Visual hints

- **Q: How far do map zones go?** **A:** A later slice, after text works end to end. At prepare Claude finds a community map image and draws zones only on rungs that give a place (level 3, sometimes level 4), blind-checked like the hints; levels 1–2 never show a zone. _(owner, 2026-11-15)_

### Migration

- **Q: When does the zombies workspace move?** **A:** First, with the terminal flow intact: the ee-coach skill (to `.claude/skills/ee-coach/`), the standing rules (to `zombies/CLAUDE.md`), calibration and the Blood of the Dead files, session included (to the gitignored `zombies/maps/`), so coaching from the terminal keeps working in Enbraile while the site is built. Once runs exist, the session is imported as a run and continued on the site; then `~/workspace/zombies` is deleted. Building happens only in Enbraile from then. _(owner, 2026-11-15)_
- **Q: Calibration (it quotes delivered BotD hints)?** **A:** Split: the group's general preferences and hint rules are committed (calibration plus the skill's `hint-craft.md`); map-specific quotes stay with that map's gitignored files, backed up to Neon. _(owner, 2026-11-15)_
- `ideas.md` is superseded by this discovery (the static-page-only version was dropped for chat plus cards).

## Anchor Areas

- **Surfaces:** `zombies/site/` (Vite + React + one Hono function, mirroring `dj/panel/`), `zombies/bot/` (the module, imported by `home/bot/src/modules.ts`), `home/bot/src/hearing.ts` and `sdk.ts` (`onTranscript`), `zombies/maps/` (gitignored), `.claude/skills/ee-coach/`, `.github/workflows/zombies-site.yml`, `docs/zombies/`, `docs/index.md`, `docs/general/how-to/deploy-vercel-projects.md`, `docs/general/explanation/repository-layout.md`.
- **Dependencies & ordering:** migration → design boards → site skeleton with publish → runs and chat → progress rules → BotD bundle → holds and feedback → session import → watch loop → audit and step-in → voice → transcripts → zones.
- **Secrets & config (Vercel):** `ANTHROPIC_API_KEY` (copied from 1Password `discord-bot-enbraile/anthropic-api-key`), `DATABASE_URL`, `ROOT_URL`, `BOT_URL`, `INTERNAL_SECRET` (the one DJ uses; site↔bot both ways), `CLAUDE_TOKEN` (Claude Code's publish, watch and step-in, behind `/api/claude/`; kept in 1Password as "zombies claude token"), `COACH_MODEL`. Untracked `.env.local` and an `.env.example` naming every variable.
- **Interfaces:** `zombies.enbraile.vip`, a DNS-only CNAME in the Cloudflare `enbraile.vip` zone; Vercel project `enbraile-zombies`, root `zombies/site`, region `fra1`, deployed by GitHub Actions like the other three; the bot's `/zombies/…` routes behind `INTERNAL_SECRET` through Funnel.
- **Reuse:** `/api/me` sign-in (`dj/panel/api/_lib/app.ts`), the DJ's join path for voice, the host's `voice.hold`, `hearing.onTrigger`, `hearing.say`, `transcripts.keep` (`home/bot/src/sdk.ts`), pkmn's Drizzle + `pg` + migrations-in-build setup (`pkmn/site`), the deploy workflow pattern (`.github/workflows/dj-panel.yml`). The bot's `claude.ask` is not used: Claude runs on Vercel.
- **Idempotency & rollback:** forward-only Drizzle migrations; Vercel Instant Rollback; bundle versions republishable; publishing the same bundle twice is a no-op version.
- **Portability:** the site on Vercel's Node runtime; the module inside the arm64 bot image; scripts run on the owner's WSL.
- **Observability:** each Claude call's model, tokens, latency and any rule violation stored on the run, read by the watch loop and debriefs; nothing external.
- **Verification:** `npm run gate` (`tsc`) per project, no tests (repo rule); local runs driven through the Playwright MCP against the test map; human-run checks on a real game night.

## Scope Edges

- Out: decoupling the sign-in from pkmn's database (backlog idea).
- Out: game-like audio clips as hints.
- Out: any interaction with the game (standing rule: no screen capture, input or memory reading).
- Out: the live model writing hints of its own.
- Out: public use; only signed-in group members.

## References

- `CLAUDE.md`, `docs/index.md`, `docs/general/explanation/repository-layout.md`, `docs/general/how-to/deploy-vercel-projects.md`
- `docs/home/bot/explanation/bot.md`, `docs/home/voice/explanation/voice.md`, `docs/home/site/explanation/site.md`
- `docs/dj/panel/explanation/panel.md`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/reference/design-system.md`
- `home/bot/src/sdk.ts`, `home/bot/src/claude.ts`, `home/bot/src/transcripts.ts`, `dj/panel/api/_lib/app.ts`, `home/site/api/_lib/schema.ts`, `pkmn/site/api/_lib/schema.ts`
- `~/workspace/zombies/`: `CLAUDE.md`, `ideas.md`, `calibration.md`, `.claude/skills/ee-coach/` (`SKILL.md`, `references/hint-craft.md`, `references/research.md`), `maps/bo4/blood-of-the-dead/`
- Vercel Hobby limits (1M invocations, 4 h active CPU a month) and Neon Free (100 projects, 1 GB and 100 CU-hours each), checked 2026-11-15
