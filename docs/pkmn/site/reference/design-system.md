# Site Design System

The visual system of `pkmn/site/`: its tokens, type, layout shell, components and recurring patterns. The code is the source of truth: the tokens in `src/index.css`, the shell in `src/router.tsx`, `src/components/site-shell.tsx` and `src/components/site-header.tsx`, and the components named below. The values come from the frozen boards in `pkmn/site/design/`. This doc describes them and changes in the same commit as they do (`pkmn/site/CLAUDE.md`). Why the site looks this way is in [The pkmn Site → Look](../explanation/site.md#look). Adding a page is in [How to Add a Page to the Site](../how-to/add-a-page-to-the-site.md).

## Rules

- **One dark theme.** `index.html` sets `class="dark"` and `color-scheme: dark`; there is no light theme and no theme switch.
- **Tokens only.** Every colour comes from a CSS variable in `src/index.css`'s `:root`, used through its Tailwind token (`bg-card`, `text-primary`, `border-cell-hi`…) or, where a class cannot reach it (inline `style`, canvas, SVG built in code), as `var(--name)`. No hex, `rgb()` or Tailwind palette classes (`bg-red-500`) in components.
- **No helper text** explaining the UI. Labels name things; they do not instruct. A legend is a key only: each colour, shading or symbol and the few words it stands for, never prose on how it is computed.
- **English UI**, with Showdown's names.
- **Desktop-first, every view usable on a phone.**
- **No outside runtime calls** beyond Showdown's sprites (the site's own `/api` aside): fonts are bundled from Fontsource, type icons from `src/lib/type-icons.ts`, pixel art drawn in code.
- **Red marks where you are, cyan what you can act on, yellow you and winners, amber a warning that never blocks.**

## Colour Tokens

All in `src/index.css`'s `:root`; Tailwind sees each as `--color-<name>` through `@theme inline`. A token that shares another's colour but has a role of its own is declared as an alias (`--primary: var(--cyan)`), so each colour is written once.

### Surfaces

| Token | Value | Role |
|-------|-------|------|
| `background` | `#161b26` | The navy ground; `body` draws a `dot` grid on it (1.5px dots every 20px). The active file tab, which merges into the page |
| `dot` | `#232b3c` | The ground's dot grid |
| `ink` | `#10141d` | The darkest navy: the header bar, a badge's border, text on a bright fill |
| `muted` | `var(--ink)` | Inset wells: segmented-control tracks, inputs (`fieldClass`), stat-bar tracks, inline rename fields |
| `card` | `#222a3b` | Panels, cards, the summary aside, dialogs and sheets; an inactive tab's hover |
| `popover` | `var(--card)` | shadcn's dialog and sheet default surface |
| `box` | `#1b2232` | The PC box and team strip, the recessed area a grid of cells sits in; icon tiles |
| `cell` | `#2c3549` | A cell inside a box; a lift card's resting border |
| `cell-hi` | `#44506d` | A selected cell; empty slot outlines |
| `secondary` | `var(--cell)` | Pill tags; the analysis panels' bar tracks and the pool histogram's bars |
| `accent` | `color-mix(in srgb, var(--cyan) 22%, var(--card))` | Cyan-tinted fill for a chosen option: the current ability |
| `face`, `face-hi` | `rgba(255,255,255,0.1)`, `0.18` | The quiet button's translucent face and its hover |
| `edge` | `rgba(0,0,0,0.35)` | The quiet button's dark bottom edge |
| `drop` | `#0a0d14` | The shadow under a lifted card |
| `scrim` | `rgba(0,0,0,0.6)` | Behind dialogs and sheets (`bg-scrim`) |

### Text and lines

| Token | Value | Role |
|-------|-------|------|
| `foreground` | `#eef1f7` | Body text; `card-`, `popover-`, `secondary-` and `accent-foreground` are aliases of it |
| `white` | `#ffffff` | Text on red (the open tab, the chosen segment) and on the quiet button; hovered tabs |
| `subtle` | `#c3cad8` | Inactive tabs and segments |
| `muted-foreground` | `#a3acbf` | Secondary text: labels, counts, table headers. Faded with `/40`–`/60` for zero values |
| `border` | `#343f58` | Every border, slate (set as the default border colour in `@layer base`); `input` is an alias of it |
| `ring` | `var(--cyan)` | Focus ring, always used as `ring-3 ring-ring/50` |

### Signal colours

| Token | Value | Role |
|-------|-------|------|
| `red` | `#d93a30` | Where you are: the header's bottom line, the open tab, the chosen `Segmented` option; the go button's face |
| `red-hi` | `#ef5148` | The go button's hover |
| `cyan` | `#5ad1f0` | What you can act on |
| `primary` | `var(--cyan)` | Selection borders, a lift card's hover border, a pressed `Toggle`'s fill, links' arrows, a nature's raised stat, the top value of a bar |
| `primary-foreground` | `var(--ink)` | Text on `primary` |
| `yellow` | `#ffd34d` | You and winners |
| `green` | `#7be08a` | The good side, through `chart-2` |
| `destructive` | `#ff6a5e` | Errors, refusals, unknown marks (`?`), weaknesses, delete actions |
| `destructive-soft` | `color-mix(in srgb, var(--destructive) 20%, var(--card))` | Fill behind an error or a weakness cell |
| `warning` | `#ffc878` | Amber, a soft warning that never blocks: its border and icon (a snapshot about to be replaced) |
| `warning-soft` | `#3b3530` | Fill behind a warning |
| `warning-ink` | `#ffe2b8` | A warning's text |
| `chart-1` | `var(--cyan)` | Series 1 |
| `chart-2` | `var(--green)` | The "good for us" side: resistances, super-effective coverage, a nature's lowered stat, speed bars, series 2 |
| `chart-3` | `var(--subtle)` | Neutral: ordinary bars, coverage lines, tag text, series 3 |
| `chart-4` | `var(--destructive)` | Series 4 |

Scales of one hue are built with opacity on the token (`bg-chart-2/10`, `/15`, `/25`, `/35`, `/40`; `bg-destructive/45`) or, for a continuous value, `color-mix(in oklch, var(--chart-2) N%, transparent)`.

### Players

`player-1` to `player-6`: yellow (`var(--yellow)`), cyan (`var(--cyan)`), green (`var(--green)`), coral (`var(--coral)`, `#ff8a80`), `#c39bff`, orange (`var(--orange)`, `#ffb347`). `coral` and `orange` are declared on their own because the scenes share them; `coral` is also a utility (`text-coral`), a series' fallen count on a profile's banner. Each player draws in one, through `PlayerBadge`.

### Sign-in

| Token | Value | Role |
|-------|-------|------|
| `blush` | `#ffd6d2` | `.enbraile.vip` on the sign-in and waiting pages' red half |
| `discord` | `#5865f2` | Discord's blurple, the Discord button's fill and nowhere else |
| `discord-edge` | `#8891f7` | The Discord button's border |
| `discord-hi` | `#6d78f5` | The Discord button's hover and focus fill |

### Series

| Token | Value | Role |
|-------|-------|------|
| `faint` | `#6b7489` | A value not there yet ("—"), the barrier's feet |
| `row-hi` | `#283146` | A trainer row's hover and its open state |
| `round` | `#c12d24` | A league round: the "Round N" tag, and at `/10` the tint of its column |
| `round-ink` | `#ffb0a8` | A round milestone's name |
| `round-dim` | `#7a3a36` | A round's node not reached yet |
| `trophy`, `trophy-rim` | `#2a2416`, `#8a7330` | The tournament node's disc and rim, around a `yellow` cup |

### Scenes

`scene-night-*` and `scene-route-*`, in `src/index.css`, are the colours of the two series scenes, used by `SceneArt` as `var(--scene-…)` fills and, for the ground, title shadow, chips and game box over a scene, through `SCENE_LOOK` (`bg-scene-night-panel`, `text-scene-night-sparkle`…). Night: five sky bands `sky-1`–`sky-5` (`#0d1430`…`#223262`), `star` (`var(--white)`), `star-dim`, `sparkle`, `moon`, `crater`, the `far` and `near` hills, `window` (`var(--yellow)`) and `lamp` (`var(--orange)`), plus `shadow` (the title's drop), `panel` (`rgba(10,16,38,0.8)`), `panel-edge` and `panel-sub`. Route: four sky bands `sky-1`–`sky-4`, `cloud` (`var(--white)`), `cloud-shade`, `hills`, `grass`, `grass-hi`, `tree`, `tree-hi`, `tree-shade`, `trunk`, `path`, `path-hi`, `path-edge`, the flowers (`flower` white, `flower-red` `var(--coral)`, `flower-heart` `var(--yellow)`), `panel` (`rgba(255,255,255,0.88)`) and `panel-sub` (`var(--ink)`). They are used only over a scene.

### Pixel art

`pixel-rim` `#4a5470` and `pixel-red` `#e3403a` (the Poké Ball's outline and top), `pixel-case` `#3a4150` and `pixel-notch` `#2c3240` (the cartridge), used only by `PixelIcon`, beside `white`, `red` and `yellow`.

### Types

`--type-<type>` for the 18 types, lower-case (`--type-fire: #e62829`…), used only through `var(--type-${type.toLowerCase()}, var(--muted-foreground))`. Values are in `src/index.css`.

## Typography

Two typefaces, bundled from Fontsource, with `font-synthesis: none` so the pixel face is never faux-bolded:

| Class | Font | Weights loaded | Used for |
|-------|------|----------------|----------|
| `font-heading` | Jersey 10 | 400 | The pixel face: headings, labels, tabs, buttons, segments, big numbers, Pokémon names on cards and summaries |
| `font-sans` (default) | Nunito | 400, 500, 600, 700, 800 | Running text, tables, fields |

Numbers in running text and tables take `tabular-nums`. The pixel face renders small for its size, so it runs a step or two above the Nunito around it, and never below `text-lg`. It has one weight: `font-bold` and `font-semibold` are for Nunito only.

Sizes are Tailwind's scale only, no pixel sizes:

| Size | Where |
|------|-------|
| `text-5xl`–`text-6xl`, pixel | A page's `h1` (the series list, the admin pages), a series banner's name; the archetype's name |
| `text-4xl`, pixel | Section `h2` (a team's name, "Team", "Members", "Matrices"); admin cards (the admin home, the series list) |
| `text-3xl`, pixel | The summary's name, the drop zone's line; a head-to-head's big percentage (Nunito) |
| `text-2xl`, pixel | Tabs, buttons, `Panel` titles, dialog titles, member card and graph node names, box titles ("PC 56"), the phone summary's sheet title |
| `text-xl`, pixel | `Segmented` options, file tabs, small group headings inside a card ("Ability"), the vendored dialog and sheet titles' default |
| `text-lg`, pixel | The smallest labels: the pool bar's "Pool", a compare table's group rows |
| `text-sm` | Fields, secondary body text |
| `text-xs` | Table cells, chips, small labels, cell overlays (level, name), pills, chart labels |

The one exception is the team graph's Cytoscape canvas (`src/components/analysis/team-graph.tsx`), which sets its labels' `font-size` in pixels (9–13) since Tailwind's classes cannot reach it.

## Radius, Spacing, Borders, Shadow

`--radius` is `0.625rem` (10px); `rounded-lg` = 10px, `rounded-md` = 8px, `rounded-sm` = 6px, `rounded-xl` = 14px, `rounded-2xl` = 18px.

| Radius | Used on |
|--------|---------|
| `rounded-2xl` | Panels, cards, lift cards, the PC box, the summary aside, the drop zone, a bottom sheet's top corners |
| `rounded-xl` | Inner cards (ability rows), refusals, empty-slot placeholders, dialogs, the team strip |
| `rounded-lg` | Tabs' top corners (`rounded-t-lg`), fields, selects, segmented tracks, PC cells, the large player badge |
| `rounded-md` | Buttons, the home mark's box, segments inside a track, the small player badge, item icons, type squares |
| `rounded-sm` | Bar tracks and fills, small tags, compare matrix cells |
| `rounded-full` | Type dots and chips, pills |

Radii come from this scale only, never as pixel values in brackets.

Spacing is Tailwind's 0.25rem scale, quarter steps allowed (`gap-3.5`, `py-2.25`). Common: `gap-2`/`gap-2.5` inside controls and rows, `gap-3.5`–`gap-4.5` between cards, `p-4` inside a panel.

Panels and cards have 3px slate borders (`border-3`), a lift card 4px (`border-4`); rows, fields and inner pieces keep 1px `border`. The header's red line is `border-b-4`.

No shadows but the boards' two: the quiet button's inset bottom edge (`shadow-[inset_0_-4px_0_0_var(--edge)]`) and a lifted card's drop (`shadow-[0_8px_0_0_var(--drop)]`). shadcn's sheet keeps its `shadow-lg`.

## Layout Shell

- **Root** (`SiteShell`, `src/components/site-shell.tsx`, the root route's component in `src/router.tsx`): a `flex min-h-svh flex-col` column holding `SiteHeader` and the route's `<Outlet />`. Outside `/admin`, a signed-out reader gets the sign-in page and a player not yet allowed the waiting page instead, both without the header. Each page renders its own `<main>`.
- **Header** (`src/components/site-header.tsx`): `bg-ink` with a red `border-b-4`, `h-16 px-8` from `sm`. The pixel Poké Ball (`size-9` in a `size-12` box) links home; then the tabs, Series, PC and Teams for a player, Series, Teams and Admin (the pixel key, opening `/admin`) for an admin: each `h-12 rounded-t-lg px-5`, a pixel icon and its label in `text-2xl` pixel face, sitting on the red line. The open tab is `bg-red text-white`, joined to the line; the others `text-subtle`, `hover:bg-card hover:text-white`. Series (flag) opens `/series` and is open on every series page; PC (monitor) opens the player's own PC in the running series (`/series` while none runs) and is open on every PC page; Teams (people) opens Team Analysis until the page replacing it exists. At the right (`ml-auto`), for a signed-in reader: a player's `PlayerBadge` and name in `text-2xl` pixel face, one `min-h-11 rounded-lg px-2` link to their profile, `hover:bg-card` and `bg-card` while the profile is open (an admin's name alone, plain, without a badge), and sign-out, a `size-11` icon button (`SignOutIcon`), `text-muted-foreground`, `hover:bg-card hover:text-white`. No page title and no other navigation.
- **Header below `sm`** (after `header-phone.dc.html` and its two open boards): a compact `h-15` bar, `pl-3 pr-2 gap-2`: the Poké Ball (`size-8` in a `size-11` box), the open section's icon (`size-4`, in `red`) and name in `text-[1.625rem]` pixel face filling the middle (empty where no tab is open), and a `size-11` menu button, white, with the pixel `menu` icon, `bg-card` and the pixel `cross` while open (`aria-expanded`). The menu is a `nav` under the bar's red line, full width, `bg-ink` with a `border-b-4 border-border`, `px-3 pt-2.5 pb-3.5 gap-1`, over a `bg-scrim` covering the page below the header; it lists the tabs as `min-h-13 rounded-lg px-3.5` rows in `text-[1.75rem]` pixel face with their icons (the open one `bg-red text-white`, the others `text-subtle`, `hover:bg-card hover:text-white`), then, for a signed-in reader, a `h-0.75 bg-cell` divider, the badge (`size="xs"`) and name in white, a link to the player's profile, `hover:bg-card` and `bg-card` while it is open (an admin's name alone, plain), and sign-out with `SignOutIcon` in `text-muted-foreground`. Choosing a tab, the scrim, Escape or any route change closes it. The tabs, the account and the menu never show at the other width.
- **Page column** (`src/components/page.ts`): every page is a centred column with the gutter `px-4 sm:px-8` (the header's from `sm`; below it the header's compact bar keeps its own, `pl-3 pr-2`), and one width per page kind:

  | Class | Width | Page kind |
  |-------|-------|-----------|
  | `listPage` | `max-w-240` (60rem) | A page listing links or a form: the admin pages |
  | `toolPage` | `max-w-344` (86rem) | A tool, a series or a PC page: Open Sheet (its tab bar, PC and team views), Team Analysis, `/series`, `/series/<n>` (whose scene header runs the full width, its content on this column), the player's profile, the player's series page, the PC page |
  | `messageWidth` | `max-w-180` (45rem) | A single message or form inside a page: drop zone, refusal, storage error |

  The page's own spacing (`gap-…`, `py-…`) is added with `cn(toolPage, "…")`; nothing inside a page adds a gutter of its own.

- **Breakpoints:** Tailwind's. `sm` (40rem) is the phone/desktop switch for gutters, sizes and grid columns; `lg` (64rem) splits a page into side-by-side cards (`lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`) and, through `useMediaQuery("(min-width: 64rem)")` (`src/hooks/use-media-query.ts`), swaps a sticky side aside for a bottom sheet below it.
- **Phone rules:** grids collapse to one column; a detail pane becomes a bottom `Sheet` (`side="bottom"`, `max-h-[90svh]`, `rounded-t-2xl`); wide tables and tab bars scroll horizontally (`overflow-x-auto`) with a sticky first column, unless a phone board lays them out to fit; touch targets are at least `min-h-10`; the header's tabs, the reader's name and sign-out move into the header's menu (above). A scene draws a smaller crop of bigger pixels (`SceneArt`, below): a banner keeps its `h-35`, a series page's header is `h-55` against `h-65` from `sm`; the series page's section `h2`s are `text-[2.125rem]`.
- **The series page's Trainers table below `sm`** (after `series-phone.dc.html`) fits the screen instead of scrolling: the milestones are keyed once above the rows, in a `min-h-9 px-3` strip of `text-xl` pixel labels, a milestone's trailing number or else the first letter of its last word ("1"–"8", "L"), the tournament's cup, rounds tinted `bg-round/10` in `round-ink`; each row's head is `min-h-13`: the badge (`size="row"`) and the name in `text-[1.625rem]`, one link to the player's profile, then, after the "You" chip on the reader's own row, a button filling the rest of the head, holding the trainer's progress (their latest milestone, or the one an admin set by hand) in `text-xl` `text-muted-foreground` and a `size-9` chevron box, with the track under it across the full width (`h-12.5 mx-3 mb-2`, a `role="img"` labelled with the trainer, their progress and their snapshots), its nodes shrunk to `size-3`, `size-5.5` and `size-7.5`, the badge on it `size-7` and the snapshot rings `border-2` (`size-5.5`, `size-7.5`, `size-9`), and only shown; the open row starts with a `Segmented` `size="lg"` of the trainer's snapshots across both columns, then the tiles two to a row (`grid-cols-2 gap-2`), then Upload as a full-width `min-h-12` button opening the upload dialog's bottom sheet. From `sm` it is the desktop table, scrolling sideways below its `min-w-200`.

## Components

### Shared

| Component | Path | Use |
|-----------|------|-----|
| `Button`, `buttonVariants` | `src/components/ui/button.tsx` | The quiet pixel-face button, vendored from shadcn: `min-h-11 rounded-md px-4 pb-1`, `bg-face` with `hover:bg-face-hi`, the dark bottom edge, white `text-2xl` pixel face (`size="default"`); `size-11` (`"icon"`) or `size-7` (`"icon-sm"`). Variants: `default`, `destructive` (the same face, `text-destructive`), `ghost` (no face, muted text, `hover:bg-face`), `go` (the upload boards' red action: `bg-red` with `hover:bg-red-hi`, falling back to the quiet face with `text-faint` while disabled). Every button is one of these; in dialogs, the confirm is `destructive` when it deletes |
| `Dialog` | `src/components/ui/dialog.tsx` | Modal on `bg-scrim`; pass `className="bg-card"`; title in `font-heading text-2xl`; `aria-describedby={undefined}` when there is no description |
| `Sheet` | `src/components/ui/sheet.tsx` | Bottom sheet for a phone's detail pane (imported as `BottomSheet` in the PC) |
| `SiteHeader` | `src/components/site-header.tsx` | The header and its tabs ([Layout Shell](#layout-shell)) |
| `BallSplit`, `ballTitleClass` | `src/components/ball-split.tsx` | The sign-in and waiting pages' Poké Ball, after their boards: a `bg-red` top `h-[51svh]` (`sm:h-[52svh]`) with the site's name in `text-8xl` (`sm:text-9xl`) pixel face and `.enbraile.vip` in `blush`; an `ink` band (`h-3.5`, `sm:h-4.5`) with a `foreground` ball (`size-20`, `sm:size-30`) on its seam; the dark half holding the page's content |
| `SignOutIcon` | `src/components/sign-out.tsx` | The boards' sign-out mark, a door with an arrow leaving it, in `currentColor`; `useSignOut` beside it signs out |
| `PixelIcon` | `src/components/pixel-icon.tsx` | The pixel icons as crisp-edged SVG, `size-4.5` by default: `ball` (the Poké Ball, in its own colours), `flag`, `monitor`, `people`, `key`, `menu`, `cross`, `download`, `upload`, `check` (in `currentColor`), `zip` (a file in `muted-foreground` with its zipper in `currentColor`), `cartridge` (in its own colours) and `barrier` (the League placeholder's striped barrier, 14 units, in `yellow`, `ink`, `muted-foreground` and `faint`) |
| `SceneArt`, `SCENE_LOOK` | `src/components/scene.tsx` | A series' animated background scene (`night` or `route`) as crisp SVG rectangles, absolute over its box and covering it from the bottom (`xMidYMax slice`); `width` and `height` set its pixel grid (360×65 for a page's header, 338 wide for a banner; below `sm`, read with `useMediaQuery("(min-width: 40rem)")`, a smaller crop of bigger pixels: 98×55 for a page's header, 88 wide for a banner). Blinking and drifting pixels use the `scene-*` keyframes in `src/index.css`, stopped under `prefers-reduced-motion`. `SCENE_LOOK[scene]` gives the classes for what sits on it: `ground` (the box's background), `title` (the pixel name's shadow), `chip` (the game line on a banner), `panel` and `panelSub` (the game's box on a series page) and `button` (the quiet button's face over a light scene) |
| `PlayerBadge` | `src/components/player-badge.tsx` | A player, boxed, never round: their initial in the pixel face on their colour, a 3px `ink` border and a ring in their colour; `size="xs"` (`size-8 rounded-[7px] ring-2`, the header's menu), `"sm"` (`size-9 rounded-md ring-2`) or `"lg"` (`size-12.5 rounded-lg ring-3`), after the boards' header and trainer rows, `"xl"`, the profile's, `size-16 rounded-xl ring-3` below `sm` and `size-21 rounded-[14px] ring-4` from it, both with a 4px border, and `"row"`, a trainer row's, `size-8.5 rounded-lg ring-2` below `sm` and `"lg"` from it; `colour` picks `player-1`…`player-6`; `playerColour(id)` picks one from a player's id, and `PLAYER_FILL` and `PLAYER_RING` beside it hold each colour's `bg-player-N` and `ring-player-N` for anything else drawn in a player's colour, as the series page's track is. Shown in the header, on the profile, on the waiting page, on the allowlist, on the series page's trainer rows and on the admin series form's players |
| `UploadDialog` | `src/components/upload-dialog.tsx` | The snapshot upload, after the `upload-*.dc.html` boards: a `Dialog` (`sm:max-w-150`, `border-3`, `px-6 pt-5.5 pb-6`, a bottom sheet below `sm`) titled in `text-4xl` pixel face, with the drop zone, the file row (a `zip` icon on `bg-ink`, name, size, the percentage or "Uploaded" in `chart-2`, and a segmented `h-4` bar in `primary`, `destructive` when it failed), the error alert, the slot radios (`min-h-15 rounded-xl border-3`, chosen `border-primary bg-primary/12`), the milestone grid (`bg-ink` well of `bg-cell` cells, the chosen one `bg-red`, a 7px square on one that has a snapshot), the amber replace warning and the done step; actions `min-h-13`, the go button `go` ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)) |
| `TrainerAdmin` | `src/components/trainer-admin.tsx` | The admin overrides at the end of an admin's open trainer row on the series page ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)), built without a board as an Admin panel (Patterns): Progress, the shown snapshot's fainted count and its milestone, each a `fieldClass` select or number input with `buttonClass` actions, Delete in the destructive button, confirmed by a second press |
| `SnapshotPc`, `PcBox`, `SummaryAside`, `SummarySheet`, `BagButton` | `src/components/pc/pc-box.tsx` | The PC, shown by the PC page (`SnapshotPc`, read-only) and Open Sheet: the box ([Box and cells](#patterns)) with its search, type filter and an `actions` slot, the summary as an `aside` from `lg` or a bottom sheet below, each with an optional footer, and the Bag button |
| `MonSprite`, `SummaryHead`, `SummaryBody` | `src/components/pc/summary.tsx` | A Pokémon's sprite (`MonSprite` takes anything with a `sprite`, a fallen Pokémon on the player's series page too) and its summary: head, then Info, Stats and Moves tabs |
| `Bag`, `ItemIcon` | `src/components/pc/bag.tsx` | The bag dialog (Items, Berries, TMs, search); with a `team` it gives items and teaches TMs to its members, without one it only shows the bag; an item's icon |
| `listPage`, `toolPage`, `messageWidth` | `src/components/page.ts` | The page column classes ([Layout Shell](#layout-shell)) |
| `TypeDot`, `TypeChip`, `TypeSquare`, `UnknownMark` | `src/components/marks.tsx` | A type as its colour with the white symbol (dot 16px, chip with name, square 24px); `?` in `destructive` for anything Showdown lacks |
| `Panel` | `src/components/controls.tsx` | A titled panel: `rounded-2xl border-3 bg-card p-4`, `h3` in `text-2xl` pixel face, optional `aside` |
| `Segmented` | same | A `radiogroup` of pixel-face options on a `bg-muted` track; the chosen one `bg-red text-white`, the others `text-subtle`, a disabled one `text-faint`. Every view switch, Open Sheet's PC/Team included. `size="lg"`, the PC page's snapshot picker and the series page's on a phone: a `border-3 rounded-xl p-1` track of `min-h-11 rounded-lg` options in `text-[1.4375rem]`, the others `text-foreground` with a `bg-cell` hover |
| `Toggle` | same | An on/off quiet button; on is filled `bg-primary text-primary-foreground` |
| `liftCardClass` | same | The lift-on-hover card, for a card that is a link as a whole, after the series list's banner: `rounded-2xl border-4 border-cell bg-card`; on hover or focus it rises `-translate-y-1` in two steps, its border turns `primary` and it drops a `drop` shadow; still under `prefers-reduced-motion` |
| `fieldClass` | same | A field: `min-h-10 rounded-lg border bg-muted text-sm` |
| `buttonClass`, `iconButtonClass`, `quietIconClass` | same | `buttonVariants` for a hand-built `<button>` or `<label>`: the quiet button, the `size-11` icon button, the `size-7` ghost icon button |
| `ArchetypeCard`, `Checklist`, `ArchetypeMap`, `SpeedTiers`, `MemberCards`, `Matrices`, `TeamGraph` | `src/components/analysis/` | Team analysis panels, shown by Team Analysis and by Open Sheet's team view; sprites from `src/analysis/sprite.ts` |

A tool's own components stay in `src/<tool>/components/` (Open Sheet's `TeamView` in `team-view.tsx`, `TeamBar` in `team-bar.tsx`), and no tool imports another tool's components: what two tools show goes in `src/components/`.

### Patterns

- **Card:** `rounded-2xl border-3 bg-card`, padded `p-3`–`p-4`. A card that is a link as a whole is `liftCardClass` and ends in a cyan `ArrowRight` (the admin home's and `/admin/series`'s links, `px-5 py-4.5`).
- **Box and cells** (the Pokémon PC look): a `bg-box rounded-2xl` (the team strip `rounded-xl`) container with a pixel-face title and count, holding a responsive grid (`grid-cols-[repeat(auto-fill,minmax(72px,1fr))] sm:…minmax(112px,1fr)`) of square `bg-cell rounded-lg` buttons. Selected: `border-2 border-primary bg-cell-hi`. A cell overlays the level (`tabular-nums`, top-left), a `?` mark (top-right) and the name (bottom, hidden on phones).
- **Actions:** `buttonClass` (or `<Button>`) for every action, with `iconButtonClass` for icon-only tools (`aria-label` and `title`). Destructive tools add `text-destructive`.
- **Quiet icon button:** `quietIconClass`, `size-7 rounded-md text-muted-foreground hover:bg-face hover:text-foreground` (tab rename/close, dialog and sheet close).
- **Focus:** every interactive element `outline-none focus-visible:ring-3 focus-visible:ring-ring/50`.
- **Tabs (file tabs):** a bottom-bordered `nav` of `text-xl` pixel-face tabs; the active one `rounded-t-lg border border-b-0 bg-background`, merging into the page; actions appear on the active tab only; a cyan `+` ends the row.
- **View switch:** `Segmented`.
- **Search and filter:** a `label` wrapping a `Search` icon and a borderless input on `bg-cell` (inside a box) or `fieldClass` (elsewhere), `min-h-10`; a native `select` styled the same.
- **Definition list:** `dl` grid with a fixed label column (`grid-cols-[90px_1fr] sm:grid-cols-[96px_1fr]`), `dt` muted, `dd font-medium`.
- **Stat bars:** a label coloured by nature (raised `text-primary`, lowered `text-chart-2`), the value in `tabular-nums`, an `h-2 rounded-sm bg-muted` track with a fill in `primary` / `chart-2` / `chart-3`, scaled to 160 base.
- **Effectiveness and heat cells:** `chart-2` tints for good, `destructive-soft`/`destructive` for bad, `muted` with faded text for neutral; legends are swatches with short labels.
- **Pills and chips:** `rounded-full bg-secondary px-2.5 py-1 text-xs text-chart-3` for tags; `TypeChip` for types.
- **Empty slot / empty state:** a dashed outline (`border-2 border-dashed`, `border-cell-hi` inside a box; `border-3` on a card-sized one), muted text if any, `rounded-lg`–`rounded-2xl`; clickable ones open the action that fills them.
- **Drop zone:** `messageWidth` dashed card, `rounded-2xl border-3`, an icon tile on `bg-box`, a pixel-face line and a quiet file button (`buttonClass` on a `label`); the border turns `primary` while dragging over.
- **Warning:** a row `rounded-xl border border-warning bg-warning-soft px-4 py-3`, a `TriangleAlert` in `warning`, bold text in `warning-ink`; it informs and never blocks.
- **Admin panel:** controls only admins see, inside a page every reader sees: a `rounded-xl border-3 border-dashed border-warning/60 bg-card px-4 py-3` card titled "Admin" in `text-xl` pixel face `text-warning`, each control under a `text-lg` pixel-face label in `text-muted-foreground`, and under it its source in `text-sm`, `text-muted-foreground` for a value from the save and `text-warning` for one set by hand (`TrainerAdmin`). The amber dash marks it apart from the page's own cards and from an empty slot's `cell-hi` dash.
- **Errors:** an `alert` row, `rounded-xl border border-destructive bg-destructive-soft`, a `CircleAlert` in `destructive`. A whole-page failure is a plain `text-destructive` paragraph.
- **Tile:** a figure with its label, as on a trainer row (`Tile` in `src/pages/series.tsx`): `rounded-xl border-3 bg-card px-4 py-3` (`px-3 py-2.5` below `sm`), the label in `text-xl` pixel face `text-muted-foreground`, followed below `sm` by a small `primary` arrow on a tile that is a link, the value below in `text-5xl` pixel face (`text-4xl` below `sm`), a count or a short text such as a play time, never wrapping, `text-faint` while it is "—", `text-destructive` for a fainted count above 0. A tile that is a link lifts with a `primary` border on hover.
- **Banner:** a series on its scene as a whole-width link (`src/pages/series-list.tsx`): `liftCardClass` with `h-35 overflow-hidden` (the same height on a phone, on the scene's phone crop), `SceneArt` behind, the name in pixel face with the scene's `title` shadow and the game on the scene's `chip`, the state at the top right on `bg-primary` (playing now) or `bg-ink` (finished) with a 3px `ink` border.
- **Sticky aside:** on wide screens a detail pane is `sticky top-4 w-100 max-h-[calc(100svh-2rem)] rounded-2xl border-3 bg-card`, its footer action above a top border.

## Imagery and Icons

- **Pokémon sprites:** Showdown's Gen 5 sprites through `@pkmn/img`'s `Sprites.getPokemon(name, { gen: "gen5", shiny, gender })`, always `[image-rendering:pixelated]`, `alt=""` when a label already names the Pokémon.
- **Item icons:** `@pkmn/img`'s `Icons.getItem`, a background position on Showdown's sheet (`ItemIcon`).
- **Type icons:** duiker101's SVG paths in `src/lib/type-icons.ts`, white on the type's colour.
- **Pixel icons:** `PixelIcon`, drawn on a 10, 12 or 14 unit grid with `shapeRendering="crispEdges"`: the home mark, the header's tab icons, its menu button and the League placeholder's barrier. A new pixel icon is added to its `ICONS` table.
- **Series scenes:** `SceneArt`, pixel art drawn in code, one per series, in the `scene-*` tokens.
- **UI icons:** `lucide-react`, `aria-hidden` beside a text label or with `aria-label` when alone; sizes `size-3.5`–`size-5.5`. In use: `ArrowRight`, `Upload`, `Plus`, `X`, `Pencil`, `Copy`, `Trash2`, `ClipboardPaste`, `ClipboardCopy`, `ClipboardCheck`, `Check`, `Search`, `ShoppingBag`, `Package`, `CircleAlert`, `TriangleAlert`, `Info`, `ChartNetwork`.
- **Tab icon:** `public/favicon.svg`, with `favicon-32.png` and `apple-touch-icon.png` rendered from it.
