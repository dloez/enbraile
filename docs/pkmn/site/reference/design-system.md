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
| `background` | `#161b26` | The navy ground; `body` draws a `dot` grid on it (1.5px dots every 20px) |
| `dot` | `#232b3c` | The ground's dot grid |
| `ink` | `#10141d` | The darkest navy: the header bar, a badge's border, text on a bright fill |
| `muted` | `var(--ink)` | Inset wells: segmented-control tracks, inputs (`fieldClass`), inline rename fields |
| `card` | `#222a3b` | Panels, cards, the summary aside, dialogs and sheets; an inactive tab's hover |
| `popover` | `var(--card)` | shadcn's dialog and sheet default surface |
| `box` | `#1b2232` | The team strip, the recessed area a grid of cells sits in; the summary's head and its nature, ability, stat and move wells; icon tiles |
| `pc`, `pc-check` | `#1d4650`, `#21505b` | The PC box: a teal ground checkered in 56px squares of `pc-check` |
| `pc-cell`, `pc-cell-on` | `rgba(16,20,29,0.35)`, `rgba(90,209,240,0.22)` | A PC cell and the selected one |
| `pc-fade` | `rgba(14,34,40,0.95)` | The PC box's fade where more cells scroll past its edge |
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
| `green` | `#7be08a` | The good side, through `chart-2`; a stat bar from half to two thirds of the best stat possible |
| `stat-up`, `stat-down` | `#ff9d94`, `#8fc8ff` | A nature's raised and lowered stat in the summary; `stat-down` is also ♂ and, as `cat-special`, a special move's tag |
| `cat-physical` | `#ff9d70` | A physical move's tag (a status move's is `subtle`) |
| `female` | `#ff9ec4` | ♀ |
| `prose` | `#d5dae5` | A selected move's description |
| `mult-4`, `mult-2`, `mult-half`, `mult-quarter`, `mult-0` | `#2a6338`, `#3d8550`, `#c8642f`, `#b0302a`, `#0b0e15` | A type defense cell's damage taken: ×4, ×2, ½, ¼ and immune; ×4 and ×2 green, ½ and ¼ red, as Pokémon Database does |
| `destructive` | `#ff6a5e` | Errors, refusals, unknown marks (`?`), weaknesses, delete actions |
| `destructive-soft` | `color-mix(in srgb, var(--destructive) 20%, var(--card))` | Fill behind an error or a weakness cell |
| `warning` | `#ffc878` | Amber, a soft warning that never blocks: its border and icon (a snapshot about to be replaced, a gap in an old export), the done step's "Missing:" chip (border, icon and text) and the file row's `zip` icon for an export |
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

`--type-<type>` for the 18 types, lower-case (`--type-fire: #d62223`…), deep enough to carry white pixel-face text, as the Site v2 Screens draw them: the summary's type tags and type defense heads, and the type dots and squares elsewhere, used only through `var(--type-${type.toLowerCase()}, …)`. Values are in `src/index.css`.

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
| `text-4xl`, pixel | Section `h2` (a team's name, "Team", "Members", "Type matchups"); admin cards (the admin home, the series list); Compare's Head to head percentage on a phone (`text-[2.5rem]` from `lg`) |
| `text-3xl`, pixel | The summary's name, the drop zone's line |
| `text-2xl`, pixel | Tabs, buttons, `Panel` titles, dialog titles, member card and graph node names, box titles ("PC 56"), the phone summary's sheet title |
| `text-xl`, pixel | `Segmented` options, small group headings inside a card ("Ability"), the vendored dialog and sheet titles' default |
| `text-lg`, pixel | The smallest labels: the pool bar's "Pool" |
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
| `rounded-sm` | Bar tracks and fills, small tags |
| `rounded-full` | Type dots and chips, pills |

Radii come from this scale only, never as pixel values in brackets.

Spacing is Tailwind's 0.25rem scale, quarter steps allowed (`gap-3.5`, `py-2.25`). Common: `gap-2`/`gap-2.5` inside controls and rows, `gap-3.5`–`gap-4.5` between cards, `p-4` inside a panel.

Panels and cards have 3px slate borders (`border-3`), a lift card 4px (`border-4`); rows, fields and inner pieces keep 1px `border`. The header's red line is `border-b-4`.

No shadows but the boards' two: the quiet button's inset bottom edge (`shadow-[inset_0_-4px_0_0_var(--edge)]`) and a lifted card's drop (`shadow-[0_8px_0_0_var(--drop)]`). shadcn's sheet keeps its `shadow-lg`.

## Layout Shell

- **Root** (`SiteShell`, `src/components/site-shell.tsx`, the root route's component in `src/router.tsx`): a `flex min-h-svh flex-col` column holding `SiteHeader` and the route's `<Outlet />`. Until the session answers it shows only `LoadingBar` at the top of the screen, the same bar `index.html` shows beside the root while the root is empty, before the script runs and until the router first draws. Outside `/admin`, a signed-out reader gets the sign-in page and a player not yet allowed the waiting page instead; on `/admin` and its pages anyone but an admin gets the admin sign-in; all three without the header. Each page renders its own `<main>`.
- **Header** (`src/components/site-header.tsx`): `bg-ink` with a red `border-b-4`, `h-16 px-8` from `sm`. The pixel Poké Ball (`size-9` in a `size-12` box) links home; then the tabs, Series, PC and Teams for a player, Series, Teams and Admin (the pixel key, opening `/admin`) for an admin: each `h-12 rounded-t-lg px-5`, a pixel icon and its label in `text-2xl` pixel face, sitting on the red line. The open tab is `bg-red text-white`, joined to the line; the others `text-subtle`, `hover:bg-card hover:text-white`. Series (flag) opens `/series` and is open on every series page; PC (monitor) opens the player's own PC in the running series (`/series` while none runs) and is open on every PC page; Teams (people) opens `/teams` and is open on every team page. At the right (`ml-auto`), for a signed-in reader: a player's `PlayerBadge` and name in `text-2xl` pixel face, one `min-h-11 rounded-lg px-2` link to their profile, `hover:bg-card` and `bg-card` while the profile is open (an admin's name alone, plain, without a badge), and sign-out, a `size-11` icon button (`SignOutIcon`), `text-muted-foreground`, `hover:bg-card hover:text-white`. No page title and no other navigation. While a route loads, `NavProgress` draws `LoadingBar` over the red line.
- **Header below `sm`** (after `header-phone.dc.html` and its two open boards): a compact `h-15` bar, `pl-3 pr-2 gap-2`: the Poké Ball (`size-8` in a `size-11` box), the open section's icon (`size-4`, in `red`) and name in `text-[1.625rem]` pixel face filling the middle (empty where no tab is open), and a `size-11` menu button, white, with the pixel `menu` icon, `bg-card` and the pixel `cross` while open (`aria-expanded`). The menu is a `nav` under the bar's red line, full width, `bg-ink` with a `border-b-4 border-border`, `px-3 pt-2.5 pb-3.5 gap-1`, over a `bg-scrim` covering the page below the header; it lists the tabs as `min-h-13 rounded-lg px-3.5` rows in `text-[1.75rem]` pixel face with their icons (the open one `bg-red text-white`, the others `text-subtle`, `hover:bg-card hover:text-white`), then, for a signed-in reader, a `h-0.75 bg-cell` divider, the badge (`size="xs"`) and name in white, a link to the player's profile, `hover:bg-card` and `bg-card` while it is open (an admin's name alone, plain), and sign-out with `SignOutIcon` in `text-muted-foreground`. Choosing a tab, the scrim, Escape or any route change closes it. The tabs, the account and the menu never show at the other width.
- **Page column** (`src/components/page.ts`): every page is a centred column with the gutter `px-4 sm:px-8` (the header's from `sm`; below it the header's compact bar keeps its own, `pl-3 pr-2`), and one width per page kind:

  | Class | Width | Page kind |
  |-------|-------|-----------|
  | `listPage` | `max-w-344` (86rem) | A page listing links or a form: the admin pages |
  | `toolPage` | the full width, `px-12` from `2xl` | A tool, a series or a PC page: the team list and the team page, `/series`, the player's profile, the player's series page, the PC page |
  | `readPage` | `max-w-344` (86rem) | A page read more than worked in: `/series/<n>` (its scene header runs the full width, its sections on this column) |
  | `messageWidth` | `max-w-180` (45rem) | A single message or form inside a page: drop zone, refusal, storage error |

  The page's own spacing (`gap-…`, `py-…`) is added with `cn(toolPage, "…")`; nothing inside a page adds a gutter of its own. Both classes carry `flex-1`, so a page's one column grows to the screen's height; a page built of several columns, such as `/series/<n>`'s trainers and rules, adds `flex-none` to each, so a short one never leaves a gap under it.

- **Breakpoints:** Tailwind's. `sm` (40rem) is the phone/desktop switch for gutters, sizes and grid columns; `lg` (64rem) splits a page into side-by-side cards (`lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`) and, through `useMediaQuery("(min-width: 64rem)")` (`src/hooks/use-media-query.ts`), swaps a sticky side aside for a bottom sheet below it.
- **Phone rules:** grids collapse to one column; a detail pane becomes a bottom `Sheet` (`side="bottom"`, `max-h-[90svh]`, `rounded-t-2xl`); wide tables and tab bars scroll horizontally (`overflow-x-auto`) with a sticky first column, unless a phone board lays them out to fit; touch targets are at least `min-h-10`; the header's tabs, the reader's name and sign-out move into the header's menu (above). A scene draws a smaller crop of bigger pixels (`SceneArt`, below): a banner keeps its `h-35`, a series page's header is `h-55` against `h-65` from `sm`; the series page's section `h2`s are `text-[2.125rem]`.
- **The series page's Trainers table below `sm`** (after `series-phone.dc.html`) fits the screen instead of scrolling: the milestones are keyed once above the rows, in a `min-h-9 px-3` strip of `text-xl` pixel labels, a milestone's trailing number or else the first letter of its last word ("1"–"8", "L"), the tournament's cup, rounds tinted `bg-round/10` in `round-ink`; each row's head is `min-h-13`: the badge (`size="row"`) and the name in `text-[1.625rem]`, one link to the player's profile, then, after the "You" chip on the reader's own row, a button filling the rest of the head, holding the trainer's progress (their latest milestone, or the one an admin set by hand) in `text-xl` `text-muted-foreground` and a `size-9` chevron box, with the track under it across the full width (`h-12.5 mx-3 mb-2`, a `role="img"` labelled with the trainer, their progress and their snapshots), its nodes shrunk to `size-3`, `size-5.5` and `size-7.5`, the badge on it `size-7` and the snapshot rings `border-2` (`size-5.5`, `size-7.5`, `size-9`), and only shown; the open row starts with a `Segmented` `size="lg"` of the trainer's snapshots across both columns, then the tiles two to a row (`grid-cols-2 gap-2`), then Upload, for a trainer the reader may upload for, as a full-width `min-h-12` button opening the upload dialog's bottom sheet. From `sm` it is the desktop table, scrolling sideways below its `min-w-200`.

## Components

### Shared

| Component | Path | Use |
|-----------|------|-----|
| `Button`, `buttonVariants` | `src/components/ui/button.tsx` | The quiet pixel-face button, vendored from shadcn: `min-h-11 rounded-md px-4 pb-1`, `bg-face` with `hover:bg-face-hi`, the dark bottom edge, white `text-2xl` pixel face (`size="default"`); `size-11` (`"icon"`) or `size-7` (`"icon-sm"`). Variants: `default`, `destructive` (the same face, `text-destructive`), `ghost` (no face, muted text, `hover:bg-face`), `go` (the upload boards' red action: `bg-red` with `hover:bg-red-hi`, falling back to the quiet face with `text-faint` while disabled). Every button is one of these; in dialogs, the confirm is `destructive` when it deletes |
| `Dialog` | `src/components/ui/dialog.tsx` | Modal on `bg-scrim`; pass `className="bg-card"`; title in `font-heading text-2xl`; `aria-describedby={undefined}` when there is no description |
| `Sheet` | `src/components/ui/sheet.tsx` | Bottom sheet for a phone's detail pane (imported as `BottomSheet` in the PC) |
| `SiteHeader` | `src/components/site-header.tsx` | The header and its tabs ([Layout Shell](#layout-shell)) |
| `BallSplit`, `ballTitleClass` | `src/components/ball-split.tsx` | The sign-in and waiting pages' Poké Ball, after their boards: a `bg-red` top `h-[51svh]` (`sm:h-[52svh]`) with the site's name in `text-8xl` (`sm:text-9xl`) pixel face and `.enbraile.vip` in `blush`; an `ink` band (`h-3.5`, `sm:h-4.5`) with a `foreground` ball (`size-20`, `sm:size-30`) on its seam; the dark half holding the page's content. `admin` turns it round for the admin sign-in: an `ink` top `h-[37svh]` with the pixel key and "Admin" in `yellow` over the name, and a `red` band |
| `AdminNav` | `src/components/admin-nav.tsx` | The admin tabs heading every admin page: Overview, Series, Players and Games in a `rounded-xl border-3 bg-ink` strip, `text-[1.4375rem]` pixel face, the open one `bg-cell text-white`, the others `text-muted-foreground`; Players carries a `yellow` pill with the count of players waiting; four equal columns below `sm` |
| `formFieldClass`, `formLabelClass` | `src/components/controls.tsx` | The admin forms' field, `h-11.5 rounded-[10px] border-3 bg-ink` in bold `text-[1.0625rem]`, `primary` border and ring on focus, `destructive` border when `aria-invalid`; its label above it in `text-xl` pixel face `text-muted-foreground`. A fixed value (a series' number) shows in the same box on `bg-box` |
| `SignOutIcon` | `src/components/sign-out.tsx` | The boards' sign-out mark, a door with an arrow leaving it, in `currentColor`; `useSignOut` beside it signs out |
| `PixelIcon` | `src/components/pixel-icon.tsx` | The pixel icons as crisp-edged SVG, `size-4.5` by default: `ball` (the Poké Ball, in its own colours), `flag`, `monitor`, `people`, `key`, `menu`, `cross`, `download`, `upload`, `check` (in `currentColor`), `zip` (a file in `muted-foreground` with its zipper in `currentColor`), `cartridge` (in its own colours) and `barrier` (the League placeholder's striped barrier, 14 units, in `yellow`, `ink`, `muted-foreground` and `faint`) |
| `SceneArt`, `SCENE_LOOK` | `src/components/scene.tsx` | A series' animated background scene (`night` or `route`) as crisp SVG rectangles, absolute over its box and covering it from the bottom (`xMidYMax slice`); `width` and `height` set its pixel grid (360×65 for a page's header, 338 wide for a banner; below `sm`, read with `useMediaQuery("(min-width: 40rem)")`, a smaller crop of bigger pixels: 98×55 for a page's header, 88 wide for a banner). Blinking and drifting pixels use the `scene-*` keyframes in `src/index.css`, stopped under `prefers-reduced-motion`. `SCENE_LOOK[scene]` gives the classes for what sits on it: `ground` (the box's background), `title` (the pixel name's shadow), `chip` (the game line on a banner), `panel` and `panelSub` (the game's box on a series page) and `button` (the quiet button's face over a light scene) |
| `PlayerBadge` | `src/components/player-badge.tsx` | A player, boxed, never round: their initial in the pixel face on their colour, centred by its capital's own height (`leading-none [text-box:trim-both_cap_alphabetic]`, last so a size's `text-*` cannot drop it; the series track's marker and the snapshot menu's initial do the same), a 3px `ink` border and a ring in their colour; `size="xs"` (`size-8 rounded-[7px] ring-2`, the header's menu), `"sm"` (`size-9 rounded-md ring-2`) or `"lg"` (`size-12.5 rounded-lg ring-3`), after the boards' header and trainer rows, `"xl"`, the profile's, `size-16 rounded-xl ring-3` below `sm` and `size-21 rounded-[14px] ring-4` from it, both with a 4px border, and `"row"`, a trainer row's, `size-8.5 rounded-lg ring-2` below `sm` and `"lg"` from it; `colour` picks `player-1`…`player-6`; `playerColour(id)` picks one from a player's id, and `PLAYER_FILL` and `PLAYER_RING` beside it hold each colour's `bg-player-N` and `ring-player-N` for anything else drawn in a player's colour, as the series page's track is. Shown in the header, on the profile, on the waiting page, on the allowlist, on the series page's trainer rows and on the admin series form's players |
| `UploadDialog` | `src/components/upload-dialog.tsx` | The snapshot upload, after the `upload-*.dc.html` boards: a `Dialog` (`sm:max-w-150`, `border-3`, `px-6 pt-5.5 pb-6`, a bottom sheet below `sm`) titled in `text-4xl` pixel face, with the drop zone, the file row (a `zip` icon on `bg-ink`, in `primary` for a save zip and `warning` for an export (a `.json`), name, size, the percentage or "Uploaded" in `chart-2`, and a segmented `h-4` bar in `primary`, `destructive` when it failed), the error alert, the slot radios (`min-h-15 rounded-xl border-3`, chosen `border-primary bg-primary/12`), the milestone grid (`bg-ink` well of `bg-cell` cells, the chosen one `bg-red`, a 7px square on one that has a snapshot), the amber replace warning and the done step, which for an old export ends with its chips (`ExportGaps`, Patterns → Warning); actions `min-h-13`, the go button `go` ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)) |
| `TrainerAdmin` | `src/components/trainer-admin.tsx` | The admin overrides at the end of an admin's open trainer row on the series page ([The pkmn Site → Snapshots](../explanation/site.md#snapshots)), built without a board as an Admin panel (Patterns): Progress, the shown snapshot's fainted count and its milestone, each a `fieldClass` select or number input with `buttonClass` actions, Delete in the destructive button, confirmed by a second press |
| `SnapshotPc`, `PcBox`, `SummaryAside`, `SummarySheet`, `BagButton`, `FaintedToggle`, `FaintedMark` | `src/components/pc/pc-box.tsx` | The PC, shown by the PC page (`SnapshotPc`, read-only, given Pokémon, items and TMs already described, its summary's optional `footer` the player's "Add to team"; with fainted Pokémon among them, `FaintedToggle`, a `Toggle` reading "Fainted · <n>" before the Bag button, off at first, shows them; a fainted cell's sprite is `grayscale opacity-60` with `FaintedMark`, a 7×7 pixel cross in `destructive`, at its bottom left, and the summary head adds a `destructive` "Fainted" chip after the types) and the team page's add dialog: the box ([Box and cells](#patterns)) with its count, search, type filter, an `actions` slot and `taken`, the Pokémon already in a team, faded to `opacity-45`, the summary as a `w-95` `aside` from `lg`, the two filling the screen's height, or a bottom sheet below (its head leaving room for the close button), each with an optional footer, and the Bag button |
| `MonSprite`, `SummaryHead`, `SummaryBody` | `src/components/pc/mon-sprite.tsx`, `src/components/pc/summary.tsx` | A Pokémon's sprite (`MonSprite`, in a file of its own so that a page drawing only sprites loads none of the summary's game data, takes anything with a `sprite`, a fallen Pokémon on the player's series page too) and its summary, after `summary.dc.html`: the head on `box` (the sprite on an oval of its first type, the name, species, level and gender in the pixel face, deep type tags, a Shiny tag); a track of Info, Stats and Moves; Info holds the nature with its raised and lowered stat, the abilities as a list whose picked one shows its description ("In use" and "Hidden" tags) and the 18 type defenses in two rows of nine; Stats switches between the level, Lv 50 (the league's fight stats, ranges where the IVs are missing, the default then) and Base, with IV, EV, a bar tinted by quarter of the best stat possible, and a total; Moves lists the current moves, then what it can learn with each TM's label, and the selected move's type, category, power, accuracy, TM and whole description, or "No moves in this export" |
| `Bag`, `ItemIcon`, `MiniSeta`, `Mint` | `src/components/pc/bag.tsx` | The bag dialog, after the bag in `pc.dc.html`: up to 1040px wide, a head of the pixel bag (`orange`, `bag-strap`, `trophy-rim`, `yellow`), the title, the Items, Berries and TMs track with counts, the search and a close button; a `box` body of bordered rows, items three to a row with their 48px icon and count (the Mini Seta a pixel mushroom, `pixel-red` and `seta-stem`), TMs two to a row as moves are shown (label, type tag, name, category tag, power); and a footer showing the selected one large, with a TM's type, category, power and accuracy, and its description. It only shows the bag, since a team's items are given in the team page's item editor; below `sm` a bottom sheet. `MiniSeta` is the pixel mushroom alone, the team page's Mini Seta mark; `Mint` is a 12×12 pixel leaf (`green`, its vein `ink`, its stem `seta-stem`), the member card's mark for a minted nature, since Showdown's item sprites have no mints |
| `listPage`, `toolPage`, `readPage`, `messageWidth` | `src/components/page.ts` | The page column classes ([Layout Shell](#layout-shell)) |
| `TypeDot`, `TypeChip`, `TypeSquare`, `UnknownMark` | `src/components/marks.tsx` | A type as its colour with the white symbol (dot 16px, chip with name, square 24px); `?` in `destructive` for anything Showdown lacks |
| `Panel` | `src/components/controls.tsx` | A titled panel: `rounded-2xl border-3 bg-card p-4`, `h3` in `text-2xl` pixel face, optional `aside` |
| `SelectField` | `src/components/select-field.tsx` | A dropdown, in a file of its own so the entry script carries no Radix Select: shadcn's `Select` (`src/components/ui/select.tsx`) with an `ink` trigger, `border-3 rounded-[10px]`, Nunito bold, `h-12` or `h-10` (`size="sm"`), and a popper list on `ink` with a `cell-hi` border and `cell` highlights, scrolled with the wheel or keys and no scroll arrows, which shifted the options as they came and went; `all` adds a first option that stands for "" (All types, No game, From the save) |
| `Segmented` | same | A `radiogroup` of pixel-face options on a `bg-muted` track; the chosen one `bg-red text-white`, the others `text-subtle`, a disabled one `text-faint`. Every view switch. `size="lg"`, the PC page's snapshot picker and the series page's on a phone: a `border-3 rounded-xl p-1` track of `min-h-11 rounded-lg` options in `text-[1.4375rem]`, the others `text-foreground` with a `bg-cell` hover |
| `Toggle` | same | An on/off quiet button; on is filled `bg-primary text-primary-foreground` |
| `liftCardClass` | same | The lift-on-hover card, for a card that is a link as a whole, after the series list's banner: `rounded-2xl border-4 border-cell bg-card`; on hover or focus it rises `-translate-y-1` in two steps, its border turns `primary` and it drops a `drop` shadow; still under `prefers-reduced-motion` |
| `fieldClass` | same | A field: `min-h-10 rounded-lg border bg-muted text-sm` |
| `buttonClass`, `iconButtonClass`, `quietIconClass` | same | `buttonVariants` for a hand-built `<button>` or `<label>`: the quiet button, the `size-11` icon button, the `size-7` ghost icon button |
| `ArchetypeCard`, `Checklist`, `ArchetypeMap`, `SpeedTiers`, `MemberCards`, `Matrices`, `TeamGraph` | `src/components/analysis/` | Team analysis panels, shown by the team page's analysis, in one column in its panel and wider in Full analysis (Patterns → Team page); sprites from `src/analysis/sprite.ts` |
| `LoadingBar` | `src/components/loading-bar.tsx` | The site's sign of a wait for a whole route: a `h-1` strip, a two-fifths `bg-primary` segment sweeping across it (`animate-nav-sweep`, 0.9 s linear, from `src/index.css`), full width and still under `prefers-reduced-motion`; positioned by its caller (over the header's red line while a route loads, at the top of the screen before the session answers, inside a menu while its rows load), never beside loading text; its `label` is for screen readers |
| `Placeholder` | `src/components/placeholder.tsx` | A block standing where a page's data will go while its read is in flight: `bg-cell` with `animate-pulse`, still under `prefers-reduced-motion`, `aria-hidden`, sized and rounded by its caller to the piece it stands for |
| Page frames | `src/components/page-frames.tsx` | Each player page's layout before its chunk and data are in (`SeriesListFrame`, `SeriesFrame`, `ProfileFrame`, `PlayerSeriesFrame`, `PcFrame`, `TeamsFrame`, `TeamFrame`): the page's `<main>` with its fixed headings real and a `Placeholder` for each piece of data, drawn by `lazyPage` (`src/lib/lazy-pages.tsx`) until the chunk is in and by the page until its read answers; the admin pages' too (`AdminHomeFrame`, `AdminSeriesListFrame`, `AdminSeriesFrame`, `AdminPlayersFrame`, `AdminGamesFrame`), on `adminPage`, the admin pages' column, with the admin tabs real; also `League`, `TeamsBackLink` and `TwoBlocks`, which the pages share with their frames |
| `PoolBar` | `src/components/pool-bar.tsx` | A pool's rules: Data and Species up to as rows of generations, the three toggles, the BST cap and the pool's size; the team builder's Pool view and the series form's default pool, disabled where the reader cannot change it |

A tool's own components stay in `src/<tool>/components/` (the team builder's `MemberCard` in `src/teams/components/member-card.tsx`, its editors in `editors.tsx` and `move-picker.tsx`, `AddDialog` in `add-dialog.tsx`, the free member's `SetForm`, `SetEditor` and `FreePicker` in `free-member.tsx`, `AddToTeam` in `add-to-team.tsx`, `SnapshotMenu` in `snapshot-menu.tsx`, the Pool view's `PoolView` in `pool-view.tsx`, `CompareDialog` in `compare-view.tsx`), and no tool imports another tool's components: what two tools show goes in `src/components/`.

### Patterns

- **Card:** `rounded-2xl border-3 bg-card`, padded `p-3`–`p-4`. A card that is a link as a whole is `liftCardClass` and ends in a cyan `ArrowRight` (the admin home's and `/admin/series`'s links, `px-5 py-4.5`).
- **Box and cells** (the Pokémon PC look, after `pc.dc.html`): a `card` panel (`rounded-[18px] border-3 p-3.5`) with the count in the pixel face ("79 Pokémon", "12 of 79 Pokémon" while filtering), a search and a type select on `ink` (`h-12 rounded-[10px] border-3`) and its actions; under it the box, `bg-pc` checkered in `pc-check`, `rounded-xl`, holding square cells at least 106px wide from `sm` that stretch to fill each row (four to a row below). A cell is `bg-pc-cell rounded-xl` with the sprite at 96px, the level top-left in the pixel face with an `ink` drop, a yellow star for a shiny and a `?` for an unknown species; hovered or selected it takes a 3px inset `cyan` ring, selected also `bg-pc-cell-on`. Where the box scrolls (from `lg`, inside the page's height), a fade and a nudging cyan arrow button sit at the edge with more, scrolling a page; they stand still under `prefers-reduced-motion`. The team strip keeps the `bg-box` cells.
- **Actions:** `buttonClass` (or `<Button>`) for every action, with `iconButtonClass` for icon-only tools (`aria-label` and `title`). Destructive tools add `text-destructive`.
- **Quiet icon button:** `quietIconClass`, `size-7 rounded-md text-muted-foreground hover:bg-face hover:text-foreground` (a milestone's move up, move down and remove at `/admin/series`, dialog and sheet close).
- **Focus:** every interactive element `outline-none focus-visible:ring-3 focus-visible:ring-ring/50`.
- **View switch:** `Segmented`.
- **Search and filter:** a `label` wrapping a `Search` icon and a borderless input on `bg-cell` (inside a box) or `fieldClass` (elsewhere), `min-h-10`; a `SelectField` beside it for a filter.
- **Stat bars:** one `h-13 rounded-[10px] bg-box` row per stat, its label in pixel face coloured by nature (raised `text-stat-up`, lowered `text-stat-down`), an `h-4 rounded-sm bg-ink` track with a fill tinted by `tint` (`src/components/pc/summary.tsx`: `coral`, `yellow`, `green`, `cyan` as it nears the best stat possible), then IV and EV (not in Base) and the stat in pixel face.
- **Effectiveness and heat cells:** `chart-2` tints for good, `destructive-soft`/`destructive` for bad, `muted` with faded text for neutral; legends are swatches with short labels.
- **Pills and chips:** `rounded-full bg-secondary px-2.5 py-1 text-xs text-chart-3` for tags; `TypeChip` for types; a filter chip, the team list's player filter (`OwnerChip` in `src/pages/teams.tsx`), is `min-h-12 rounded-full border-3 bg-card` holding the player's badge (`size="xs"`), their name in `text-2xl` pixel face and a `size-9` round close link with a `size-5` `X` in `text-muted-foreground`, `bg-cell` on hover.
- **Empty slot / empty state:** a dashed outline (`border-2 border-dashed`, `border-cell-hi` inside a box; `border-3` on a card-sized one), muted text if any, `rounded-lg`–`rounded-2xl`; clickable ones open the action that fills them.
- **Drop zone:** `messageWidth` dashed card, `rounded-2xl border-3`, an icon tile on `bg-box`, a pixel-face line and a quiet file button (`buttonClass` on a `label`); the border turns `primary` while dragging over.
- **Warning:** it informs and never blocks, in one of three shapes. A row `rounded-xl border border-warning bg-warning-soft px-4 py-3`, a `TriangleAlert` in `warning`, bold text in `warning-ink` (the upload dialog's replace warning). The row also says what an old export lacks, where that gap shows (`GapWarning`, `px-3.5 py-2.5`, `text-sm`): over the summary's Stats, its Moves or its "Can learn", and in a bag pocket. Chips on the upload dialog's done step (`ExportGaps` in `src/components/upload-dialog.tsx`): `rounded-full border border-warning px-3 py-1 text-sm font-bold text-warning` with a `size-3.5` `TriangleAlert`, reading "Missing: " and the fields the export lacks, and, when entries were skipped, beside it or alone, a grey `rounded-full bg-cell px-3 py-1 text-sm font-bold text-subtle` chip reading "<n> skipped".
- **Admin panel:** controls only admins see, inside a page every reader sees: a `rounded-xl border-3 border-dashed border-warning/60 bg-card px-4 py-3` card titled "Admin" in `text-xl` pixel face `text-warning`, each control under a `text-lg` pixel-face label in `text-muted-foreground`, and under it its source in `text-sm`, `text-muted-foreground` for a value from the save and `text-warning` for one set by hand (`TrainerAdmin`). The amber dash marks it apart from the page's own cards and from an empty slot's `cell-hi` dash.
- **Errors:** an `alert` row, `rounded-xl border border-destructive bg-destructive-soft`, a `CircleAlert` in `destructive`. A whole-page failure is a plain `text-destructive` paragraph.
- **Tile:** a figure with its label, as on a trainer row (`Tile` in `src/pages/series.tsx`): `rounded-xl border-3 bg-card px-4 py-3` (`px-3 py-2.5` below `sm`), the label in `text-xl` pixel face `text-muted-foreground`, followed below `sm` by a small `primary` arrow on a tile that is a link, the value below in `text-5xl` pixel face (`text-4xl` below `sm`), a count or a short text such as a play time, never wrapping, `text-faint` while it is "—", `text-destructive` for a fainted count above 0. A tile that is a link lifts with a `primary` border on hover.
- **Banner:** a series on its scene as a whole-width link (`src/pages/series-list.tsx`): `liftCardClass` with `h-35 overflow-hidden` (the same height on a phone, on the scene's phone crop), `SceneArt` behind, the name in pixel face with the scene's `title` shadow and the game on the scene's `chip`, the state at the top right on `bg-primary` (playing now) or `bg-ink` (finished) with a 3px `ink` border.
- **Admin pages** (after the `admin-*.dc.html` boards): the admin tabs first, then sections as `rounded-2xl border-3 bg-card` cards titled in `text-[2.125rem]` pixel face (`text-[1.75rem]` below `sm`), a count beside a title in `text-muted-foreground`; a one-line create form ("New series", "New game") as a card whose title, fields and `go` button share a row from `sm`; rows inside a card on `bg-box` with a `border-2 border-cell`; a destructive action as a `destructive` outline that fills `destructive` with `ink` text on its confirming second press; a series shown as its scene banner, a draft faded (`opacity-35` art) on `ink` with a dashed `cell-hi` border; a series' state as a chip, Draft `warning`, Playing now `primary`, Finished `ink`; the series form's side panel sticky from `lg`, its Save and Start a bar along the screen's bottom below it.
- **Team page** (after `team.dc.html` and `team-phone.dc.html`): from `lg` the page fills the screen's height, a two-column grid of member cards (`auto-rows-[minmax(246px,auto)]`, a member card's height, scrolling inside; an empty slot keeps that height too, `min-h-61.5`, so filling it moves nothing) beside a `rounded-[18px] border-3 bg-card` panel, `border-border` on the analysis and `border-primary` on a summary or an editor. A member card is `rounded-[14px] border-3 bg-card`, `border-primary` while one of its parts is edited and `border-yellow` with a faint yellow ring just after it was put in; its header row, item, ability and moves are `border-3` buttons on `box` (`cell` and `border-primary` when pressed), a move it cannot learn `border-destructive bg-destructive-soft`, the source's tag in the player's colour, or a free member's "Free" on a dashed `border-faint` with a **Set** button beside it. The head's Members switch, and above six members the panel's Analyse switch, are segmented tracks (`rounded-xl border-3 bg-ink p-1`, the chosen `bg-border text-white`), and in Pick 6 each card's In is `bg-primary text-ink`, its Out `bg-cell text-subtle` on `border-cell-hi`, an Out card at `opacity-55`. An editor heads with a `size-10` back button and "<member> · <what>" in pixel face, then a segmented track (`segTrack`, `segButton` in `src/teams/components/editors.tsx`) or a search, a scrolling list of `pickRow`s and, for an item, a selected-item box ending in the `go` button. Below `lg`, a Members · Analysis track, and the summary and editors in a full-screen `Dialog` on `bg-card`. The add dialog and Full analysis are full-screen dialogs on the page's background with an `ink` head on a `border-red` bottom line, as the boards draw them. Each source in the head is a `min-h-8.5 rounded-lg border-3 bg-ink` chip in pixel face, the player's initial on a `size-5` tile in their colour and its Mini Setas and then its money left for mints (`$1,138,806`, `$?` without money) in `text-subtle` (each `text-coral` below zero), with a `size-6` `rounded-md border-2 border-cell-hi bg-cell` remove button while it may be removed; **+ Source** is a quiet `bg-white/10` button with a `primary` plus, opening `SnapshotMenu` (`src/teams/components/snapshot-menu.tsx`), a `rounded-xl border-3 border-cell-hi bg-ink` popover of `min-h-11` menu items grouped under a muted series heading when there are several, which the team list's New team opens too, ending in "Any Pokémon" while the team does not allow free members. "Any Pokémon" is a chip of its own, on a dashed `border-faint`, a pixel sparkle (`AnyMark`) in place of the initial and no Mini Setas. The add dialog's sources are a "From" segmented track in its head; its Any Pokémon tab is the pool's species, a grid of `pc-cell` squares on `box` with a search and a type filter, beside a `w-95` aside (a bottom sheet below `lg`) of the summary's head and the set form: Level and Nature fields, then one `box` row per stat with its base bar (`tint` of `src/components/pc/summary.tsx`), EV and IV boxes and the stat at its level, the EV total turning `text-coral` above 510 (`SetForm`, `FreePicker` in `src/teams/components/free-member.tsx`), the same form a free member's Set opens in the panel.
- **Sticky aside:** on wide screens a side pane is `sticky top-4 max-h-[calc(100svh-2rem)] border-3 bg-card`: the PC's summary (`SummaryAside`, `w-95 rounded-[18px]`, its optional footer at the bottom) and the rules' contents (`src/components/rules.tsx`, `w-72 rounded-2xl`).

## Imagery and Icons

- **Pokémon sprites:** Showdown's Gen 5 sprites through `@pkmn/img`'s `Sprites.getPokemon(name, { gen: "gen5", shiny, gender })`, always `[image-rendering:pixelated]`, `alt=""` when a label already names the Pokémon.
- **Item icons:** `@pkmn/img`'s `Icons.getItem`, a background position on Showdown's sheet (`ItemIcon`).
- **Type icons:** duiker101's SVG paths in `src/lib/type-icons.ts`, white on the type's colour.
- **Pixel icons:** `PixelIcon`, drawn on a 10, 12 or 14 unit grid with `shapeRendering="crispEdges"`: the home mark, the header's tab icons, its menu button, the League placeholder's barrier, and the admin pages' `arrow`, `plus`, `up`, `down`, `alert`, `check`, `cross`, `upload`, `download` and `cartridge`. A new pixel icon is added to its `ICONS` table.
- **Series scenes:** `SceneArt`, pixel art drawn in code, one per series, in the `scene-*` tokens.
- **UI icons:** `lucide-react`, `aria-hidden` beside a text label or with `aria-label` when alone; sizes `size-3.5`–`size-5.5`. In use: `ArrowRight`, `Upload`, `Plus`, `X`, `Pencil`, `Copy`, `Trash2`, `ClipboardPaste`, `ClipboardCopy`, `ClipboardCheck`, `Check`, `Search`, `ShoppingBag`, `Package`, `CircleAlert`, `TriangleAlert`, `Info`, `ChartNetwork`.
- **Tab icon:** `public/favicon.svg`, with `favicon-32.png` and `apple-touch-icon.png` rendered from it.
