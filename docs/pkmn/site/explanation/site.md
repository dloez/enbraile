# The pkmn Site

The group's Pokémon web app, `pkmn/site/`, served at `pkmn.enbraile.vip`. It holds a home page listing the tools, [Open Sheet](open-sheet.md) at `/open-sheet` and Team Analysis at `/team-analysis` ([Team Analysis: Discovery](../../../work-in-progress/team-analysis-discovery.md)). More tools will join it over the series, and a Cloudflare Workers backend may follow. Running and deploying it is in [How to Run and Deploy the Site](../how-to/run-and-deploy-the-site.md). It was scoped with the owner on 2026-10-15.

## Stack

npm; Vite 8, React 19, TypeScript 7, Tailwind 4 and shadcn/ui; TanStack Router; zod 4; Dexie over IndexedDB; `@pkmn/dex` and `@pkmn/img` for Showdown's data and sprites. Every package is pinned exactly, at its latest stable version when it went in (the scaffold, 2026-10-16: vite 8.3.4, react 19.3.1, typescript 7.0.2, tailwindcss 4.3.3, shadcn 4.21.5, @tanstack/react-router 1.170.44, vitest 5.0.5, @cloudflare/vite-plugin 1.64.0, wrangler 4.151.0, @pkmn/dex 0.10.11, @pkmn/img 0.3.4). The gate is `npm run gate`: `tsc -b` and `vitest run`.

Routes are declared in code in `src/router.tsx`, not with TanStack Router's file-based plugin: a handful of routes needs no generated route tree for `tsc` to check before a build. A tool gets its route there and its home-page card from `src/tools.ts`.

## Look

The [Open Sheet Screens](https://claude.ai/artifact/SfpFcW5UoLVLeLAmdJZMG1) design in Claude Design, signed off by the owner on 2026-10-16, sets the look: one dark theme, charcoal with a slate-blue PC and orange for actions, and no light theme. No helper text explaining the UI. The UI is in English, since Showdown's names are. Desktop-first, with every view usable on a phone.

shadcn was initialised with its Nova preset on Radix, its palette replaced by the design's colours as the only theme. Colours are CSS variables in `src/index.css`'s `:root`, used through Tailwind tokens; the vendored components in `src/components/ui/` follow the same rule, and the scrim behind dialogs and sheets is a `--scrim` variable set to the design's `rgba(0,0,0,0.6)`, used as `bg-scrim`. The design's fonts (Chakra Petch, IBM Plex Sans, IBM Plex Mono) are bundled from Fontsource rather than loaded from Google Fonts, so the only runtime calls the site makes are for Showdown's sprites.

## Data and Storage

Everything a reader imports or builds stays in their browser, in IndexedDB, per browser and device. Nothing goes to a server, and there are no accounts. Game data (names, descriptions, base stats, the type chart) is bundled from `@pkmn/dex`; no API is called at runtime. Sprites load from Showdown's sprite server, `play.pokemonshowdown.com`, through `@pkmn/img`'s URLs.

## Hosting and Deploys

A Cloudflare Worker with static assets, built with `@cloudflare/vite-plugin`, serves the site with single-page-application fallback. It is static only for now; the same Worker can take API routes when a backend comes, with no move to another product. `wrangler.jsonc` attaches `pkmn.enbraile.vip` as a custom domain (the `enbraile.vip` zone is on the owner's Cloudflare account) and sets `preview_urls`, so each branch's Preview gets a public `workers.dev` URL.

Cloudflare Workers Builds, connected to the GitHub repository in the Cloudflare dashboard, builds and deploys each push to `main` that touches `pkmn/site/`, with preview URLs for branches. There are no secrets in the repository. A bad deploy is undone by rolling back to an earlier Worker version in Cloudflare, or by reverting the commit, which redeploys.

The site logs nothing of its own: Cloudflare's built-in Workers analytics and logs cover the deploy, and import errors are shown to the reader.

## Decisions

- **One site for the group's Pokémon tools,** `pkmn/site/`, starting with Open Sheet at `/open-sheet` beside a home page listing the tools; its docs in `docs/pkmn/site/`. **Why:** the site will grow in depth over the series. _(owner, 2026-10-15)_
- **Vite, React, TypeScript, Tailwind and shadcn at their latest versions, pinned exactly;** TanStack Router, zod, Dexie, `@pkmn/dex` and `@pkmn/img` alongside. **Why:** the owner chose the core stack to future-proof the site; the rest follows the owner's unlit and blink sites (`~/workspace/unlit/apps/web/`, `~/workspace/blink/`), confirmed by the owner. _(owner, 2026-10-15)_
- **Routes in code, shadcn's Nova preset on Radix with the design's palette, Fontsource fonts, static assets with SPA fallback:** build choices made while scaffolding. **Why:** no generated route tree to check, and no runtime calls beyond sprites. _(settled 2026-10-16)_
- **The vendored shadcn components follow the theme rule,** with the dialog scrim as a `--scrim` variable. **Why:** delegated by the owner during an unattended run; the scaffold already replaced shadcn's palette and the design draws that scrim. _(settled 2026-10-16)_
- **The Open Sheet Screens design, dark only, no explanatory labels, English, desktop-first.** _(owner, 2026-10-16)_
- **Nothing is stored server-side:** imports and teams live in the reader's IndexedDB. _(owner, 2026-10-15)_
- **Cloudflare Workers with static assets at `pkmn.enbraile.vip`, deployed by Workers Builds** on pushes to `main` touching `pkmn/site/`, with branch preview URLs. **Why:** the owner chose Cloudflare and the domain, and expects a Workers backend later. _(owner, 2026-10-15)_ Seen working on 2026-10-17: the bundle served at `pkmn.enbraile.vip` held code from the latest commit on `main`.
