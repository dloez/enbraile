# Site Design System

The visual system of `pkmn/site/`: its tokens, type, layout shell, components and recurring patterns. The code is the source of truth: the tokens in `src/index.css`, the shell in `src/router.tsx` and `src/components/site-header.tsx`, and the components named below. This doc describes them and changes in the same commit as they do (`pkmn/site/CLAUDE.md`). Why the site looks this way is in [The pkmn Site → Look](../explanation/site.md#look). Adding a page is in [How to Add a Page to the Site](../how-to/add-a-page-to-the-site.md).

## Rules

- **One dark theme.** `index.html` sets `class="dark"` and `color-scheme: dark`; there is no light theme and no theme switch.
- **Tokens only.** Every colour comes from a CSS variable in `src/index.css`'s `:root`, used through its Tailwind token (`bg-card`, `text-primary`, `border-cell-hi`…) or, where a class cannot reach it (inline `style`, canvas, SVG built in code), as `var(--name)`. No hex, `rgb()` or Tailwind palette classes (`bg-red-500`) in components.
- **No helper text** explaining the UI. Labels name things; they do not instruct.
- **English UI**, with Showdown's names.
- **Desktop-first, every view usable on a phone.**
- **No runtime calls** beyond Showdown's sprites: fonts are bundled from Fontsource, type icons from `src/lib/type-icons.ts`.

## Colour Tokens

All in `src/index.css`'s `:root`; Tailwind sees each as `--color-<name>` through `@theme inline`.

### Surfaces

| Token | Value | Role |
|-------|-------|------|
| `background` | `#111216` | Page background; the active tab, which merges into the page |
| `card` | `#191b21` | The header bar, cards, panels, the summary aside, dialogs and sheets (passed as `bg-card`) |
| `popover` | `#191b21` | shadcn's dialog and sheet default surface; same as `card` |
| `muted` | `#0d0e12` | Inset wells: segmented-control tracks, inputs (`fieldClass`), bar tracks, inline rename fields |
| `box` | `#1d2030` | The PC box and team strip: the slate-blue container a grid of cells sits in; icon tiles |
| `cell` | `#272b3d` | A cell inside a box (PC slot, search field and select in the box); icon-button hover |
| `cell-hi` | `#363c56` | A selected cell; the active PC/Team switch; empty team slot outline |
| `secondary` | `#272b3d` | Active segment in `Segmented`; pill tags |
| `accent` | `#33231a` | Orange-tinted fill for a chosen option: the current ability, a pressed `Toggle` |
| `scrim` | `rgba(0,0,0,0.6)` | Behind dialogs and sheets (`bg-scrim`) |

### Text and lines

| Token | Value | Role |
|-------|-------|------|
| `foreground` | `#e8e9ee` | Body text; also `card-`, `popover-`, `secondary-`, `accent-foreground` |
| `muted-foreground` | `#9a9dab` | Secondary text: labels, counts, inactive tabs, table headers. Faded with `/40`–`/60` for zero values |
| `border` | `#2a2d37` | Every border (set as the default border colour in `@layer base`); `input` is the same |
| `ring` | `#f28c4b` | Focus ring, always used as `ring-3 ring-ring/50` |

### Signal colours

| Token | Value | Role |
|-------|-------|------|
| `primary` | `#f28c4b` | Orange: actions (filled buttons, the import `+`), selection borders, the current choice, a nature's raised stat, the top value of a bar |
| `primary-foreground` | `#1c0b02` | Text on `primary` |
| `destructive` | `#ff8a80` | Errors, refusals, unknown marks (`?`), weaknesses, delete actions |
| `destructive-soft` | `#3a1c1d` | Fill behind an error or a weakness cell |
| `chart-1` | `#f28c4b` | Series 1; equals `primary` |
| `chart-2` | `#8db8f5` | Blue: the "good for us" side: resistances, super-effective coverage, a nature's lowered stat, speed bars, series 2 |
| `chart-3` | `#c9cbd6` | Neutral grey: ordinary bars, coverage lines, tag text, series 3 |
| `chart-4` | `#ff8a80` | Series 4; equals `destructive` |
| `chart-5` | `#9a9dab` | Unused; equals `muted-foreground` |

Scales of one hue are built with opacity on the token (`bg-chart-2/10`, `/15`, `/25`, `/35`, `/40`; `bg-destructive/45`) or, for a continuous value, `color-mix(in oklch, var(--chart-2) N%, transparent)`.

`sidebar-*` tokens exist because shadcn's preset declares them; nothing uses them.

### Types

`--type-<type>` for the 18 types, lower-case (`--type-fire: #e62829`…), used only through `var(--type-${type.toLowerCase()}, var(--muted-foreground))`. Values are in `src/index.css`.

## Typography

Fonts are bundled from Fontsource and exposed as Tailwind families:

| Class | Font | Weights loaded | Used for |
|-------|------|----------------|----------|
| `font-heading` | Chakra Petch | 600, 700 | Page and section titles, card names, the site name, Pokémon names in summaries |
| `font-sans` (default) | IBM Plex Sans | 400, 500, 600 | Everything else |
| `font-mono` | IBM Plex Mono | 400, 500 | Numbers (levels, stats, IVs/EVs, counts), file names, tab names, the domain in the header |

Sizes as used (Tailwind's scale plus fixed pixel sizes from the design):

| Size | Where |
|------|-------|
| `text-[34px]` → `sm:text-5xl`, bold | A page's `h1` (home) |
| `text-[22px]`, semibold–bold | Section `h2`, the summary's name, home cards |
| `text-[17px]`, semibold, `tracking-[0.04em]` | Box titles ("PC 56") |
| `text-base` heading, semibold | Panel `h3`, the header's page title |
| `text-[13px]` | Controls (buttons, segments, fields), tab names, secondary body text |
| `text-xs` | Table cells, chips, small labels |
| `text-[11px]` / `text-[10px]` | Cell overlays (level, name), pills, chart labels |
| `text-[13px] font-semibold tracking-[0.06em] uppercase text-muted-foreground` | Small group headings inside a card ("ABILITY") |

Weights: `font-semibold` is the default emphasis; `font-bold` only for headings and marks.

## Radius, Spacing, Shadow

`--radius` is `0.625rem` (10px); `rounded-lg` = 10px, `rounded-md` = 8px, `rounded-sm` = 6px, `rounded-xl` = 14px, `rounded-2xl` = 18px.

| Radius | Used on |
|--------|---------|
| `rounded-2xl` | Cards, panels, the PC box, the summary aside, home cards |
| `rounded-xl` | Inner cards (ability rows), refusals, empty-slot placeholders, dialogs |
| `rounded-lg` / `rounded-[10px]` | Buttons, fields, selects, segmented tracks, PC cells |
| `rounded-md` | Icon buttons, item icons, type squares |
| `rounded-full` | Type dots and chips, pills |
| `rounded-[20px]` | The drop zone; a bottom sheet's top corners |

Spacing is Tailwind's 0.25rem scale, quarter steps allowed (`gap-3.5`, `py-2.25`). Common: `gap-2`/`gap-2.5` inside controls and rows, `gap-3.5`–`gap-4.5` between cards, `p-3.5` inside a panel.

No shadows in site components; surfaces are separated by fill (`background` → `card` → `box` → `cell`) and 1px `border`. Only shadcn's sheet keeps its `shadow-lg`.

## Layout Shell

- **Root** (`src/router.tsx`): a `flex min-h-svh flex-col` column holding `SiteHeader` and the route's `<Outlet />`. Each page renders its own `<main className="flex-1 …">`.
- **Header** (`src/components/site-header.tsx`): `h-14`, `bg-card`, bottom border, `px-4 sm:px-8`. The site name `pkmn` (heading, bold) with `.enbraile.vip` (mono, muted) links home; after a `/`, the page title from the route's `staticData.title`. No other navigation.
- **Page gutters:** `px-4 sm:px-8` for page-level content (home, import, tab bar); full-width tool views use `px-3 sm:px-6`.
- **Widths:**

  | Width | Used for |
  |-------|----------|
  | `max-w-240` (60rem) | Home's content column |
  | `max-w-344` (86rem) | Team Analysis's page column |
  | Full width | Open Sheet's PC and team views |
  | `max-w-180` (45rem) | A single message or form in a page: drop zone, refusal, storage error |

- **Breakpoints:** Tailwind's. `sm` (40rem) is the phone/desktop switch for gutters, sizes and grid columns; `lg` (64rem) splits a page into side-by-side cards (`lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`) and, through `useMediaQuery("(min-width: 64rem)")` (`src/hooks/use-media-query.ts`), swaps a sticky side aside for a bottom sheet below it.
- **Phone rules:** grids collapse to one column; a detail pane becomes a bottom `Sheet` (`side="bottom"`, `max-h-[90svh]`, `rounded-t-[20px]`); wide tables and tab bars scroll horizontally (`overflow-x-auto`) with a sticky first column; touch targets are at least `min-h-10`, primary actions `min-h-11`.

## Components

### Shared

| Component | Path | Use |
|-----------|------|-----|
| `Button` | `src/components/ui/button.tsx` | shadcn button; used inside dialogs (`variant="outline"` to cancel, `"destructive"` to delete, default to confirm) |
| `Dialog` | `src/components/ui/dialog.tsx` | Modal on `bg-scrim`; pass `className="bg-card"`; title in `font-heading text-lg font-bold`; `aria-describedby={undefined}` when there is no description |
| `Sheet` | `src/components/ui/sheet.tsx` | Bottom sheet for a phone's detail pane (imported as `BottomSheet` in the PC) |
| `SiteHeader` | `src/components/site-header.tsx` | The header; reads `staticData.title` |
| `TypeDot`, `TypeChip`, `TypeSquare`, `UnknownMark` | `src/open-sheet/components/marks.tsx` | A type as its colour with the white symbol (dot 16px, chip with name, square 24px); `?` in `destructive` for anything Showdown lacks. Used by both tools |
| `Panel` | `src/team-analysis/components/controls.tsx` | A titled card: `rounded-2xl border bg-card p-3.5`, `h3` in heading, optional `aside` |
| `Segmented` | same | A `radiogroup` of options on a `bg-muted` track; the chosen one `bg-secondary` |
| `Toggle` | same | An on/off button; on is `border-primary bg-accent text-primary` |
| `fieldClass`, `buttonClass`, `primaryClass` | same | Class strings for a field (`bg-muted`), an outlined button (`bg-card`) and the orange action button, all `min-h-10 rounded-lg text-[13px]` |
| `MonSprite` | `src/open-sheet/components/summary.tsx` | A sheet Pokémon's sprite, or a muted `?` |
| `ItemIcon` | `src/open-sheet/components/bag.tsx` | An item's 24px icon from Showdown's item sheet |

### Patterns

- **Card:** `rounded-2xl border bg-card`, padded `p-3.5` (panels) or `px-5 py-4.5` (home links). A link card turns `hover:border-primary` and ends in an orange `ArrowRight`.
- **Box and cells** (the Pokémon PC look): a `bg-box rounded-2xl` (or `rounded-[14px]`) container with a heading-font title and count, holding a responsive grid (`grid-cols-[repeat(auto-fill,minmax(72px,1fr))] sm:…minmax(112px,1fr)`) of square `bg-cell rounded-[10px]` buttons. Selected: `border-2 border-primary bg-cell-hi`. A cell overlays the level (mono, top-left), a `?` mark (top-right) and the name (bottom, hidden on phones).
- **Primary action:** orange fill, `bg-primary text-primary-foreground font-semibold`, `rounded-[10px]`/`rounded-lg`, `min-h-10`–`min-h-11`. One per view (Bag, Add to team, Choose a file, Analyse).
- **Secondary action:** outlined, `border bg-card` (`buttonClass`); icon-only tool buttons are `size-10 rounded-lg border bg-card` with `aria-label` and `title`. Destructive tools add `text-destructive`.
- **Quiet icon button:** `size-7 rounded-md text-muted-foreground hover:bg-cell hover:text-foreground` (tab rename/close).
- **Focus:** every interactive element `outline-none focus-visible:ring-3 focus-visible:ring-ring/50`.
- **Tabs (file tabs):** a bottom-bordered `nav` of mono 13px tabs; the active one `rounded-t-[10px] border border-b-0 bg-background`, merging into the page; actions appear on the active tab only; an orange `+` ends the row.
- **View switch:** `Segmented` (or Open Sheet's PC/Team `tablist`, same track with `bg-cell-hi` for the chosen view).
- **Search and filter:** a `label` wrapping a `Search` icon and a borderless input on `bg-cell` (inside a box) or `fieldClass` (elsewhere), `min-h-10`; a native `select` styled the same.
- **Definition list:** `dl` grid with a fixed label column (`grid-cols-[90px_1fr] sm:grid-cols-[96px_1fr]`), `dt` muted, `dd font-medium`.
- **Stat bars:** a label coloured by nature (raised `text-primary`, lowered `text-chart-2`), the value in mono, an `h-2 rounded-sm bg-muted` track with a fill in `primary` / `chart-2` / `chart-3`, scaled to 160 base.
- **Effectiveness and heat cells:** `chart-2` tints for good, `destructive-soft`/`destructive` for bad, `muted` with faded text for neutral; legends are swatches with short labels.
- **Pills and chips:** `rounded-full bg-secondary px-2.5 py-1 text-xs text-chart-3` for tags; `TypeChip` for types.
- **Empty slot / empty state:** a dashed outline (`border-2 border-dashed`, `border-cell-hi` inside a box), muted text if any, `rounded-[10px]`–`rounded-xl`; clickable ones open the action that fills them.
- **Drop zone:** `max-w-180` dashed card, `rounded-[20px]`, an icon tile on `bg-box`, a heading line and an orange file button; the border turns `primary` while dragging over.
- **Errors:** an `alert` row, `rounded-xl border border-destructive bg-destructive-soft`, a `CircleAlert` in `destructive`, file names and code in mono. A whole-page failure is a plain `text-destructive` paragraph.
- **Sticky aside:** on wide screens a detail pane is `sticky top-4 w-100 max-h-[calc(100svh-2rem)] rounded-2xl border bg-card`, its footer action above a top border.

## Imagery and Icons

- **Pokémon sprites:** Showdown's Gen 5 sprites through `@pkmn/img`'s `Sprites.getPokemon(name, { gen: "gen5", shiny, gender })`, always `[image-rendering:pixelated]`, `alt=""` when a label already names the Pokémon.
- **Item icons:** `@pkmn/img`'s `Icons.getItem`, a background position on Showdown's sheet (`ItemIcon`).
- **Type icons:** duiker101's SVG paths in `src/lib/type-icons.ts`, white on the type's colour.
- **UI icons:** `lucide-react`, `aria-hidden` beside a text label or with `aria-label` when alone; sizes `size-3.5`–`size-5.5`. In use: `ArrowRight`, `Upload`, `Plus`, `X`, `Pencil`, `Copy`, `Trash2`, `ClipboardPaste`, `ClipboardCopy`, `ClipboardCheck`, `Check`, `Search`, `ShoppingBag`, `Package`, `CircleAlert`, `TriangleAlert`, `Info`, `ChartNetwork`.
- **Tab icon:** `public/favicon.svg`, with `favicon-32.png` and `apple-touch-icon.png` rendered from it.
