# Zombies Site Design System

The visual system of `zombies/site/`: its tokens, type, layout shell, components and recurring patterns. For a screen not built yet the frozen boards in `zombies/site/design/` are the source of truth and this doc describes them; for one that is built the code is, and this doc changes in the same commit as it does, as pkmn's does ([pkmn Site Design System](../../../pkmn/site/reference/design-system.md)). Built so far: the header with the "Your run" pill, the maps list, a map's view with its open runs and Start a run, the join view, and a run's rail, transcript, composer, dispatch slips, transmitting row and Copy link (without the voice panel, the revision toggle, the slips' feedback or zones, which come with their features), with their loading, empty and error states, the tokens in `src/index.css` and the fonts bundled through `@fontsource`. The rules these screens follow are in [The Zombies Site → Decisions](../explanation/site.md#decisions).

## Boards

The third take keeps the radio log's identity (a run is a timestamped log, a hint is a typed dispatch slip, a level-3 zone is a marked survey sheet) and redraws it for reading at a glance mid-game: a warm dark theme, Atkinson Hyperlegible Next body text at 16–18px in sentence case, soft rounded cards, and the slip and survey sheet as the light cards on it. The owner asked for it on 2026-11-15, after finding the radio log's flow awkward and its UI hard to read ([The Zombies Site → Decisions](../explanation/site.md#decisions)), and does not review the boards themselves, to see the site as a surprise. They follow the `.dc.html` board format of `pkmn/site/design/`: one fixed-size frame per board, 1440×900 for desktop and 390×844 for a phone. The same boards sit on the "Third take" page of the Claude design canvas [Zombies Site](https://claude.ai/artifact/1C4DeEgm1B7vsMmP4DsXSu) under PascalCase names in `v3/` (`v3/Maps.dc.html`, `v3/RunZonePhone.dc.html`), which the boards' links use; the canvas's "First take" and "Radio log" pages keep the replaced boards. They never change; a later revision is drawn on the canvas and copied in again. Their maps (Harrow Station, Saltmarsh Asylum, Kessel Works), people, messages and hint text are made up, the plans are drawn shapes rather than any game's images, and their Google Fonts link stands for the bundled fonts.

| Board | Draws |
|-------|-------|
| `maps.dc.html`, `maps-phone.dc.html` | The maps list: one card per published map, the whole card a link to its view, with its plan, label, name and a line about its open runs |
| `map.dc.html`, `map-phone.dc.html` | A map's view: back to the maps, its label, name and plan, its open runs each with Join, and Start a run with the language Cari speaks, then the line naming the run the reader would leave |
| `start-run.dc.html`, `start-run-phone.dc.html` | A map's view with no open runs: "None open on this map." and Start a run |
| `join-run.dc.html`, `join-run-phone.dc.html` | The join view a shared link opens: whose run, the map and its plan, a card with its members and language and Join the run, the line naming the run the reader leaves, and a link to the map's other runs |
| `run.dc.html`, `run-phone.dc.html` | A run: the rail (the map, Cari's language, the members, Copy link and the voice panel), the log with Cari, a slip that has had More pressed once and feedback ticked, Cari transmitting, and the composer |
| `run-zone.dc.html`, `run-zone-phone.dc.html` | A level-3 slip with its zone on the survey sheet, and Cari on air |
| `run-revision.dc.html`, `run-revision-phone.dc.html` | The composer in revision mode, a sent revision and Cari's brief acknowledgement; the chrome in English while Cari speaks the run's Spanish |

The boards between them draw both languages: `maps`, `map`, `start-run` and `join-run` switch language between desktop and phone, `run` and `run-zone` are in Spanish (the run phone board's chrome in English) and `run-revision` in English. A reader's chrome follows their en/es switch, Cari's lines follow the run's language.

## Rules

- **The UI is never a hint.** No step or hint numbers, no count of hints given, no list of steps, no progress bar, and no button or suggestion that tells players what to try. A slip's only action is a generic **More**; its rungs are told apart by order and fading, never by number. The only counts shown are of maps on file and of a map's open runs.
- **One dark theme**, warm near-black ground with raised `surf` cards; the dispatch slip and the survey sheet are the only light cards. No glows, gradients or shadows; edges are 1px lines and inset rings.
- **Rounded, soft cards**: 12px for cards, large plans and run rows, 8px for buttons, options, a small plan's tile and the slip, a full pill for the "Your run" pill and circles for chips.
- **Tokens only** in the site's code, as in pkmn: every colour from a variable, no hex in components. The boards themselves write some values raw.
- **Sentence case** for every label, heading and button; condensed uppercase only for the wordmark and the big map titles.
- **No helper text** explaining the UI; labels name things. The composer's placeholder is the one sentence of prompt, and the line naming the run the reader leaves is the one sentence of consequence.
- **A log, no game's art or branding**: drawn plans, log rows, dispatch slips and survey sheets. No logos, characters, round counters or tally marks from any game.
- **Red is Cari, your run and the main action, blue is a revision, slip yellow is a hint.**
- **en/es chrome**, the switch in the header; Cari speaks the run's language.
- **Desktop and phone both designed**; the phone is not a squeezed desktop.

## Colour Tokens

| Token | Value | Role |
|-------|-------|------|
| `bg` | `#15140f` | The page ground |
| `surf` | `#1e1d16` | The header, cards, map and run rows, the run's rail, the composer's bar, the small plan on a phone's map view |
| `surf-2` | `#29281f` | Raised fills: chips, the pill, a map card's plan tile, the chosen language option, the composer's field, hovered rows |
| `line`, `line-2` | `#36342a`, `#4b483b` | Card edges and rules; the rings of chips, the pill, options and ghost buttons |
| `text`, `text-hi` | `#ede8dc`, `#fff` | Text; the default button's fill and its hover |
| `mute` | `#aca593` | Labels, times, secondary lines, earlier rows |
| `plan` | `#d6cfbf` | A plan's lines |
| `red`, `red-hi` | `#c23a20`, `#d4492e` | The main action (Start a run, Join the run, Bring Cari in) and its hover; the voice panel on air |
| `red-tx` | `#f27c60` | Red as text on the dark ground: Cari's name and mark, the wordmark's square, the pill's live dot, "You're in it", the transmitting caret |
| `on-red` | `#fff` | Text on `red` |
| `blue`, `blue-hi`, `blue-tx`, `blue-bg` | `#3a57c9`, `#4865d6`, `#9db0ff`, `#20263f` | A revision: the pressed toggle and Send, the sent line and its tag, the dashed composer |
| `slip`, `slip-ink`, `slip-hi`, `slip-mute`, `slip-line` | `#ebdfb0`, `#1b1a14`, `#000`, `#5b5443`, `#c9bb88` | A hint's dispatch slip: its ground, text and More button, More's hover, earlier rungs and the head's time, its dashed rules |

The boards also write white on `blue`, and the survey sheet's own inks, raw; they become tokens when those features are built. Members carry no colour of their own; a person is their initials chip, the reader's own filled `text`.

## Typography

| Face | Settings | Used for |
|------|----------|----------|
| Atkinson Hyperlegible Next | 400 and 700, 17px body at line-height 1.5 | Everything people read: names, messages, rungs, labels (700 15px `mute`), buttons (700 17–18px), headings (700 26px a map row's name, 22px a section) |
| Archivo, condensed | `font-stretch: 68%`, 800–900, uppercase, line-height 0.92 (`cond`) | The wordmark (900 26px), the maps title (96px, 64px phone), a map's name on its view and the join view (88px; on a phone 52px on the map view, 56px on the join view), the run's rail title (60px) and the phone run header (28px) |
| Courier Prime | 400, 700 | Times in the log, the slip's head ("Despacho", spaced uppercase, and "Cari · time"), the "transmitting" line |

Atkinson comes from `@fontsource-variable/atkinson-hyperlegible-next` (`wght`), Archivo from `@fontsource-variable/archivo`'s `wdth` axis, Courier Prime from `@fontsource/courier-prime`. Sizes on the boards: a message 17px at line-height 1.55, a rung 18px (an earlier rung 16px), names 16px, times 14px, a map row's line 16px (15px phone), notes 16px (15px phone).

## Layout Shell

- **Header**: `surf`, 64px (60px phone), a 1px `line` under it: the wordmark (a 10px `red-tx` square and `ZOMBIES`), then at the right the "Your run" pill, the language switch (`ES` `EN` in an 8px-rounded ring, the current one filled `text`) and the reader's initials chip. The pill shows on every screen outside a run once the reader's run is known: a live dot, "Your run" and the map's name with an arrow on desktop, "Your run" alone on a phone. The phone header has no name chip. Inside a run on a phone the wordmark gives way to a back arrow and the map's name, cut with an ellipsis; the wordmark's cell stays blank while a run's link loads, so nothing swaps once drawn.
- **Maps list**: one 880px column, 64px under the header (32px phone): the title with "N maps on file" at its right, then the map cards 16px apart (12px phone).
- **Map view and join view**: a 600px column and a 520px column 64px apart, centred, under a 32px top (12px on a phone's map view, 24px on its join view): at the left back to the maps, the label, the big name and the plan; at the right, starting level with the name, the sections. On a phone one column: the name with a small plan beside it on the map view, the plan full width on the join view, then the sections, 24px apart on the map view and 20px on the join view.
- **A run, desktop**: a 340px `surf` rail at the left (the map, Cari's language, the members with "you", Copy link, and the voice panel at its foot when built), the log to its right with the newest at the bottom on an 88px / up to 680px grid, and the composer in a `surf` bar under it.
- **A run, phone**: the run's header, a 52px strip with the member chips, Cari's language and the copy-link icon, the voice bar when built, the log with each name and time on one line, and the composer at the bottom.

## Spacing

Every padding, margin and gap is a step of one 4px scale, as `--sp-<n>` tokens in `src/index.css`, `<n>` counting fours: `--sp-1` 4px, `--sp-2` 8, `--sp-3` 12, `--sp-4` 16, `--sp-5` 20, `--sp-6` 24, `--sp-8` 32, `--sp-12` 48, `--sp-16` 64, `--sp-20` 80. The boards' in-between values (6, 10, 14, 18, 22px) are drawn at the nearest multiple of 8. Their few values under 4px, the language's 2px under "Cari speaks" on the join card and the chips' 3px gap, are drawn at 4px. Sizes (heights, widths, a button's minimum) are not spacing and stay in pixels, and so do the few offsets that line a baseline up: a message's or the transmitting line's 2px under its name, a log row's time, and the right column's 68px top on the map and join views, which starts it level with the name.

| Where | Desktop | Under 1180px | Phone |
|-------|---------|--------------|-------|
| Page edge | centred, at least 24px | 24px | 16px |
| Between cards in a list | 16px | 16px | 12px |
| Between sections, and blocks inside a card | 48px, 24px | the same | 24px, 16px |
| Inside a card | 24px | 24px | 16px |
| The run's rail, the log's sides | 24px, 48px | 24px, 24px | —, 16px |

## States

Every fetch, post and poll has a loading, an empty and an error state, as plain `mute` sentences in the place the content will take:

| State | Where | Shape |
|-------|-------|-------|
| Loading | The maps list, a map's view, a run's link, a log's first poll | "Receiving…" (`Recibiendo…`); the maps title keeps its line while the count waits |
| Empty | The maps list, a map's runs, a log | A dashed 12px card: "No maps on file yet.", "None open on this map."; a log says "Nothing on the log yet." On a map row, "No open runs" |
| Can't load | The maps list, a map's view, a run's link | "Can't reach the site right now." with a ghost Retry; a map or run that does not exist says "No such map on file." or "No such run on file." with a ghost Maps |
| Trouble in a run | Above the composer, under a 1px `line` | One line and a ghost Retry: "Can't reach the site right now." while polls fail (Retry polls at once), "Your line didn't go through." when a line was not stored (the line goes back into the composer, Retry sends it), "Cari didn't answer." when her reply failed (Retry sends the line again, or presses More again when the failed reply was a More) |
| Starting or joining failed | The map view's Start a run card and its open runs, the join view's card | "Can't reach the site right now." above the action; the action works again |
| Sending | The log | The reader's line shows at once in `mute` until the run stores it, then Cari's transmitting row follows |
| Copied | Copy link | The button reads "Link copied" (or "Couldn't copy") for 2 seconds, also said to screen readers |

Each request gives up after 10 seconds (20 for a reply to start streaming), so a hung server reads as an error rather than a page waiting forever. Buttons that post are disabled while their post runs, so a double click sends once. The log follows new lines only while the reader is at its foot; scrolled up to read, it stays put.

## Focus and Fit

- **Focus**: a 2px outline in the element's own text colour, 2px out, on keyboard focus only; a language option shows it around its whole label.
- **Touch targets**: every control is at least 44px in both directions.
- **Title fit**: a map's big name on its view and the join view, and the run's rail title, keep their board sizes and shrink, only when needed, until their longest word fits the column; words never break.

## Components

| Component | Board | Shape |
|-----------|-------|-------|
| Map card | `maps` | A `surf` card, 12px round, the whole card a link: the plan on a `surf-2` tile (140px wide, 96px phone), the label (Test map, or its game; the boards' made-up maps say "Sample") over the name in 700 26px (20px phone), the runs line, and a chevron. The runs line: one run's chips, "Marina's run" and its language, or "you're in it" in `red-tx` when it is the reader's (a phone shows the chips and the name, or "You're in it"); "N open runs" for more than one; "No open runs" for none |
| Plan | `maps`, `map`, `join-run` | A line drawing of the map's layout in `plan` at a constant stroke, 1.6px with 1px for the fine lines; large on a `surf` card with 32px around it, small on a `surf-2` tile in a map card, and on a `surf` tile ringed `line` beside the name on a phone's map view |
| Open run row | `map` | A `surf` card: member chips, "Nico's run" over its members and "Cari speaks English" (the language alone on a phone), and Join as a `text` button; the whole row joins at once. The reader's own run says "You're in it" in `red-tx` instead and opens the run |
| Start a run | `map`, `start-run` | A `surf` card: "Cari speaks" over two options side by side (Español first and chosen), each a radio ring and the language's own name, the chosen one ringed `text` on `surf-2`; then Start a run, full width in `red` |
| Leave line | `map`, `start-run`, `join-run` | A `mute` sentence under the actions naming, in bold `text`, the map of the run the reader leaves, since a person is in one run at a time; no step to confirm it |
| Join card | `join-run` | "In the run" with each member's chip and name (the starter marked "started it" on desktop), "Cari speaks" and the language, and Join the run full width in `red`; on a phone members and language sit in two columns. Under it the leave line and "See this map's other runs" |
| Your run pill | every screen outside a run | A `surf-2` pill ringed `line-2`: a `red-tx` dot, "Your run", and on desktop the map's name in `mute` and an arrow |
| Log row | `run` | The time in Courier at the left, the speaker's name in 700 16px (Cari in `red-tx` with a square before it), the message under it; earlier rows `mute` (built: all but the newest four). On a phone the time follows the name |
| Transmitting | `run` | Cari's row reads "transmitting" in Courier `mute` with a blinking `red-tx` block caret while her reply streams (built: her words replace it as they arrive, the caret after them), in the run's language |
| Dispatch slip | `run`, `run-zone` | `slip`, 8px round, up to 640px, under Cari's line, in Cari's language. Its head is Courier, "Despacho" spaced uppercase and "Cari · time", over a dashed rule; each rung given is an 18px paragraph, earlier rungs 16px in `slip-mute` parted by a dashed rule. The foot holds More as a `slip-ink` button with a down arrow (built: only while the ladder has a next rung below the answer, and only on its newest slip) and the three feedback pills under a hidden "Valora esta pista" legend (Demasiado obvia, Justa, Demasiado vaga; in English Too obvious, Right, Too vague), the ticked one filled `slip-ink`; on a phone More is full width over three feedback cells |
| Copy link | `run` | In the rail a full-width ghost button with a link icon; on a phone a 44px icon button at the strip's end |
| Zone | `run-zone` | Inside a level-3 slip under its text: the survey sheet (the map image the bundle carries, drawn on the boards as rooms with labels, a north mark and a title block) inset in the slip, the zone a hatched ellipse in red with one ring pulsing out from it |
| Voice panel | `run`, `run-zone` | Offer: a `surf-2` card at the rail's foot, "Voice channel", "You're in General" and Bring Cari in in `red`. On air: the panel turns `red`, "Cari is in General" and a bar meter moving. On a phone a 64px bar under the strip |
| Composer | `run` | A `surf` bar: a 56px field (52px phone) on `surf-2`, 10px round, ringed `text` on focus; the Revision toggle (a pencil and the word, the icon alone on a phone) and Send as a `text` button |
| Revision mode | `run-revision` | The toggle pressed `blue`; "Revision mode · For Claude" above in `blue-tx`, the field dashed `blue-tx` on `blue-bg`, Send in `blue`. A sent revision is the speaker's name in `blue-tx` with a "Revision" tag, the line on `blue-bg` and "re: Cari time · for Claude" in Courier; Cari answers it with one short line |

Motion: the transmitting caret, the voice meter and the zone's ring are the only animation, and stand still under `prefers-reduced-motion`. No sound cue accompanies a new hint ([The Zombies Site → Decisions](../explanation/site.md#decisions)).

## Icons

Round-capped 2–2.4px stroked line icons drawn in the boards: back, arrow, chevron, down-arrow on More, link, microphone, pencil. Cari's mark is a `red-tx` square before her name.
