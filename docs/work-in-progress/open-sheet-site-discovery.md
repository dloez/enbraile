# Open Sheet: Site Discovery

The decisions behind part 2 of [Open Sheet](open-sheet.md): the web app that reads open-sheet exports and helps the reader understand them and build teams from them. It is the first tool of the pkmn site, which will grow more tools and, later, a backend. Scoped with the owner on 2026-10-15.

## Goal and Success

**Q: What is the site?**
A: The group's Pokémon site, `pkmn/site/`. For now it holds one tool, Open Sheet; later tools join it, and a Cloudflare Workers backend may follow.
**Why:** the owner: the site will grow in depth over the series, and this is the tool needed now.

**Q: What does the Open Sheet tool do?**
A: It imports exports, each into its own tab, and on every tab lets the reader look through the sheet in a PC, search it and filter it by type, build teams from it in that same PC, and analyse a team on a team page.
**Why:** the owner chose the browse, filter, two-sheet and team-builder jobs; the team page follows pokeos's builder: stats, what is effective and what is not.

**Q: Does the site know whose sheet is whose?**
A: No. It has no notion of "my sheet" or "the rival's sheet". Any number of exports can be imported, each opens in its own tab, and every feature works on every tab.
**Why:** the owner: the reader does whatever they want with each import.

**Q: When is it done?**
A: Deployed at `pkmn.enbraile.vip`, a reader drops in two exports, gets two tabs, browses each with sprites, Showdown base stats, abilities, items and TMs, builds a named team in either tab, sees its stats, defensive chart and offensive coverage, and copies it as Showdown text; closing and reopening the browser keeps the tabs and teams.

## Scope Edges

**Q: What is out?**
A: A matchup of a team against another tab's Pokémon (the team page analyses the team alone), a damage calculator, shareable links, accounts and any server-side storage, a Spanish UI, and TM compatibility (the export leaves it out on purpose: [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md)).
**Why:** the owner chose team-only analysis and no damage calc for now; the rest follows from the decisions below.

**Q: Does the design account for data the export does not carry?**
A: Yes. Moves, learnsets and IVs or stats are not in the export, but the views and the stored model leave room for them: a member already has four move slots, and a learnset arriving in a later export narrows the move picker instead of reshaping the builder.
**Why:** the owner: build with those in mind.

## Interfaces and Integration

**Q: What does the site read?**
A: The JSON that `pkmn/tools/export_data.py` writes, exactly as [Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md) defines it, which owns that format. Which items go out (Showdown's `data/items.ts` keys, held items of permafainted Pokémon counted, `tinymushroom` kept) is decided in [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md#decisions).

**Q: How does a file get in?**
A: Dropped onto the page or chosen with a file picker, read in the browser and validated against a schema of the JSON reference. A file that fails validation is refused with what was wrong. Each import opens a new tab named after the file (`MIRAMEEE-open-sheet.json` → `MIRAMEEE`), renamable. Nothing is uploaded.

**Q: Where do names, descriptions, base stats and the type chart come from?**
A: `@pkmn/dex`, Showdown's data as an npm package, Gen 9, bundled into the site. No API is called at runtime.
**Why:** the owner asked for a good source of base stats and sprites. Fights are Showdown "[Gen 9] Custom Game" (Wonder: `docs/domains/competition/reference/rules.md` → The League), and several Gen 1–5 Pokémon gained base stats in Gen 6+, so Showdown's Gen 9 data is what the fight runs; PokéAPI's cartridge data is not. It is also the source the export's IDs already follow.

**Q: Where do sprites come from?**
A: Showdown's sprite server, through `@pkmn/img`'s URLs: Pokémon (shiny and female variants, Gen 5 static and animated sets fit the Gen 1–5 roster) and item icons. They load from `play.pokemonshowdown.com`, so they are not stored in the site. `sprites/gen5/walrein.png` and `sprites/gen5ani-shiny/walrein.gif` were checked to load (2026-10-15).

**Q: Whose types drive the analysis: the export's or Showdown's?**
A: Showdown's, with its base stats. A card shows the export's `types` and flags a species whose export types differ from Showdown's.
**Why:** forced by where the fight runs: Showdown sets a species' types from its own data, whatever the save says. The mod's types are modern (Clefairy is `FAIRY` in Wonder's `types.txt`), so a mismatch should be rare. _(2026-10-15)_

**Q: What about an ID `@pkmn/dex` does not know?**
A: It is shown by its raw ID with a marker, and kept out of the analysis. `tinymushroom` is the one expected case and gets a hand-kept label, "Mini Seta (Tiny Mushroom)".

**Q: Can a team leave the site?**
A: Yes: a button copies it in Showdown's team format: species, nickname, gender, shiny, item, ability, nature, Level 50 and the picked moves, with no IVs or EVs.
**Why:** the owner. Level 50 is the league's format (Wonder: `rules.md` → Pokepastes).

## The Builder and the Team Page

**Q: How is a team built?**
A: In the PC, by pointing and clicking, with no drag and drop. The PC is the tab's main view: its Pokémon in a scrollable box grid, searchable by name and filterable by type, under a strip of six team slots. Clicking a Pokémon opens its summary (Info, with every possible ability and its description, and Stats); its button adds it to the first free slot or removes it. A Bag button opens a scrollable bag with Items, Berries and TMs pockets; clicking an entry shows the team's members, and clicking one gives it the item or teaches it the TM. The Team view shows each member's item, ability, four moves and Level 50 stats, with the analysis below; clicking a member's item slot opens the bag for that member. Each tab holds any number of named teams, which can be created, renamed, duplicated and deleted.
**Why:** the owner, in the design pass: a real Pokémon PC with a bag, point and click rather than drag, and many teams per tab. _(2026-10-16)_

**Q: Do item quantities limit a team?**
A: Yes. An item can be held by no more members than the tab's `quantity` of it; once used up, it shows as unavailable.
**Why:** the owner.

**Q: Which ability can a member use?**
A: Its current ability by default, switchable to any of its `abilities` (base or hidden), marked as not its current one. The team shows how many Mini Setas the build needs, one for each member whose picked ability is not its current one, against the tab's `tinymushroom` quantity.
**Why:** the owner: an NPC switches an ability for 1 Mini Seta, to any of the Pokémon's abilities, hidden included.

**Q: What goes in a member's four move slots?**
A: The tab's TMs first (any TM on any member, since compatibility is unknown), then any Gen 1–5 move. Picked moves feed offensive coverage.
**Why:** the owner.

**Q: What does the team page show?**
A: Stats: each member's base stats and its Level 50 stat range (IVs 0–31, 1 EV in every stat, its nature), and the team's speed order. A defensive chart: for each of the 18 types, how many members are weak, resist or are immune, counting the abilities that change matchups (Levitate, Flash Fire, Water Absorb, Thick Fat and the like, a hand-kept list of Gen 3–5 abilities), with holes flagged. Offensive coverage: which types the picked moves hit super-effectively, a member's STAB types standing in when it has no moves, and which types nothing covers.
**Why:** the owner chose stats, defensive chart and offensive coverage. The Level 50 range is exact for the league's pokepastes: Level 50, real IVs, 1 EV in every stat (Wonder: `rules.md` → Pokepastes).

## Surfaces, Reuse and Data

**Q: Where does the code live?**
A: `pkmn/site/`, a project of its own; its lasting docs go under `docs/pkmn/site/`. Open Sheet is a route of the site (`/open-sheet`), beside a home page that lists the tools.
**Why:** the owner.

**Q: What is it built with?**
A: npm; Vite 8, React 19, TypeScript 7, Tailwind 4 and shadcn/ui, each at its latest stable version on the day the site is scaffolded, pinned exactly; TanStack Router; zod 4 for the import schema; Dexie over IndexedDB for storage; `@pkmn/dex` and `@pkmn/img`. The gate is `npm run gate`: `tsc` and `vitest`. Latest as of 2026-10-15: vite 8.3.4, react 19.3.1, typescript 7.0.2, tailwindcss 4.3.3, shadcn 4.21.5, @cloudflare/vite-plugin 1.64.0, wrangler 4.151.0, @pkmn/dex 0.10.11, @pkmn/img 0.3.4.
**Why:** the owner chose Vite, React, TypeScript, Tailwind and shadcn at their latest versions, to future-proof the site; the rest follows the owner's unlit and blink, confirmed by the owner.

**Q: How is the scaffold put together?**
A: Routes are declared in code (`src/router.tsx`), not with TanStack Router's file-based plugin. shadcn is initialised with its Nova preset on Radix, its palette replaced by the design's dark colours as the only theme, and the design's fonts (Chakra Petch, IBM Plex Sans, IBM Plex Mono) are bundled from Fontsource rather than loaded from Google Fonts. The Worker serves static assets only, with single-page-application fallback, and `wrangler.jsonc` attaches `pkmn.enbraile.vip` as a custom domain. Scaffolded on 2026-10-16 at vite 8.3.4, react 19.3.1, typescript 7.0.2, tailwindcss 4.3.3, shadcn 4.21.5, @tanstack/react-router 1.170.44, vitest 5.0.5, @cloudflare/vite-plugin 1.64.0, wrangler 4.151.0.
**Why:** two routes need no generated route tree for `tsc` to check before a build; bundled fonts keep the site free of runtime calls beyond Showdown's sprites. _(2026-10-16)_

**Q: What is stored, and where?**
A: Imports, open tabs and teams, in the reader's browser (IndexedDB), per browser and device. Nothing goes to a server.
**Why:** the owner.

**Q: What does it look like?**
A: As the [Open Sheet Screens](https://claude.ai/artifact/SfpFcW5UoLVLeLAmdJZMG1) design in Claude Design, signed off by the owner on 2026-10-16: the home page, importing into tabs, the PC with its summary and bag, and the Team view, on desktop and phone. One dark theme, charcoal with a slate-blue PC and orange for actions; no light theme. No helper text explaining the UI. English UI. Desktop-first: every view stays usable on a phone.
**Why:** the owner asked for the design pass first, an English UI (Showdown's names are English) and desktop-first, and in the design pass chose dark only and no explanatory labels. _(2026-10-16)_

## Dependencies and Ordering

**Q: What must exist first?**
A: The export and its JSON reference already exist. The design comes before any screen; the site's scaffold can be built alongside it. Importing comes before the PC, the PC before team building, the builder before the team page and the Showdown copy.

## Portability and Environment

**Q: Where does it run?**
A: As a Cloudflare Worker with static assets, built with `@cloudflare/vite-plugin`, at `pkmn.enbraile.vip`. Static only for now; the same Worker can take API routes when a backend comes, with no move to another product.
**Why:** the owner chose Cloudflare and the custom domain, and expects a Workers backend later.

**Q: How is it deployed?**
A: Cloudflare Workers Builds, connected to the GitHub repository: each push to `main` touching `pkmn/site/` builds and deploys, with preview URLs for branches.
**Why:** the owner.

## Secrets and Config

**Q: Are there secrets?**
A: None in the repository. Workers Builds is connected in the Cloudflare dashboard; the custom domain is set in `wrangler.jsonc`, with `enbraile.vip`'s zone on the owner's Cloudflare account.

## Idempotency and Rollback

**Q: How is a bad deploy undone?**
A: By rolling back to an earlier Worker version in Cloudflare, or reverting the commit, which redeploys.

**Q: What happens to stored data when its shape changes?**
A: Dexie's schema versions migrate the stored model. A stored import that no longer passes the current schema, because the export's JSON changed, is marked in its tab, with a prompt to import the file again; it is never silently dropped.
**Why:** the JSON has no format version ([Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md)), so the site checks shape, not version.

## Observability

**Q: What does it log?**
A: Nothing of its own. Cloudflare's built-in Workers analytics and logs cover the deploy; import errors are shown to the reader.

## References

- [Open Sheet](open-sheet.md), the brief
- [Open Sheet Export](../pkmn/tools/explanation/open-sheet-export.md), [Open Sheet JSON](../pkmn/tools/reference/open-sheet-json.md), [How to Run and Share the Open Sheet Export](../pkmn/tools/how-to/run-the-open-sheet-export.md)
- Wonder: `docs/domains/competition/reference/rules.md` (The League, Pokepastes); `packages/randomlocke/src/randomlocke/data/types.txt`, `showdown.txt`
- The game's ability items: `game/extracted/es-v4.14/scripts/268_Item_Effects.rb` (Ability Capsule, Ability Patch); `plugins/Random Pokemon & Moves + Randomizer EX (Abilities)/000_Config.rb:264` (`TINYMUSHROOM` never randomized)
- The owner's other sites for the stack: `~/workspace/unlit/apps/web/`, `~/workspace/blink/`
- `@pkmn/dex`, `@pkmn/img`: https://github.com/pkmn/ps
