# Zombies Site Design System

The visual system of `zombies/site/`: its tokens, type, layout shell, components and recurring patterns. For a screen not built yet the frozen boards in `zombies/site/design/` are the source of truth and this doc describes them; for one that is built the code is, and this doc changes in the same commit as it does, as pkmn's does ([pkmn Site Design System](../../../pkmn/site/reference/design-system.md)). Built so far: the header and the maps page's map cards, with the tokens in `src/index.css` and the fonts bundled through `@fontsource`. Why the site has these screens is in [Zombies Coach → Runs and the site](../../../work-in-progress/zombies-coach/discovery.md#runs-and-the-site).

## Boards

The boards were drawn by Claude on 2026-11-15 from the brief's constraints alone, and the owner chose not to review them, to see the site as a surprise. They follow the `.dc.html` board format of `pkmn/site/design/`: one fixed-size frame per board, 1440×900 for desktop and 390×844 for a phone. They never change; a later revision is drawn and copied in again. Their maps (Harrow Station, Saltmarsh Asylum, Kessel Works), people, messages and hint text are made up, the map art and the zone's floor plan are drawn shapes rather than any game's images, and their Google Fonts link stands for the bundled fonts.

| Board | Draws |
|-------|-------|
| `maps.dc.html`, `maps-phone.dc.html` | The maps list: the reader's own run, then one card per published map with its runs to join and Start a run |
| `start-run.dc.html`, `start-run-phone.dc.html` | Start a run: the map, the run's language (Spanish first), and the run the reader leaves; a dialog, a bottom sheet on a phone |
| `join-run.dc.html`, `join-run-phone.dc.html` | Join a run opened from its link: the map, who started it, its members and language, the run the reader leaves |
| `run.dc.html`, `run-phone.dc.html` | A run: the shared chat with Cari, a hint card that has had "more" pressed once and feedback chosen, Cari writing, and the offer to bring Cari into the reader's voice channel |
| `run-zone.dc.html`, `run-zone-phone.dc.html` | A level-3 card with its zone on the map, and Cari in the call |
| `run-revision.dc.html`, `run-revision-phone.dc.html` | The composer in revision mode, a sent revision and Cari's brief acknowledgement; the chrome in English while Cari speaks the run's Spanish |

The boards between them draw both languages: `maps`, `start-run` and `join-run` switch language between desktop and phone, `run` and `run-zone` are in Spanish and `run-revision` in English. A reader's chrome follows their en/es switch, Cari's lines follow the run's language.

## Rules

- **The UI is never a hint.** No step or hint numbers, no count of hints given, no list of steps, no progress bar, and no button or suggestion that tells players what to try. A hint card's only action is a generic **More**; its rungs are told apart by order and fading, never by number.
- **One dark theme**, the `ground` near-black under a teal fog at the top left and a blood glow at the bottom right, with a faint film grain.
- **Tokens only** in the site's code, as in pkmn: every colour from a variable, no hex in components. The boards themselves write some values raw.
- **No helper text** explaining the UI; labels name things. Placeholders in the composer are the one sentence of prompt.
- **A Zombies mood, no game's art or branding**: stencil type, drips under the header line, dusk silhouettes drawn as flat shapes, a radio for Cari. No logos, characters, round counters or tally marks from any game.
- **Red marks where you are and the main action, mint what you can act on, amber is Cari, paper is a hint, dashed note-gold is a revision.**
- **en/es chrome**, the switch in the header; Cari speaks the run's language.
- **Desktop and phone both designed**; the phone is not a squeezed desktop.

## Colour Tokens

### Surfaces

| Token | Value | Role |
|-------|-------|------|
| `ground` | `#0b0e0d` | The page ground, under the fog and grain |
| `fog` | `#123029` (drawn as `rgba(32,86,74,0.42)`) | The teal fog at the top left |
| `ink` | `#070908` | The header bar; text on mint and on bright avatars |
| `panel` | `#121816` | Cards, dialogs, sheets, the voice panel |
| `panel-hi` | `#18201e` | A player's message bubble; an icon button's hover |
| `well` | `#090c0b` | Inset: run rows, the composer, segmented tracks |
| `line` | `#24302c` | Borders |
| `line-hi` | `#37483f` | Stronger borders: dialogs, chips, the sheet's grabber |
| `scrim` | `rgba(3,5,4,0.72)` with a 2px blur | Behind dialogs and sheets |

### Text

| Token | Value | Role |
|-------|-------|------|
| `bone` | `#ebe5d6` | Body text, headings |
| `ash` | `#a3aba4` | Secondary text: names in rows, icons |
| `dim` | `#6c7871` | Labels, times, placeholders |

### Signal colours

| Token | Value | Role |
|-------|-------|------|
| `blood`, `blood-hi` | `#c3302a`, `#de4339` | The header's bottom line and drips, the chosen segment, the go button (Start a run) and its hover; `.enbraile.vip` in `blood-hi` |
| `mint`, `mint-hi`, `mint-ink` | `#7fe3c4`, `#a6f0d9`, `#062019` | What you can act on: Join, Bring Cari in, Send; the reader's own run row's border and "You" chip |
| `amber`, `amber-dim` | `#f0b23c`, `#5c4416` | Cari: her avatar's ring and radio, her name, her bubbles' tint, the reader's-run banner, Cari in the call, a hint card's tape, the zone |
| `paper`, `paper-ink` | `#e6dcc0`, `#211c12` | A hint card's face and its text, the More button's face |
| `note` | `#d8c48d` | A revision: the composer's dashed border and send button in revision mode, a sent revision's dashed bubble and chip |

### Built-only tokens

`src/index.css` adds tokens for values the boards write raw: `blood-glow` (the bottom-right glow), `chip-ground` (a tag chip over map art), `quiet`, `quiet-hi` and `edge` (the quiet button, its hover and its dark bottom edge), `title-shadow`, and the art tints `teal-*`, `rust-*` and `furnace-*` for the map silhouettes.

### People

Each member's avatar is a filled circle in their own colour with their initial in `ink`. Board colours: `#f0b23c`, `#7fe3c4`, `#e58ab0`, `#9fb6ff`, `#c7e36b`, as tokens `person-1` to `person-5`; the site assigns them per person.

## Typography

| Face | Weights | Used for |
|------|---------|----------|
| Saira Stencil One | 400 | The `stencil` face: the wordmark, page titles, map names, buttons, More |
| IBM Plex Sans | 400–700 | Running text, messages, hint text, names |
| IBM Plex Mono | 500, 600 | `.enbraile.vip`, the language switch, labels (uppercase, `0.12em` tracking), chips, times |

Sizes on the boards: the maps page title 76px (52px phone); a map name on its card 40px (34px phone), on a run's rail 36px, on the join card 54px (40px phone); a dialog title 38px (32px sheet); buttons 19px (17px small); body and messages 16px; hint text 17px at line-height 1.55; labels 12px, chips 11px, times 11px.

## Shape

Cards and the rail's voice panel are `panel` with a 2px `line` border, 16px radius (14px for the voice panel, the composer and banners, 12px for run rows and wells). Buttons are 8px radius, `min-height` 44px (38–40px small), with a 4px dark inset bottom edge. A hint card is 4px at its top left and 14px elsewhere, like a chat bubble, with a 6px dark drop under it. Chips are pills, 24px high. Shadows: only the buttons' bottom edge, the hint card's drop, and a dialog's 18px drop.

## Layout Shell

- **Header**: `ink`, 64px (60px phone), a 3px `blood` bottom line with four drips hanging from it. Desktop: the wordmark `zombies` in stencil 30px with `.enbraile.vip` in mono, then at the right the language switch (`EN ▾`, mono, bordered, 40px) and the reader's avatar. Phone: the wordmark, the switch and a menu button (built with the reader's avatar in its place until the menu has something to hold); inside a run the wordmark gives way to a back arrow to the maps and the map's name.
- **Pages**: the maps page in a 64px gutter (16px phone), a three-column grid of map cards with their tops aligned; on a phone one column.
- **A run, desktop**: a 320px rail at the left (the map's art and name with the run's language chip, the members with a headset beside each one in the call, and the voice panel at the bottom) and the chat in an 820px column to its right, newest at the bottom, the composer under it. Older messages fade out at the top of the column.
- **A run, phone**: the run's header, a strip with the members' stacked avatars and the run's language, the voice panel as a slim bar under it, the chat, and the composer at the bottom.
- **Dialogs**: centred, 560px, a 4px `blood` top border; on a phone a bottom sheet with a grabber and a 3px `blood` top line, its buttons stacked with the main one on top.

## Components

| Component | Board | Shape |
|-----------|-------|-------|
| Map card | `maps` | The map's art (260px, 150px phone) with a mono tag chip at its top left and the name in stencil over its foot; under it a Runs label, one run row each or a dashed "No runs yet", and Start a run in `blood` at the foot (built without Start a run until runs exist) |
| Run row | `maps` | A `well` row: the members' stacked avatars, the starter's name, the run's language chip, and Join in mint; the reader's own run has a mint border, a "You" chip and an arrow button instead |
| Your-run banner | `maps` | An amber-tinted band with Cari's radio, "Your run" and the map's name, then the members and Back to the run on desktop, an arrow alone on a phone, above the cards |
| Language choice | `start-run` | A segmented control: each option a mono code chip (`ES`, `EN`) and the language's own name; Español first and chosen |
| Leave note | `start-run`, `join-run` | An amber-bordered note naming the run the reader leaves, since a person is in one run at a time |
| Message | `run` | Avatar (40px), name and time above a bubble; a player's bubble `panel-hi`, Cari's amber-tinted with an amber-ringed radio avatar that glows faintly |
| Writing indicator | `run` | Three amber dots blinking in Cari's bubble while her reply streams |
| Hint card | `run`, `run-zone` | Paper, under Cari's line, an amber strip of tape at its corner. Each rung given is a paragraph; earlier rungs fade and a dashed rule parts them. The foot holds More and the three feedback chips (Too obvious, Right, Too vague; Demasiado obvia, Justa, Demasiado vaga), the chosen one filled `paper-ink`. On a phone the card runs under the avatar to the screen's gutter and the chips wrap under More |
| Zone | `run-zone` | Inside a level-3 card under its text: the map image framed in `paper-ink`, the zone an amber dashed circle filled with amber hatching, one ring pulsing out from it. The boards' floor plan is drawn rooms on a mint grid, standing for the map image the bundle carries |
| Voice panel | `run`, `run-zone` | Offer: a headset, "You're in General" and Bring Cari in in mint. In the call: an amber band with Cari's radio, "Cari is in General" and a moving waveform. Members in the call carry a headset in the rail |
| Composer | `run` | A `well` field, a revision toggle (a note icon) and Send in mint |
| Revision mode | `run-revision` | The toggle pressed: a "Revision mode" chip above, the composer's border dashed `note`, the placeholder "Comment on the coaching…", Send in `note`. A sent revision is a dashed `note` bubble with a "Revision · For Claude" chip, and Cari answers it with one short line |

Motion: the writing dots, the waveform and the zone's ring are the only animation, and stand still under `prefers-reduced-motion`. No sound cue accompanies a new hint ([Zombies Coach → Voice](../../../work-in-progress/zombies-coach/discovery.md#voice)).

## Imagery and Icons

Each map gets a dusk silhouette of flat shapes (a moon, a roofline, a fence) in its own tint: teal, rust or furnace amber. Icons are 2.2–2.6px stroked line icons drawn in the boards: back, arrow, plus, close, menu, chevron, send, note, headset, down-arrow. Cari's mark is a radio: a dot with two pairs of arcs, the outer pair fainter.
