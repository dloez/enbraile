# Zombies Site Design System

The visual system of `zombies/site/`: its tokens, type, layout shell, components and recurring patterns. For a screen not built yet the frozen boards in `zombies/site/design/` are the source of truth and this doc describes them; for one that is built the code is, and this doc changes in the same commit as it does, as pkmn's does ([pkmn Site Design System](../../../pkmn/site/reference/design-system.md)). Built so far: the header, the maps page with its run rows and the reader's run, the start-run sheet, the join page, and a run's rail, transcript, composer, dispatch slips and transmitting row (without the voice panel, the revision toggle, the slips' feedback or zones, which come with their features), with the tokens in `src/index.css` and the fonts bundled through `@fontsource`. The rules these screens follow are in [The Zombies Site → Decisions](../explanation/site.md#decisions).

## Boards

The look is the group's radio log: a run is a timestamped transcript, a hint is a typed dispatch slip, a level-3 zone is a marked survey sheet. The owner chose it over a first take of dark stencil boards on 2026-11-15 ([The Zombies Site → Decisions](../explanation/site.md#decisions)), and does not review the boards themselves, to see the site as a surprise. They follow the `.dc.html` board format of `pkmn/site/design/`: one fixed-size frame per board, 1440×900 for desktop and 390×844 for a phone. The same boards sit on the "Radio log" page of the Claude design canvas [Zombies Site](https://claude.ai/artifact/1C4DeEgm1B7vsMmP4DsXSu) under PascalCase names in `v2/` (`v2/Maps.dc.html`, `v2/RunZonePhone.dc.html`), which the boards' links use; the canvas's "First take" page keeps the replaced boards. They never change; a later revision is drawn on the canvas and copied in again. Their maps (Harrow Station, Saltmarsh Asylum, Kessel Works), people, messages and hint text are made up, the plans are drawn shapes rather than any game's images, and their Google Fonts link stands for the bundled fonts.

| Board | Draws |
|-------|-------|
| `maps.dc.html`, `maps-phone.dc.html` | The maps list: the reader's own run, then one row per published map with its plan, its open runs and Start a run |
| `start-run.dc.html`, `start-run-phone.dc.html` | Start a run: the map, the language Cari speaks (Spanish first), and the run the reader leaves; a sheet from the right, a bottom sheet on a phone |
| `join-run.dc.html`, `join-run-phone.dc.html` | Join a run opened from its link: the map and its plan, then the run sheet (who started it, its members, its language) and the run the reader leaves |
| `run.dc.html`, `run-phone.dc.html` | A run: the transcript with Cari, a slip that has had "more" pressed once and feedback ticked, Cari transmitting, and the offer to bring Cari into the reader's voice channel |
| `run-zone.dc.html`, `run-zone-phone.dc.html` | A level-3 slip with its zone on the survey sheet, and Cari on air |
| `run-revision.dc.html`, `run-revision-phone.dc.html` | The composer in revision mode, a sent revision and Cari's brief acknowledgement; the chrome in English while Cari speaks the run's Spanish |

The boards between them draw both languages: `maps`, `start-run` and `join-run` switch language between desktop and phone, `run` and `run-zone` are in Spanish and `run-revision` in English. A reader's chrome follows their en/es switch, Cari's lines follow the run's language.

## Rules

- **The UI is never a hint.** No step or hint numbers, no count of hints given, no list of steps, no progress bar, and no button or suggestion that tells players what to try. A slip's only action is a generic **More**; its rungs are told apart by order and fading, never by number. The only counts shown are of maps on file.
- **One light theme**, flat ink on `paper`. No glows, gradients, drips, grain or silhouettes; no shadows at all.
- **Square corners everywhere.** Edges are 1px `ink` rules, 1.5px for buttons and options, 2–3px for a section's end.
- **Tokens only** in the site's code, as in pkmn: every colour from a variable, no hex in components. The boards themselves write some values raw.
- **No helper text** explaining the UI; labels name things. Placeholders in the composer are the one sentence of prompt.
- **A radio log, no game's art or branding**: typed labels, transcript rows, dispatch slips and survey sheets. No logos, characters, round counters or tally marks from any game.
- **Red is Cari and the main action, blue is a revision, slip yellow is a hint, ink marks what is chosen or yours.**
- **en/es chrome**, the switch in the header; Cari speaks the run's language.
- **Desktop and phone both designed**; the phone is not a squeezed desktop.

## Colour Tokens

Five flat inks (`paper`, `ink`, `red`, `blue`, `slip`) and the tints of each.

| Token | Value | Role |
|-------|-------|------|
| `paper` | `#e9e4d7` | The page ground |
| `sheet` | `#f4f0e6` | Plans and survey sheets, the run sheet and the start-run sheet |
| `slip` | `#efe3ad` | A hint's dispatch slip |
| `ink` | `#15140f` | Text, rules, the header bar, the run's rail, the default button, a chosen option |
| `ink-2` | `#2e2b23` | The ink button's hover |
| `mute` | `#5d584d` | Labels, times, placeholders, earlier rows and rungs |
| `rule` | `#c9c1ae` | Light rules between rows; the revision toggle's resting edge |
| `red`, `red-hi` | `#c4321a`, `#d94427` | Cari (her name and mark, her chip, the zone's ring, the transmitting caret), the main action (Start a run, Join the run, Bring Cari in) and its hover, "You're in it", the voice panel on air, the wordmark's square |
| `blue` | `#2945a8` | A revision: the pressed toggle, the dashed composer, Send, the sent line; the plans' grid at 22% |
| `on-ink`, `on-ink-mute`, `ink-rule` | `#ece7da`, `#a8a293`, `#3b382f` | Text, labels and rules on `ink`: the header, the rail, the phone's voice bar |
| `on-red` | `#fff` | Text on `red`: the main action |
| `scrim` | `rgba(233,228,215,.8)` | The `paper` scrim behind the start-run sheet |
| `hover` | `rgba(21,20,15,.08)` | The hover tint of a bare control, such as the sheet's close |

The boards also write a few values raw that become tokens when built: white on `blue`, the blue button's hover `#1f378c`, and the feedback boxes' hover tint `rgba(21,20,15,.07)`. Members carry no colour of their own; a person is their initials chip.

## Typography

| Face | Settings | Used for |
|------|----------|----------|
| Archivo, condensed | `font-stretch: 62%`, 800–900, uppercase, line-height 0.86 (`cond`) | The wordmark, page and map titles, names in the transcript, Cari on air, the slip's "Despacho" |
| Archivo | 100% width, 600–700 | Running text, members' names, buttons (700 13px, uppercase, `0.1em` tracking) |
| Courier Prime | 400, 400 italic, 700 | Labels (700 12px, uppercase, `0.09em`, `mute`), chips, times, the language switch, a rung's text, the composer, "— none open —" in italic |

Archivo comes from `@fontsource-variable/archivo`'s `wdth` axis (62–125%), Courier Prime from `@fontsource/courier-prime`. Sizes on the boards: the maps title 128px (84px phone), a map name in its row 66px (34px phone), the join title 172px (80px phone), the start-run sheet's title 104px (64px phone), the run's rail title 76px; transcript names 19px (16px phone), body 16px (15px phone), a rung 17px at line-height 1.5 (15px phone), an earlier rung 15px, labels 12px, chips 11px, times 13px (11px phone).

## Shape

Everything is square. Cards are not boxes but rows parted by rules: 1px `ink` between map rows and a 3px `ink` rule after the last (as the boards' CSS means it; the desktop board's footer keeps that rule from applying, the phone board shows it), 1px `rule` between transcript rows. Plans and sheets are `sheet` inside a 1px `ink` frame. Buttons are at least 44px high (48–60px in a sheet or on a page's foot), square, filled `ink`, `red` or `blue`, or outlined with an inset 1.5px `ink` edge that fills on hover. Chips (`cs`) are 22px high, at least 30px wide, with a 1px border in the text's colour: the reader's own chip filled `ink`, Cari's filled `red`. No shadows.

## Layout Shell

- **Header**: `ink`, 48px, cells parted by 1px `ink-rule`: the wordmark (a 9px red square and `ZOMBIES` in condensed 900 26px), the tag "Radio log · enbraile.vip" (desktop only), then at the right the language switch as two cells, `ES` and `EN`, the current one filled `on-ink`, and the reader's name in a filled chip. Inside a run on a phone the wordmark gives way to a back arrow to the maps and the map's name.
- **Maps page, desktop**: a 400px column at the left with "N maps on file" and the 128px title, and the reader's run at its foot; the list to its right under a 40px column heading (Plan, Map, Open runs) on a 140px / flexible / 400px grid, ending "End of file · enbraile.vip". Built with a 300px column and narrower grid under 1180px.
- **Maps page, phone**: the title with "N maps on file" at its right over a rule, the reader's run as an `ink` band, then each map: its label and name with the plan (72px) at the right, its runs below.
- **A run, desktop**: a 320px `ink` rail at the left (the run's language, the map's name, the members as rows with VOICE beside each one in the call, and the voice panel at its foot) and the transcript to its right: a heading row (Time, From, Transcript · map, the date), rows on a 100px / 128px / up to 700px grid with the newest at the bottom and earlier rows in `mute`, and the composer under them.
- **A run, phone**: the run's header, a strip of member chips and the language, the voice panel as a 56px `ink` bar, the transcript as rows of time and message, and the composer at the bottom.
- **Sheets**: Start a run slides in from the right as a 540px `sheet` panel with a 2px `ink` left edge over a `paper` scrim; on a phone a bottom sheet with a 3px `ink` top edge, its buttons stacked with the main one on top. Join a run is a page: the title and plan at the left, a 500px run sheet at the right.

## Components

| Component | Board | Shape |
|-----------|-------|-------|
| Map row | `maps` | The plan, the map's label (Test map, or its game; the boards' made-up maps say "Sample") over its condensed name, and the open runs: one run row each or "— none open —", then Start a run outlined at the foot |
| Plan | `maps`, `join-run`, `start-run` | A line drawing of the map's layout in `ink` on `sheet`; larger plans add the blue 20px grid, room labels in Courier and a title block at the bottom right. Built, the join page's plan is the map's row plan drawn large over the blue grid, without room labels or title block, since a bundle carries only its `art` key |
| Run row | `maps` | Member chips, the starter's name, the language chip, and Join outlined; the reader's own run says "You're in it" in red instead |
| Your run | `maps` | Desktop: under a 3px rule at the column's foot, "Your run", the map's name, member chips and language, and Back to the run as an ink button. Phone: an `ink` band with "Your run · ES", the name and an arrow |
| Language choice | `start-run` | Stacked options under "Cari speaks", each a tick square, the code (`ES`, `EN`) and the language's own name; the chosen one filled `ink`; Español first and chosen |
| Note | `start-run`, `join-run` | A 1px `ink` frame with an `ink` key cell ("Note") and the line naming the run the reader leaves, since a person is in one run at a time |
| Run sheet | `join-run` | A definition list: Started by, In the run, Cari speaks, each value with its chip |
| Transcript row | `run` | Time in Courier, the speaker's name condensed (Cari in red with a red square before it), the message; earlier rows `mute` (built: all but the newest four) |
| Transmitting | `run` | Cari's row reads "transmitting" in Courier `mute` with a blinking red block caret while her reply streams (built: her words replace it as they arrive, the caret after them), in the run's language |
| Dispatch slip | `run`, `run-zone` | `slip` in a 1px `ink` frame, up to 640px, under Cari's line. It follows Cari's language, so every board draws it in Spanish. Its head reads "Despacho" and "Cari · time"; each rung given is a Courier paragraph, earlier rungs smaller in `mute`, parted by a dashed rule. The foot holds More as an ink button (built: only while the ladder has a next rung below the answer, and only on its newest slip) and the three feedback tick boxes under a hidden "Valora esta pista" legend (Demasiado obvia, Justa, Demasiado vaga; in English Too obvious, Right, Too vague), the ticked one filled `ink`. On a phone the feedback sits as three cells under More |
| Zone | `run-zone` | Inside a level-3 slip under its text: the survey sheet (the map image the bundle carries, drawn on the boards as rooms on the blue grid with Courier labels, a north mark and a title block), the zone an ellipse hatched in `red` with one red ring pulsing out from it |
| Voice panel | `run`, `run-zone` | Offer: "Voice channel", "You're in General" condensed, and Bring Cari in in red. On air: the panel turns `red`, "On air", "Cari is in General" and a bar meter moving; Cari joins the members with a red chip and VOICE |
| Composer | `run` | Under a 2px `ink` rule: "TX →", a bare Courier field, the Revision toggle (a square and the word) and Send in ink |
| Revision mode | `run-revision` | The toggle pressed `blue`; a "Revision mode · For Claude" line above, the rule dashed `blue`, "REV →", the placeholder "Comment on the coaching…", Send in `blue`. A sent revision is the speaker's name in blue with "Revision" under it, the line in blue Courier behind a blue left rule, and "↑ re: Cari time · for Claude"; Cari answers it with one short line |

Motion: the transmitting caret, the voice meter and the zone's ring are the only animation, and stand still under `prefers-reduced-motion`. No sound cue accompanies a new hint ([The Zombies Site → Decisions](../explanation/site.md#decisions)).

## Icons

Square-capped 2–2.4px stroked line icons drawn in the boards: back, arrow, close, down-arrow on More. Cari's mark is a red square before her name.
