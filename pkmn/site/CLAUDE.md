# pkmn/site

Adds to the root and `pkmn/` `CLAUDE.md`; never repeats them. The site's docs live in `docs/pkmn/site/`, never under `pkmn/site/`: [The pkmn Site](../../docs/pkmn/site/explanation/site.md), [Open Sheet](../../docs/pkmn/site/explanation/open-sheet.md), [Site Design System](../../docs/pkmn/site/reference/design-system.md) and [How to Run and Deploy the Site](../../docs/pkmn/site/how-to/run-and-deploy-the-site.md).

- **Gate:** `npm run gate` (`tsc -b`), from `pkmn/site/`. It must pass before a change is done.
- **Versions:** every package is pinned exactly (`.npmrc` sets `save-exact`); a new one goes in at its latest stable version, and `npm outdated` stays empty.
- **Install scripts:** npm runs only those listed under `allowScripts` in `package.json`; approve a new one with `npm approve-scripts <pkg>`.
- **API:** server code lives in `api/_lib/` behind the one Vercel Function `api/index.ts`, with `.js` endings on relative imports; a schema change in `api/_lib/schema.ts` comes with its generated migration in `drizzle/`, forward only. Secrets go in `.env.local` and Vercel, and every variable is named in `.env.example`.
- **Routes** are declared in code in `src/router.tsx`; a tool gets its route there and its card on the home page from `src/tools.ts`.
- **Design system:** [Site Design System](../../docs/pkmn/site/reference/design-system.md) describes the site's look; the code is its source of truth. Dark only; colours only through the tokens in `src/index.css`'s `:root`, never raw colours in components. New UI uses the existing tokens, shared components and patterns first. Any change to a token, a shared component, the layout shell or a reusable pattern updates that doc in the same change. Adding a page: [How to Add a Page to the Site](../../docs/pkmn/site/how-to/add-a-page-to-the-site.md).
- **UI components** come from shadcn (`npx shadcn@<pinned version> add <component>`) into `src/components/ui/`.
- **Design sources:** `design/` holds frozen copies of the signed-off Claude Design boards ([The pkmn Site → Look](../../docs/pkmn/site/explanation/site.md#look)). Build from them for exact colours, sizes and spacing; never edit them by hand, and never ship their sample data or their Google Fonts link.
