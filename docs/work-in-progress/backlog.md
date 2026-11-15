# Backlog

Laid out as the `/scope` skill's work-in-progress layout says. An entry's heading starts with its category or project (e.g. `pkmn/site: …`).

## Questions

### pkmn/site: where do a trainer's lives come from?

The series page's trainer panel wants a trainer's lives, for a series that plays with a lives clause (series 1 plays without one), and nothing gives them yet. The rest of what the panel wants now comes from the snapshot, fainted Pokémon included, through a per-series ingestion mode ([The pkmn Site → Snapshots](../pkmn/site/explanation/site.md#snapshots), 2026-10-23). Raised in the site v2 design pass. _(owner, 2026-10-22)_

### pkmn/site: what does the league do with a player who joins mid-league?

A running series takes new players, and the [league](../pkmn/site/explanation/site.md#league) draws each round among the series' players. Open: whether a player added mid-league joins the draw from the next round, gets catch-up matches against those they missed, or stays out until the next series; and how the standings and the cup treat them. A player added to a running manual series now uploads their save before they reach the site, so they arrive with their snapshot ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)); the league still has to place them. Left open while scoping the league. _(owner, 2026-10-27)_

### pkmn/site: fit the PC summary's "Add to team" strip?

The "Add to team" menu in a PC summary shows each team as a strip of sprites that overlap and are trimmed about 4px top and bottom, with about three of six shown, as the frozen `pc.dc.html` draws it (`margin: -4px -9px 0 0` in a 76×24 strip). Every other sprite tile was fitted whole on 2026-10-29 at the owner's request, this one left as the exception ([Site Design System → Patterns](../pkmn/site/reference/design-system.md#patterns)). Fit it too, which changes its look, or keep the board's? _(raised 2026-10-29)_

### dj/bot: should disconnecting the bot by hand end the session?

When someone disconnects the bot from the call in Discord, the bot joins the same channel again within about 5 s and resumes, as it does after a network drop, since the two look alike from the voice connection ([The DJ Bot → How It Runs](../dj/bot/explanation/bot.md#how-it-runs)). A member who kicks it probably wants it gone. Telling the cases apart needs the bot's own voice state update with no channel, which a kick sends and a network drop does not. Open: stop the session on a kick, or keep rejoining. Raised by the connection-handling loop, 2026-11-08.

## Tasks

### pkmn/site: the team page writes its pick of six as a digit

The team page's member cards say "Leave out of the six" and "Put in the six" ("Dejar fuera de los seis", "Meter en los seis"; `src/teams/components/member-card.tsx`), as the frozen `team.dc.html` and `team-phone.dc.html` spell it, while the same page's switch and count read `PICK_SIZE` (`shared/team.ts`) as a digit. The owner settled it on 2026-10-29: the digit, from `PICK_SIZE`, as the league's labels write theirs (The pkmn Site → Decisions, "The league's labels write its rules' numbers as digits too").

**Do:**
- [ ] Build those labels from `PICK_SIZE`, in English and Spanish, with a dated decision in [Team Builder](../pkmn/site/explanation/team-builder.md) noting the frozen boards still say "six".

**Acceptance:**
- Claude-run: `npm run gate`; `grep` finds no "the six"/"los seis" in `member-card.tsx`; through `verify-site`, a team of eight's member card reads "Leave <name> out of the 6" and "Put in the 6", in English and Spanish.
- Human-run: none.
- Reuse: `PICK_SIZE` (`shared/team.ts`).
- Neighbors: the league's labels (`src/pages/league-match.tsx`).
- Forbidden: a pick size written into a label.

**Touches:** `pkmn/site/src/teams/components/member-card.tsx`, `docs/pkmn/site/explanation/team-builder.md`

### pkmn/site: the series page's milestone names fit below 1440 wide too

From `sm` up to 1440 wide the series page's Trainers head (`src/pages/series.tsx`) gives each of series 1's eleven milestones a column under 84px wide, and its names still run together there: at 1024×768 the columns are 51.8px, Tournament overlaps Hall of Fame by 11.9px and Victory Road sits 5.2px from Hall of Fame. From 1440 they wrap between their words with 20px or more between them ([The pkmn Site → Decisions](../pkmn/site/explanation/site.md#decisions), "The Trainers head's milestone names wrap between their words"). Found while validating that entry, 2026-10-29.

**Do:**
- [ ] The head's names readable and apart from `sm` (640) to 1440 wide, in the layout `series.dc.html` draws, with any build choice recorded as a dated decision in [The pkmn Site](../pkmn/site/explanation/site.md#decisions).

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, series 1 of the seed at 1024×768 and 800 wide, every milestone name in the track's head readable with space between them, the nodes under their names; 1440×900 and 390×844 unchanged.
- Human-run: none.
- Reuse: `Track` and `shortName` (`src/pages/series.tsx`).
- Neighbors: the phone's short labels below `sm`.
- Forbidden: renaming a milestone; editing a board in `pkmn/site/design/`.

**Touches:** `pkmn/site/src/pages/series.tsx`, `docs/pkmn/site/explanation/site.md`, `docs/pkmn/site/how-to/verify-the-site.md`

### pkmn/site: the design system names the series page's phone labels as they read

[Site Design System](../pkmn/site/reference/design-system.md)'s series page entry gives the phone strip's milestone labels as ("1"–"8", "L"), but series 1's milestones since 2026-10-29 end in Victory Road and Hall of Fame, and the strip reads 1–8, R, F and the cup ([The pkmn Site → Decisions](../pkmn/site/explanation/site.md#decisions), "The series pages' phone build choices"). Found while validating the series page's milestone names, 2026-10-29.

**Do:**
- [ ] Correct the example labels in the design system's series page entry to what `shortName` (`src/pages/series.tsx`) gives series 1's milestones.

**Acceptance:**
- Claude-run: docs-only, no gate run; `grep` finds no `"L")` in the series page entry of `design-system.md`; the labels named match what `shortName` gives series 1's milestones.
- Human-run: none.
- Reuse: none.
- Neighbors: The pkmn Site → Decisions, "The series pages' phone build choices".
- Forbidden: changing `shortName`.

**Touches:** `docs/pkmn/site/reference/design-system.md`

### pkmn/site: several series run at once

The owner wants more than one series running at a time (2026-10-27). A partial unique index, `series_one_running_idx` in `api/_lib/schema.ts`, lets one run, and the site leans on that: `/` sends a player to the running series (`src/pages/home.tsx`), the header's PC tab opens their PC in it (`src/components/site-header.tsx`), the team builder takes the sources a player may start from and a new team's pool from it (`api/_lib/teams.ts`), the admin overview shows one running banner (`src/pages/admin.tsx`), and starting a series needs the running one finished (`startChecklist` in `shared/series.ts`, `otherRunning` in `api/_lib/series-data.ts`). Joining mid-series already handles several: the waiting page offers an upload per owed series ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)).

**Do:**
- [ ] Per the author's answers: drop the index with its migration, and make each place above handle several running series.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, start a second series beside the seeded Series 1, add Leaf to both mid-way, and see the waiting page offer both uploads; read `/`, the PC tab, New team and the admin overview with both running.
- Human-run: none.
- Reuse: `owedSeries` and the waiting page's per-series buttons; the series list's banners (`src/pages/series-list.tsx`).
- Neighbors: the league ([The pkmn Site → League](../pkmn/site/explanation/site.md#league)), which draws its rounds per series.
- Forbidden: none yet.

**Touches:** `pkmn/site/api/`, `pkmn/site/shared/series.ts`, `pkmn/site/src/`, `pkmn/site/drizzle/`, `pkmn/site/scripts/seed.ts`, `docs/pkmn/site/`
**Needs the author:**
- Where `/` sends a player in several running series: the series list, the newest, or the one they last opened?
- Which series the header's PC tab opens.
- Which running series' snapshots and pool the team builder starts a new team from.
- How the admin overview shows several running series.
- Whether starting a series still asks for anything about the ones running.

### pkmn/site: track what a locked league team spends in a manual series

A locked round or cup team spends Mini Setas, mints and held items that the player must spend in the game too, and the site only sees that at the next snapshot. Series 1 does nothing about it ([Team Builder → Decisions](../pkmn/site/explanation/team-builder.md#decisions)). A later series may deduct a locked team's spending from the bag the player's other teams see, or flag a next snapshot that does not show it spent, within manual series' trust stance ([The pkmn Site → Decisions](../pkmn/site/explanation/site.md#decisions)). _(owner, 2026-10-27)_

**Do:**
- [ ] Per the author's answers.

**Acceptance:**
- Claude-run: `npm run gate`; through `verify-site`, the chosen behaviour on a locked team.
- Human-run: none until a series uses it.
- Reuse: the team builder's per-snapshot limits (`src/teams/`).
- Neighbors: none.
- Forbidden: blocking an upload or a team.

**Touches:** `pkmn/site/src/teams/`, `pkmn/site/api/`, `docs/pkmn/site/`
**Needs the author:** deduct, warn, or both, and for which spends.

### pkmn/site: fix The pkmn Site's dead link to the admin pages

The Accounts section of [The pkmn Site](../pkmn/site/explanation/site.md#accounts) links `[Admin pages](#admin-pages)` from its paragraph on the admin boards, but `#admin-pages` is no heading: "**Admin pages.**" is a bold lead-in in that same section, so the anchor goes nowhere. Belongs to no idea; found by the league's mid-run gardener, 2026-10-29.

**Do:**
- [ ] Point the link at `#accounts`, the section holding the paragraph, or drop it, since it points into its own section.

**Acceptance:**
- Claude-run: `grep -n '#admin-pages' docs/` finds nothing; every `#…` link in `site.md` names one of its headings.
- Human-run: none.
- Reuse: none.
- Neighbors: the doc's other in-page links, such as `(#league)`.
- Forbidden: a heading added only to give the link a target.

**Touches:** `docs/pkmn/site/explanation/site.md`

### pkmn/site: one formatter for an override's date and time

`setAt` in `src/lib/admin-format.ts:19-21`, added for the team page's "Fixed by" line (`813d7bd`), formats a time with `{ dateStyle: "medium", timeStyle: "short" }` in the site's locale, and two private copies do the same: `when` in `src/league/eggs.tsx:64-66`, for the Eggs cell's title and note, and `when` in `src/components/trainer-admin.tsx:59-61`, for the trainer panel's set-by-hand and moved-by lines. Belongs to no idea: one copy is the league's, one the site's; found by the league's end-of-run gardener, 2026-10-29.

**Do:**
- [ ] Replace both `when`s with `setAt` from `@/lib/admin-format`.

**Acceptance:**
- Claude-run: `npm run gate`; `grep -rn 'timeStyle' pkmn/site/src` finds only `admin-format.ts`; through `verify-site`, the standings' Eggs cell and the trainer panel's set-by-hand line read their times as before.
- Human-run: none.
- Reuse: `setAt` (`src/lib/admin-format.ts`).
- Neighbors: `joinedOn`, in the same file.
- Forbidden: a fourth formatter.

**Touches:** `pkmn/site/src/league/eggs.tsx`, `pkmn/site/src/components/trainer-admin.tsx`

### home/voice: configurable voices, with Castilian Chatterbox and a Richtofen voice

The owner wants the voice worker's voices configurable (2026-11-16): an allow-list of enabled voices, loading only those (the owner games on this PC, so GPU memory matters), and a default; modules may pick one. Piper stays. In a call the owner compared Piper, Kokoro and Pocket TTS (robotic or flat) against Chatterbox Multilingual (clearly the best general voice, but Mexican Spanish; Resemble's Spain finetune fixes it). Zero-shot cloning of Richtofen (Chatterbox, RVC) failed on intonation; XTTS-v2 fine-tuned on about 2 h of his BO3 Castilian dub lines, extracted from the owner's own install, is "wayyyy better" (owner), and its first round is final (a second plateaued and dropped words). Research by another session, 2026-11-15/16, nothing committed.

**Do:**
- [ ] Voices configured in the worker (`home/voice/`): an allow-list and a default from the environment; only enabled voices load and warm up at start; the worker lists what it has. How a module picks one is the build's choice (e.g. `hearing.say(text, { voice })` with the worker's default as fallback), recorded as a dated decision and documented in the bot doc if `say` changes.
- [ ] Chatterbox, Spain Spanish (no reference clip): `chatterbox-tts`, `chatterbox.mtl_tts.ChatterboxMultilingualTTS.from_local(dir, "cuda")`, `generate(text, language_id="es", audio_prompt_path=None, exaggeration=…, cfg_weight=…)` at `model.sr` (24 kHz). Build the local dir from `ResembleAI/chatterbox` (`ve.pt`, `conds.pt`, `s3gen.pt`, `Cangjie5_TC.json`) and `ResembleAI/Chatterbox-Multilingual-es-es` (MIT; `t3_es_es.safetensors` saved or linked as `t3_mtl23ls_v2.safetensors`, and `grapheme_mtl_merged_expanded_v1.json`); not its `s3gen_v3.pt`, which fails to load into the current S3Gen (`S3Token2Wav` state_dict error), while the base `s3gen.pt` keeps the accent (it lives in T3). Two presets the owner heard: default (exaggeration 0.5, cfg_weight 0.5) and expressive (0.8, 0.3).
- [ ] Richtofen (fine-tuned XTTS-v2, `coqui-tts`): the bundle `/home/david/voice-lab/models/richtofen/` (`model.pth` 2.0 GB inference-only, `config.json` with training paths cleared, `vocab.json`, `refs/ref1..ref8.wav`), kept out of git (game-derived, XTTS CPML non-commercial): copied into a gitignored data dir or pointed at by an env var. Load with `XttsConfig().load_json`, `Xtts(cfg).load_checkpoint(cfg, checkpoint_path=…, vocab_path=…, use_deepspeed=False)`, `.cuda()`; conditioning once at start, `get_conditioning_latents(audio_path=[the 8 refs], gpt_cond_len=30, max_ref_length=60)`; speak with `inference(text, "es", lat, spk, temperature=0.65, top_p=0.85, top_k=50, repetition_penalty=5.0)`, `o["wav"]` at 24 kHz. Those settings are the owner's pick of four.
- [ ] Its known weakness, dropped or garbled words on long sentences: split replies into sentences, or check with the already-loaded Whisper and regenerate; the build's choice, recorded.
- [ ] Environment: torch and torchaudio as CUDA 12.8 builds (`--index-url https://download.pytorch.org/whl/cu128`) for the RTX 5090; Chatterbox needs a warm-up (first call 12–20 s); write audio with `soundfile` (torchaudio.save wanted torchcodec); `coqui-tts[codec]` 0.28.0 plus `six`, torchcodec from the CPU index. Both ran on Python 3.11, untested on 3.13; `chatterbox-tts` and `coqui-tts` pin different torch/transformers, so check they fit one env or isolate them.
- [ ] Docs: `docs/home/voice/explanation/voice.md` (How It Works, Measurements, and Decisions replacing "Piper with es_ES-davefx-medium", dated 2026-11-16, owner's choices marked as the owner's), the voice how-to (env vars, model downloads, the Richtofen bundle as a manual step), and a short how-to for remaking the Richtofen model from `~/voice-lab/scripts` and `pipeline.sh` (BO3 `zone/snd/es/*.sabs` FLAC extraction, speaker clustering, Whisper transcripts, XTTS fine-tune).

**Acceptance:**
- Claude-run: `uv run python -m py_compile worker.py` in `home/voice/` and `npm run gate` in `home/bot/`; the worker starts with only the enabled voices loaded (VRAM read back) and speaks one sentence in each enabled voice to a file; measured per-sentence warm time and peak VRAM recorded (earlier: Chatterbox 2.6–4.5 s, about 4.2 GB; Richtofen 1.6–2.7 s, about 2 GB).
- Human-run: in a call, the owner hears each enabled voice, and a module's chosen voice.
- Reuse: the worker's Piper path and Whisper warm-up (`home/voice/worker.py`); `hearing.say` (`home/bot/src/hearing.ts`).
- Neighbors: `home/bot/src/sdk.ts`.
- Forbidden: the Richtofen model, its refs or any game audio in git; loading a voice that is not enabled.

**Touches:** `home/voice/`, `home/bot/src/hearing.ts`, `home/bot/src/sdk.ts`, `docs/home/voice/`, `docs/home/bot/explanation/bot.md`

## Ideas

### pkmn/site: a private Showdown tied to the site

A Pokémon Showdown server and client of the group's own, so a league or cup match needs no challenge sent: the site gives a link, both players sign in with their site account, see their site teams there with edits synced both ways in real time, and play a battle the site set up with their locked teams; the finished log is kept by the site, permanently, and the result recorded with it. Only worth it if replays stay as permanent as Showdown's saved replays. Showdown is open source; a server needs an always-on host (Vercel cannot hold its websockets). The [league](../pkmn/site/explanation/site.md#league) builds no stand-in for it: admins enter each game's result until this lands, and its [match page](../pkmn/site/explanation/site.md#league) is built so this can set up each game from the players' picks of six and report its finish. _(owner, 2026-10-27; the match page 2026-10-28)_

### pkmn/site: enforce a series' rules in team building

A series' rules are Markdown the site only shows ([The pkmn Site → Series](../pkmn/site/explanation/site.md#series)). Later, team building could hold teams to them (e.g. one legendary per team).

### pkmn/site: show only what a series' rules allow of others' PCs

Every PC at every snapshot was open to every player at first ([The pkmn Site → Decisions](../pkmn/site/explanation/site.md#decisions)). A series' rules may limit what a player sees of others' boxes (the league's box sheet), and the site could show only that. Left out of site v2. _(owner, 2026-10-22)_ The league already limits it: a player sees others' saves only up to their own round, and a closed round hides its snapshots until the match has a result ([The pkmn Site → Snapshots](../pkmn/site/explanation/site.md#snapshots), "Whose saves a reader sees"); this idea is what a series' rules allow beyond that.

### pkmn/site: read saves of games other than Añil

Any game can be created and downloaded, but the save upload reads Añil saves only ([Save Export](../pkmn/site/explanation/save-export.md)). A series played on another game needs an export for that game's saves. Left out of site v2 until such a series is planned. _(owner, 2026-10-22)_

### pkmn/site: an MCP server that acts as a site admin

An MCP server, signed in with easy auth, through which Claude acts as an administrator of the site: running the admin moves (players, games, series, the league's results and overrides) without driving the `/admin` pages in a browser. Today an admin is a username-and-password account made by `npm run admin:create` or the seed, the local test sign-in (`DEV_SIGN_IN`) signs in players only, and admin work by an agent goes through the Playwright MCP browser ([The pkmn Site → Accounts](../pkmn/site/explanation/site.md#accounts)). Unscoped: which environments it reaches (local, preview, production), what "easy auth" is and how it stays out of reach of anyone else, and which admin moves it exposes. _(owner, 2026-10-29)_

### dj: count skips against a song in autoplay

Explore seeds autoplay from the songs each listener asked for, weighted by how often ([The DJ Bot → Decisions](../dj/bot/explanation/bot.md#decisions)), and history saves a song when it starts, with no record of a skip. A song its requester, or the call, skipped quickly could weigh less as a seed, or be kept out of picks. Unscoped: what counts as a quick skip, whose skip counts, and whether it applies to Session too. Left out when Explore was built. _(owner, 2026-11-07)_

### home: take the sign-in tables out of pkmn's database

The shared sign-in (`home/site`) runs Better Auth over pkmn's `user`, `session`, `account` and `verification` tables, which pkmn's migrations own ([The Root Site](../home/site/explanation/site.md)), so every app's sign-in depends on pkmn's Neon project. The owner wants them decoupled (2026-11-15, scoping zombies-coach). About twenty pkmn tables reference `user` with foreign keys, and `admin`/`allowed` are pkmn's flags. Unscoped: a home Neon project owning the auth tables, and whether pkmn keeps a mirror of users for its foreign keys or drops them. Apps that sign in through `enbraile.vip/api/me` (DJ, zombies) need no change. _(owner, 2026-11-15)_

### zombies: the site as the hub of the group's runs

The zombies site becomes where the group's runs live: a history of every run, how many easter eggs the group has beaten, and each run open to review afterwards. Runs already stay open and are never closed for now, a map's view lists every attempt on it, and an attempt is marked beaten once every required step is done ([The Zombies Site → Decisions](../zombies/site/explanation/site.md#decisions)). Unscoped: whether the agent's reading of beaten is the one the group wants, what a history across maps shows, and what review adds over reading the run. _(owner, 2026-11-15)_
