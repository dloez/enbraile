# pkmn/site

Adds to the root and `pkmn/` `CLAUDE.md`; never repeats them. The site's docs live in `docs/pkmn/site/`, never under `pkmn/site/`: [The pkmn Site](../../docs/pkmn/site/explanation/site.md), [Open Sheet](../../docs/pkmn/site/explanation/open-sheet.md) and [How to Run and Deploy the Site](../../docs/pkmn/site/how-to/run-and-deploy-the-site.md).

- **Gate:** `npm run gate` (`tsc -b`), from `pkmn/site/`. It must pass before a change is done.
- **Versions:** every package is pinned exactly (`.npmrc` sets `save-exact`); a new one goes in at its latest stable version, and `npm outdated` stays empty.
- **Install scripts:** npm runs only those listed under `allowScripts` in `package.json`; approve a new one with `npm approve-scripts <pkg>`.
- **Routes** are declared in code in `src/router.tsx`; a tool gets its route there and its card on the home page from `src/tools.ts`.
- **Theme:** dark only. Colours are the CSS variables in `src/index.css`'s `:root`, taken from the Open Sheet Screens design; use the Tailwind tokens (`bg-card`, `text-primary`, `bg-box`, `bg-cell`…), never raw colours in components. Fonts: `font-heading` (Chakra Petch), `font-sans` (IBM Plex Sans), `font-mono` (IBM Plex Mono).
- **UI components** come from shadcn (`npx shadcn@<pinned version> add <component>`) into `src/components/ui/`.
